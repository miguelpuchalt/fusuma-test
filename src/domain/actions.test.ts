import { describe, expect, it } from 'vitest'
import { floorLabel } from '../data/buildings'
import {
  approveCategory,
  createInitialState,
  createReport,
  discardIncident,
  editIncident,
  enqueueReports,
  markError,
  markProcessing,
  retryReport,
  returnToQueue,
  validateIncident,
} from './actions'
import { applyDecision } from './apply-decision'
import { canJoin, canRelate, maxSeverity } from './rules'
import {
  buildTriageInput,
  burstProgress,
  incidentsByState,
  isBoardEmpty,
  queueOrder,
  reportsOf,
  visibleCategories,
} from './selectors'
import type { Incident, Report, TriageDecision, TriageState } from './types'

function queued(state: TriageState, id: string, floor = 2, scriptKey: string | null = null) {
  const made = createReport(state, {
    id,
    buildingId: 'torre-central',
    floor,
    text: `texto ${id}`,
    createdAt: 0,
    scriptKey,
  })
  return { state: enqueueReports(made.state, [made.report]), report: made.report }
}

function createDecision(over: Partial<TriageDecision> = {}): TriageDecision {
  return {
    action: 'create',
    targetIncidentId: null,
    relatedIncidentId: null,
    category: { existingId: 'fire-smoke' },
    severity: 'medium',
    protocolId: 'evac-plan',
    summary: 's',
    rationale: 'r',
    ...over,
  }
}

// Procesa un aviso con una decisión y devuelve el estado y el ID del incidente.
function processed(
  state: TriageState,
  id: string,
  floor: number,
  over: Partial<TriageDecision> = {},
) {
  let s = queued(state, id, floor).state
  s = markProcessing(s, id)
  s = applyDecision(s, {
    reportId: id,
    decision: createDecision(over),
    newIncidentId: `inc-${id}`,
    newCategoryId: `cat-${id}`,
  }).state
  return { state: s, incidentId: s.reports[id]!.incidentId! }
}

describe('createInitialState', () => {
  it('empieza vacío, con las 4 categorías oficiales y el modo indicado', () => {
    const s = createInitialState('fallback')
    expect(s.mode).toBe('fallback')
    expect(isBoardEmpty(s)).toBe(true)
    expect(Object.values(s.categories).every((c) => c.official)).toBe(true)
    expect(Object.keys(s.categories).sort()).toEqual(
      ['electrical', 'fire-smoke', 'medical', 'security'].sort(),
    )
    expect(s.nextSeq).toBe(1)
    expect(s.nextIncidentNumber).toBe(1)
    expect(s.burstStartSeq).toBeNull()
  })

  it('el modo por defecto es llm', () => {
    expect(createInitialState().mode).toBe('llm')
  })
})

