import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  createReport,
  discardIncident,
  editIncident,
  enqueueReports,
  markProcessing,
  validateIncident,
} from './actions'
import { applyDecision } from './apply-decision'
import type { Category, Severity, TriageDecision, TriageState } from './types'

const TORRE = 'torre-central'
let counter = 0

function decision(over: Partial<TriageDecision> = {}): TriageDecision {
  return {
    action: 'create',
    targetIncidentId: null,
    relatedIncidentId: null,
    category: { existingId: 'fire-smoke' },
    severity: 'medium',
    protocolId: 'evac-plan',
    summary: 'Resumen de la IA',
    rationale: 'Motivo de la IA',
    ...over,
  }
}

// Crea un aviso, lo deja en `processing` y aplica la decisión.
function run(
  state: TriageState,
  where: { buildingId?: string; floor: number; text?: string },
  dec: TriageDecision,
): { state: TriageState; reportId: string; incidentId: string; created: Category | null } {
  counter += 1
  const reportId = `r${counter}`
  const made = createReport(state, {
    id: reportId,
    buildingId: where.buildingId ?? TORRE,
    floor: where.floor,
    text: where.text ?? `Aviso ${counter}`,
    createdAt: 0,
  })
  let s = enqueueReports(made.state, [made.report])
  s = markProcessing(s, reportId)
  const result = applyDecision(s, {
    reportId,
    decision: dec,
    newIncidentId: `i${counter}`,
    newCategoryId: `c${counter}`,
  })
  return {
    state: result.state,
    reportId,
    incidentId: result.state.reports[reportId]!.incidentId ?? '',
    created: result.createdCategory,
  }
}

// Crea un incidente en la planta indicada y devuelve su ID.
function withIncident(floor: number, over: Partial<TriageDecision> = {}, base?: TriageState) {
  const r = run(base ?? createInitialState('llm'), { floor }, decision(over))
  return { state: r.state, id: r.incidentId }
}

describe('applyDecision: regla 1 (aviso no procesable)', () => {
  it('no cambia nada si el aviso no existe', () => {
    const s = createInitialState('llm')
    const r = applyDecision(s, {
      reportId: 'nope',
      decision: decision(),
      newIncidentId: 'x',
      newCategoryId: 'y',
    })
    expect(r.state).toBe(s)
    expect(r.createdCategory).toBeNull()
  })

  it('no cambia nada si el aviso no está en processing', () => {
    const made = createReport(createInitialState('llm'), {
      id: 'q1',
      buildingId: TORRE,
      floor: 2,
      text: 'hola',
      createdAt: 0,
    })
    const s = enqueueReports(made.state, [made.report]) // queda en «queued»
    const r = applyDecision(s, {
      reportId: 'q1',
      decision: decision(),
      newIncidentId: 'x',
      newCategoryId: 'y',
    })
    expect(r.state).toBe(s)
    expect(Object.keys(r.state.incidents)).toHaveLength(0)
  })
})