describe('avisos: seq, cola y errores', () => {
  it('createReport asigna seq crecientes', () => {
    let s = createInitialState()
    const a = queued(s, 'a')
    const b = queued(a.state, 'b')
    expect([a.report.seq, b.report.seq]).toEqual([1, 2])
    expect(b.state.nextSeq).toBe(3)
  })

  it('enqueueReports con burst fija burstStartSeq en el menor seq', () => {
    let s = createInitialState()
    const r1 = createReport(s, { id: 'a', buildingId: 'torre-central', floor: 1, text: 't', createdAt: 0, scriptKey: 'S1' })
    const r2 = createReport(r1.state, { id: 'b', buildingId: 'torre-central', floor: 1, text: 't', createdAt: 0, scriptKey: 'S2' })
    s = enqueueReports(r2.state, [r1.report, r2.report], true)
    expect(s.burstStartSeq).toBe(1)
    expect(queueOrder(s).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('markProcessing y markError solo cambian el estado esperado', () => {
    let s = queued(createInitialState(), 'a').state
    expect(markError(s, 'a', 'server')).toBe(s) // no está procesándose
    s = markProcessing(s, 'a')
    expect(s.reports.a!.status).toBe('processing')
    expect(markProcessing(s, 'a')).toBe(s)
    s = markError(s, 'a', 'timeout')
    expect(s.reports.a).toMatchObject({ status: 'error', errorKind: 'timeout' })
  })

  it('retryReport manda el aviso al final con un seq nuevo', () => {
    let s = queued(createInitialState(), 'a').state
    s = queued(s, 'b').state
    s = markError(markProcessing(s, 'a'), 'a', 'rate_limit')
    s = retryReport(s, 'a')
    expect(s.reports.a).toMatchObject({ status: 'queued', errorKind: null, seq: 3 })
    expect(queueOrder(s).map((r) => r.id)).toEqual(['b', 'a'])
    expect(s.nextSeq).toBe(4)
  })

  it('retryReport no reintenta invalid_input ni avisos que no están en error', () => {
    let s = queued(createInitialState(), 'a').state
    expect(retryReport(s, 'a')).toBe(s) // en cola
    s = markError(markProcessing(s, 'a'), 'a', 'invalid_input')
    expect(retryReport(s, 'a')).toBe(s)
    expect(retryReport(s, 'no-existe')).toBe(s)
  })

  it('returnToQueue conserva la posición (seq)', () => {
    let s = queued(createInitialState(), 'a').state
    s = queued(s, 'b').state
    s = markProcessing(s, 'a')
    s = returnToQueue(s, 'a')
    expect(s.reports.a).toMatchObject({ status: 'queued', seq: 1 })
    expect(queueOrder(s).map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('editIncident', () => {
  it('bloquea cada campo editado y solo ese', () => {
    const { state, incidentId } = processed(createInitialState(), 'a', 2)
    const s = editIncident(state, incidentId, { protocolId: 'notify' })
    expect(s.incidents[incidentId]!.protocolId).toBe('notify')
    expect(s.incidents[incidentId]!.locks).toEqual({
      category: false,
      severity: false,
      protocol: true,
      summary: false,
    })
    const s2 = editIncident(s, incidentId, { severity: 'critical', summary: 'Nuevo', categoryId: 'security' })
    expect(s2.incidents[incidentId]).toMatchObject({
      severity: 'critical',
      summary: 'Nuevo',
      categoryId: 'security',
    })
    expect(s2.incidents[incidentId]!.locks).toEqual({
      category: true,
      severity: true,
      protocol: true,
      summary: true,
    })
  })

  it('la categoría se elige entre las visibles', () => {
    const { state, incidentId } = processed(createInitialState(), 'a', 2)
    const withUnused = processed(state, 'b', 3, { category: { newName: 'Fuga de agua' } })
    // «Fuga de agua» la usa el incidente de b: es visible.
    const ok = editIncident(withUnused.state, incidentId, { categoryId: 'cat-b' })
    expect(ok.incidents[incidentId]!.categoryId).toBe('cat-b')
    // Una categoría que no existe se rechaza sin cambiar nada.
    expect(editIncident(state, incidentId, { categoryId: 'inventada' })).toBe(state)
  })

  it('rechaza un protocolo desconocido sin cambiar nada', () => {
    const { state, incidentId } = processed(createInitialState(), 'a', 2)
    expect(editIncident(state, incidentId, { protocolId: 'inventado' })).toBe(state)
  })

  it('un incidente validado o descartado ya no se edita', () => {
    const a = processed(createInitialState(), 'a', 2)
    const validated = validateIncident(a.state, a.incidentId)
    expect(editIncident(validated, a.incidentId, { summary: 'x' })).toBe(validated)
    const b = processed(createInitialState(), 'b', 2)
    const discarded = discardIncident(b.state, b.incidentId)
    expect(editIncident(discarded, b.incidentId, { summary: 'x' })).toBe(discarded)
  })
})

describe('validar y descartar son finales', () => {
  it('validar solo vale desde pendiente y es final', () => {
    const { state, incidentId } = processed(createInitialState(), 'a', 2)
    const v = validateIncident(state, incidentId)
    expect(v.incidents[incidentId]!.state).toBe('validated')
    expect(discardIncident(v, incidentId)).toBe(v)
    expect(validateIncident(v, incidentId)).toBe(v)
  })

  it('descartar solo vale desde pendiente y es final', () => {
    const { state, incidentId } = processed(createInitialState(), 'a', 2)
    const d = discardIncident(state, incidentId)
    expect(d.incidents[incidentId]!.state).toBe('discarded')
    expect(validateIncident(d, incidentId)).toBe(d)
    expect(discardIncident(d, 'no-existe')).toBe(d)
  })
})

describe('approveCategory', () => {
  it('pasa la categoría a oficial y no cambia los incidentes', () => {
    const a = processed(createInitialState(), 'a', 2, { category: { newName: 'Fuga de agua' } })
    expect(a.state.categories['cat-a']!.official).toBe(false)
    const s = approveCategory(a.state, 'cat-a')
    expect(s.categories['cat-a']!.official).toBe(true)
    expect(s.incidents).toBe(a.state.incidents)
  })

  it('no hace nada con una categoría ya oficial o inexistente', () => {
    const s = createInitialState()
    expect(approveCategory(s, 'medical')).toBe(s)
    expect(approveCategory(s, 'no-existe')).toBe(s)
  })
})

describe('visibleCategories', () => {
  it('oculta las no oficiales que ningún incidente usa', () => {
    const s0 = createInitialState()
    const s = {
      ...s0,
      categories: { ...s0.categories, huerfana: { id: 'huerfana', name: 'Huérfana', official: false } },
    }
    expect(visibleCategories(s).map((c) => c.id)).not.toContain('huerfana')
    expect(visibleCategories(s)).toHaveLength(4)
  })

  it('muestra las no oficiales que usa algún incidente', () => {
    const a = processed(createInitialState(), 'a', 2, { category: { newName: 'Fuga de agua' } })
    expect(visibleCategories(a.state).map((c) => c.id)).toContain('cat-a')
    expect(visibleCategories(a.state)).toHaveLength(5)
  })
})

describe('elegibilidad: las cuatro filas de la tabla', () => {
  const report = { buildingId: 'torre-central', floor: 2 } as Report
  const base = { buildingId: 'torre-central', floor: 2 } as Incident
  const inc = (over: Partial<Incident>): Incident => ({ ...base, ...over }) as Incident

  it('pending, misma planta: canJoin sí, canRelate no', () => {
    const i = inc({ state: 'pending', floor: 2 })
    expect([canJoin(i, report), canRelate(i, report)]).toEqual([true, false])
  })

  it('pending, otra planta del edificio: canJoin no, canRelate sí', () => {
    const i = inc({ state: 'pending', floor: 3 })
    expect([canJoin(i, report), canRelate(i, report)]).toEqual([false, true])
  })

  it('validated, cualquier planta del edificio: canJoin no, canRelate sí', () => {
    for (const floor of [2, 5]) {
      const i = inc({ state: 'validated', floor })
      expect([canJoin(i, report), canRelate(i, report)]).toEqual([false, true])
    }
  })

  it('discarded: ni canJoin ni canRelate', () => {
    for (const floor of [2, 3]) {
      const i = inc({ state: 'discarded', floor })
      expect([canJoin(i, report), canRelate(i, report)]).toEqual([false, false])
    }
  })

  it('un incidente de otro edificio nunca es elegible', () => {
    for (const state of ['pending', 'validated'] as const) {
      const i = inc({ state, floor: 2, buildingId: 'anexo-a' })
      expect([canJoin(i, report), canRelate(i, report)]).toEqual([false, false])
    }
  })
})

describe('selectores', () => {
  it('reportsOf devuelve los avisos de un incidente por seq', () => {
    let { state, incidentId } = processed(createInitialState(), 'a', 2)
    state = queued(state, 'b').state
    state = markProcessing(state, 'b')
    state = applyDecision(state, {
      reportId: 'b',
      decision: createDecision({ action: 'join', targetIncidentId: incidentId }),
      newIncidentId: 'x',
      newCategoryId: 'y',
    }).state
    expect(reportsOf(state, incidentId).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('incidentsByState filtra por estado y ordena por número', () => {
    let s = createInitialState()
    const ids: string[] = []
    for (const [n, floor] of [['a', 1], ['b', 2], ['c', 3]] as const) {
      const r = processed(s, n, floor)
      s = r.state
      ids.push(r.incidentId)
    }
    s = validateIncident(s, ids[1]!)
    expect(incidentsByState(s, 'pending').map((i) => i.number)).toEqual([1, 3])
    expect(incidentsByState(s, 'validated').map((i) => i.number)).toEqual([2])
    expect(incidentsByState(s, 'discarded')).toEqual([])
  })

  it('isBoardEmpty es falso en cuanto hay un aviso', () => {
    const s = queued(createInitialState(), 'a').state
    expect(isBoardEmpty(s)).toBe(false)
  })

  it('burstProgress cuenta los avisos de la ráfaga ya resueltos, hasta 9', () => {
    let s = createInitialState()
    const keys = ['S1', 'S2', 'S3']
    const reports: Report[] = []
    for (const [i, k] of keys.entries()) {
      const m = createReport(s, { id: `b${i}`, buildingId: 'torre-central', floor: 1, text: 't', createdAt: 0, scriptKey: k })
      s = m.state
      reports.push(m.report)
    }
    s = enqueueReports(s, reports, true)
    expect(burstProgress(s)).toEqual({ done: 0, total: 9 })
    s = markProcessing(s, 'b0')
    expect(burstProgress(s).done).toBe(0)
    s = markError(s, 'b0', 'server')
    expect(burstProgress(s).done).toBe(1)
    expect(burstProgress(createInitialState())).toEqual({ done: 0, total: 9 })
  })

  it('buildTriageInput incluye solo los incidentes del mismo edificio, con sus avisos', () => {
    let s = createInitialState()
    const a = processed(s, 'a', 2)
    const b = (() => {
      let t = queued(a.state, 'b', 0).state
      // aviso en otro edificio
      const made = createReport(t, { id: 'c', buildingId: 'anexo-a', floor: 0, text: 'anexo', createdAt: 0 })
      t = enqueueReports(made.state, [made.report])
      t = markProcessing(t, 'c')
      t = applyDecision(t, {
        reportId: 'c',
        decision: createDecision(),
        newIncidentId: 'inc-c',
        newCategoryId: 'cat-c',
      }).state
      return t
    })()
    const input = buildTriageInput(b, 'b')
    expect(input.report.id).toBe('b')
    expect(input.contextIncidents.map((c) => c.incident.id)).toEqual([a.incidentId])
    expect(input.contextIncidents[0]!.reports.map((r) => r.id)).toEqual(['a'])
    expect(input.categories).toHaveLength(4)
    expect(() => buildTriageInput(b, 'no-existe')).toThrow()
  })
})

describe('reglas auxiliares', () => {
  it('maxSeverity devuelve la mayor', () => {
    expect(maxSeverity('low', 'high')).toBe('high')
    expect(maxSeverity('critical', 'medium')).toBe('critical')
    expect(maxSeverity('high', 'high')).toBe('high')
  })

  it('floorLabel nombra sótanos, planta baja y plantas', () => {
    expect(floorLabel(-1)).toBe('Sótano 1')
    expect(floorLabel(-2)).toBe('Sótano 2')
    expect(floorLabel(0)).toBe('Planta baja')
    expect(floorLabel(3)).toBe('Planta 3')
  })
})