describe('applyDecision: create', () => {
  it('crea un incidente pendiente con el edificio y la planta del aviso', () => {
    const { state, id } = withIncident(2)
    const inc = state.incidents[id]!
    expect(inc).toMatchObject({
      number: 1,
      buildingId: TORRE,
      floor: 2,
      state: 'pending',
      relatedIncidentId: null,
      categoryId: 'fire-smoke',
      protocolId: 'evac-plan',
      summary: 'Resumen de la IA',
      rationale: 'Motivo de la IA',
      locks: { category: false, severity: false, protocol: false, summary: false },
    })
    const report = Object.values(state.reports)[0]!
    expect(report.status).toBe('done')
    expect(report.incidentId).toBe(id)
  })

  it('guarda una relación válida (incidente pendiente de otra planta)', () => {
    const a = withIncident(2)
    const b = run(a.state, { floor: 3 }, decision({ relatedIncidentId: a.id }))
    expect(b.state.incidents[b.incidentId]!.relatedIncidentId).toBe(a.id)
  })

  it('guarda una relación válida con un incidente validado de la misma planta', () => {
    const a = withIncident(2)
    const validated = validateIncident(a.state, a.id)
    const b = run(validated, { floor: 2 }, decision({ relatedIncidentId: a.id }))
    expect(b.state.incidents[b.incidentId]!.relatedIncidentId).toBe(a.id)
  })

  it('descarta una relación no válida: incidente pendiente de la misma planta', () => {
    const a = withIncident(2)
    const b = run(a.state, { floor: 2 }, decision({ relatedIncidentId: a.id }))
    expect(b.state.incidents[b.incidentId]!.relatedIncidentId).toBeNull()
    expect(b.incidentId).not.toBe(a.id)
  })

  it('descarta una relación con un incidente de otro edificio, descartado o inexistente', () => {
    const a = withIncident(2)
    const other = run(a.state, { buildingId: 'anexo-a', floor: 0 }, decision())
    const crossBuilding = run(
      other.state,
      { buildingId: 'anexo-a', floor: 1 },
      decision({ relatedIncidentId: a.id }),
    )
    expect(crossBuilding.state.incidents[crossBuilding.incidentId]!.relatedIncidentId).toBeNull()

    const discarded = discardIncident(a.state, a.id)
    const afterDiscard = run(discarded, { floor: 3 }, decision({ relatedIncidentId: a.id }))
    expect(afterDiscard.state.incidents[afterDiscard.incidentId]!.relatedIncidentId).toBeNull()

    const ghost = run(a.state, { floor: 3 }, decision({ relatedIncidentId: 'no-existe' }))
    expect(ghost.state.incidents[ghost.incidentId]!.relatedIncidentId).toBeNull()
  })

  it('ignora targetIncidentId cuando la acción es create', () => {
    const a = withIncident(2)
    const b = run(a.state, { floor: 2 }, decision({ action: 'create', targetIncidentId: a.id }))
    expect(b.incidentId).not.toBe(a.id)
    expect(Object.keys(b.state.incidents)).toHaveLength(2)
  })

  it('INC-n crece de uno en uno', () => {
    let s = createInitialState('llm')
    const numbers: number[] = []
    for (let floor = 0; floor < 3; floor++) {
      const r = run(s, { floor }, decision())
      s = r.state
      numbers.push(s.incidents[r.incidentId]!.number)
    }
    expect(numbers).toEqual([1, 2, 3])
    expect(s.nextIncidentNumber).toBe(4)
  })

  it('recorta el resumen y el motivo a su máximo', () => {
    const { state, id } = withIncident(2, {
      summary: 'x'.repeat(500),
      rationale: 'y'.repeat(500),
    })
    expect(state.incidents[id]!.summary).toHaveLength(300)
    expect(state.incidents[id]!.rationale).toHaveLength(200)
  })
})

describe('applyDecision: join válido', () => {
  it('asigna el aviso y actualiza los campos no bloqueados', () => {
    const a = withIncident(2, { severity: 'medium', summary: 'Antes', protocolId: 'notify' })
    const j = run(
      a.state,
      { floor: 2 },
      decision({
        action: 'join',
        targetIncidentId: a.id,
        severity: 'high',
        protocolId: 'evac-nearest',
        summary: 'Después',
        rationale: 'Nuevo motivo',
        category: { existingId: 'electrical' },
      }),
    )
    expect(j.incidentId).toBe(a.id)
    const inc = j.state.incidents[a.id]!
    expect(inc).toMatchObject({
      severity: 'high',
      protocolId: 'evac-nearest',
      summary: 'Después',
      rationale: 'Nuevo motivo',
      categoryId: 'electrical',
    })
    expect(Object.keys(j.state.incidents)).toHaveLength(1)
    expect(j.state.reports[j.reportId]!.status).toBe('done')
  })

  it('la gravedad nunca baja: usa el máximo', () => {
    const a = withIncident(2, { severity: 'critical' })
    const j = run(
      a.state,
      { floor: 2 },
      decision({ action: 'join', targetIncidentId: a.id, severity: 'low' as Severity }),
    )
    expect(j.state.incidents[a.id]!.severity).toBe('critical')
  })

  it('no cambia la relación del destino', () => {
    const a = withIncident(2)
    const b = run(a.state, { floor: 3 }, decision({ relatedIncidentId: a.id }))
    // b está relacionado con a. Un join a b no debe tocar esa relación.
    const j = run(
      b.state,
      { floor: 3 },
      decision({ action: 'join', targetIncidentId: b.incidentId, relatedIncidentId: null }),
    )
    expect(j.state.incidents[b.incidentId]!.relatedIncidentId).toBe(a.id)
  })

  it('actualiza siempre el motivo, aunque todo lo demás esté bloqueado', () => {
    const a = withIncident(2)
    let s = editIncident(a.state, a.id, {
      categoryId: 'security',
      severity: 'low',
      protocolId: 'notify',
      summary: 'Escrito a mano',
    })
    s = run(
      s,
      { floor: 2 },
      decision({ action: 'join', targetIncidentId: a.id, rationale: 'Otro motivo' }),
    ).state
    expect(s.incidents[a.id]!.rationale).toBe('Otro motivo')
  })
})

describe('applyDecision: campos bloqueados', () => {
  it('la IA no cambia un campo bloqueado, y sí los demás', () => {
    const a = withIncident(2, { severity: 'medium', protocolId: 'notify' })
    const edited = editIncident(a.state, a.id, {
      summary: 'Escrito a mano',
      protocolId: 'meet-outside',
      severity: 'low',
      categoryId: 'security',
    })
    const j = run(
      edited,
      { floor: 2 },
      decision({
        action: 'join',
        targetIncidentId: a.id,
        summary: 'Resumen IA',
        protocolId: 'evac-plan',
        severity: 'critical',
        category: { existingId: 'fire-smoke' },
      }),
    )
    const inc = j.state.incidents[a.id]!
    expect(inc.summary).toBe('Escrito a mano')
    expect(inc.protocolId).toBe('meet-outside')
    expect(inc.severity).toBe('low')
    expect(inc.categoryId).toBe('security')
    expect(inc.locks).toEqual({ category: true, severity: true, protocol: true, summary: true })
  })

  it('un campo sin bloquear sí se actualiza aunque otro esté bloqueado', () => {
    const a = withIncident(2, { severity: 'medium' })
    const edited = editIncident(a.state, a.id, { summary: 'Escrito a mano' })
    const j = run(
      edited,
      { floor: 2 },
      decision({ action: 'join', targetIncidentId: a.id, severity: 'high' }),
    )
    expect(j.state.incidents[a.id]!.summary).toBe('Escrito a mano')
    expect(j.state.incidents[a.id]!.severity).toBe('high')
  })

  it('con la categoría bloqueada no se crea una categoría nueva', () => {
    const a = withIncident(2)
    const edited = editIncident(a.state, a.id, { categoryId: 'security' })
    const j = run(
      edited,
      { floor: 2 },
      decision({
        action: 'join',
        targetIncidentId: a.id,
        category: { newName: 'Fuga de agua' },
      }),
    )
    expect(j.created).toBeNull()
    expect(Object.keys(j.state.categories)).toHaveLength(4)
    expect(j.state.incidents[a.id]!.categoryId).toBe('security')
  })
})

describe('applyDecision: join sin destino válido', () => {
  const FALLBACK_TEXT = 'Incidente nuevo: el incidente propuesto no admitía este aviso.'

  it('a un incidente validado: crea uno nuevo relacionado con él', () => {
    const a = withIncident(2)
    const validated = validateIncident(a.state, a.id)
    const j = run(
      validated,
      { floor: 2, text: 'Sigue el humo' },
      decision({ action: 'join', targetIncidentId: a.id, severity: 'high', summary: 'IA' }),
    )
    const inc = j.state.incidents[j.incidentId]!
    expect(j.incidentId).not.toBe(a.id)
    expect(inc.relatedIncidentId).toBe(a.id)
    expect(inc.summary).toBe('Sigue el humo')
    expect(inc.severity).toBe('high')
    expect(inc.rationale).toBe(FALLBACK_TEXT)
    expect(j.state.incidents[a.id]!.state).toBe('validated')
  })

  it('a un incidente descartado: crea uno nuevo sin relación', () => {
    const a = withIncident(2)
    const discarded = discardIncident(a.state, a.id)
    const j = run(discarded, { floor: 2 }, decision({ action: 'join', targetIncidentId: a.id }))
    expect(j.state.incidents[j.incidentId]!.relatedIncidentId).toBeNull()
    expect(j.incidentId).not.toBe(a.id)
  })

  it('a un incidente pendiente de otra planta: crea uno nuevo relacionado con él', () => {
    const a = withIncident(2)
    const j = run(a.state, { floor: 3 }, decision({ action: 'join', targetIncidentId: a.id }))
    const inc = j.state.incidents[j.incidentId]!
    expect(inc.floor).toBe(3)
    expect(inc.relatedIncidentId).toBe(a.id)
    expect(j.state.incidents[a.id]!.relatedIncidentId).toBeNull()
  })

  it('a un destino null o inexistente: crea uno nuevo sin relación', () => {
    const a = withIncident(2)
    const toNull = run(a.state, { floor: 2 }, decision({ action: 'join', targetIncidentId: null }))
    expect(toNull.state.incidents[toNull.incidentId]!.relatedIncidentId).toBeNull()
    expect(toNull.incidentId).not.toBe(a.id)
    const toGhost = run(
      a.state,
      { floor: 2 },
      decision({ action: 'join', targetIncidentId: 'no-existe' }),
    )
    expect(toGhost.state.incidents[toGhost.incidentId]!.relatedIncidentId).toBeNull()
  })

  it('a un incidente de otro edificio: crea uno nuevo sin relación', () => {
    const a = withIncident(2)
    const j = run(
      a.state,
      { buildingId: 'anexo-a', floor: 2 },
      decision({ action: 'join', targetIncidentId: a.id }),
    )
    expect(j.state.incidents[j.incidentId]!.relatedIncidentId).toBeNull()
    expect(j.state.incidents[j.incidentId]!.buildingId).toBe('anexo-a')
  })
})

describe('applyDecision: categorías', () => {
  it('una categoría nueva se crea como no oficial y se devuelve', () => {
    const r = run(
      createInitialState('llm'),
      { floor: -1, buildingId: 'laboratorios' },
      decision({ category: { newName: 'Fuga de agua' } }),
    )
    expect(r.created).toMatchObject({ name: 'Fuga de agua', official: false })
    expect(r.state.categories[r.created!.id]).toEqual(r.created)
    expect(r.state.incidents[r.incidentId]!.categoryId).toBe(r.created!.id)
  })

  it('un nombre equivalente (tildes, mayúsculas, espacios) reutiliza la categoría', () => {
    const first = run(
      createInitialState('llm'),
      { floor: 0 },
      decision({ category: { newName: 'Fuga de agua' } }),
    )
    const second = run(
      first.state,
      { floor: 1 },
      decision({ category: { newName: '  FUGA   de   Água ' } }),
    )
    expect(second.created).toBeNull()
    expect(second.state.incidents[second.incidentId]!.categoryId).toBe(first.created!.id)
    expect(Object.keys(second.state.categories)).toHaveLength(5)
  })

  it('un nombre equivalente a una categoría oficial reutiliza la oficial', () => {
    const r = run(
      createInitialState('llm'),
      { floor: 0 },
      decision({ category: { newName: 'medico' } }),
    )
    expect(r.created).toBeNull()
    expect(r.state.incidents[r.incidentId]!.categoryId).toBe('medical')
  })

  it('un nombre de categoría de más de 40 caracteres se recorta', () => {
    const r = run(
      createInitialState('llm'),
      { floor: 0 },
      decision({ category: { newName: 'a'.repeat(80) } }),
    )
    expect(r.created!.name).toHaveLength(40)
  })
})

describe('applyDecision: precondiciones', () => {
  it('lanza si la categoría existente no existe', () => {
    expect(() => withIncident(2, { category: { existingId: 'inventada' } })).toThrow(/inexistente/)
  })

  it('lanza si el protocolo no existe', () => {
    expect(() => withIncident(2, { protocolId: 'inventado' })).toThrow(/inexistente/)
  })

  it('no modifica el estado de entrada (función pura)', () => {
    const before = createInitialState('llm')
    const snapshot = JSON.stringify(before)
    run(before, { floor: 2 }, decision())
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})
