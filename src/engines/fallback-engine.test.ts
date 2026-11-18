import { describe, expect, it } from 'vitest'
import { BURST_SCRIPT, EXPECTED_RESULTS } from '../data/burst-script'
import { FALLBACK_FIXTURES } from '../data/fallback-fixtures'
import { PROTOCOL_IDS } from '../data/protocols'
import {
  createInitialState,
  createReport,
  enqueueReports,
  markProcessing,
} from '../domain/actions'
import { applyDecision } from '../domain/apply-decision'
import { reportsOf } from '../domain/selectors'
import type { TriageState } from '../domain/types'
import { createTriageStore } from '../store/triage-store'
import { createFallbackEngine, FALLBACK_DELAY_MS } from './fallback-engine'

// --- Ayudas ---------------------------------------------------------------

// Procesa la ráfaga S1 a S9 con FallbackEngine y applyDecision, sin cola ni interfaz.
async function runBurst(): Promise<{ state: TriageState; sleeps: number[] }> {
  let state = createInitialState('fallback')
  const sleeps: number[] = []
  const engine = createFallbackEngine(
    () => state,
    async (ms) => {
      sleeps.push(ms)
    },
  )

  const reports = BURST_SCRIPT.map((entry) => {
    const made = createReport(state, {
      id: entry.key,
      buildingId: entry.buildingId,
      floor: entry.floor,
      text: entry.text,
      createdAt: 0,
      scriptKey: entry.key,
    })
    state = made.state
    return made.report
  })
  state = enqueueReports(state, reports, true)

  let n = 0
  for (const entry of BURST_SCRIPT) {
    state = markProcessing(state, entry.key)
    const input = { report: state.reports[entry.key]!, contextIncidents: [], categories: [] }
    const result = await engine.propose(input)
    if (!result.ok) throw new Error(`${entry.key}: ${result.error}`)
    n += 1
    state = applyDecision(state, {
      reportId: entry.key,
      decision: result.decision,
      newIncidentId: `inc-${n}`,
      newCategoryId: `cat-${n}`,
    }).state
  }
  return { state, sleeps }
}

// Resumen comparable de un estado: los incidentes por número, con los avisos y la relación.
function summarize(state: TriageState) {
  return Object.values(state.incidents)
    .sort((a, b) => a.number - b.number)
    .map((inc) => {
      const category = state.categories[inc.categoryId]!
      const related = inc.relatedIncidentId ? state.incidents[inc.relatedIncidentId]! : null
      return {
        number: inc.number,
        keys: reportsOf(state, inc.id).map((r) => r.scriptKey),
        buildingId: inc.buildingId,
        floor: inc.floor,
        category: category.name,
        // El ID de una categoría nueva cambia en cada ejecución; el de una oficial no.
        categoryId: category.official ? category.id : 'nueva',
        official: category.official,
        severity: inc.severity,
        protocolId: inc.protocolId,
        relatedToNumber: related ? related.number : null,
        state: inc.state,
        summary: inc.summary,
        rationale: inc.rationale,
      }
    })
}

// --- Test 34 --------------------------------------------------------------

describe('FallbackEngine: la ráfaga S1 a S9', () => {
  it('coincide exactamente con los resultados esperados (valores principales)', async () => {
    const { state } = await runBurst()
    const incidents = summarize(state)
    expect(incidents).toHaveLength(EXPECTED_RESULTS.length) // 5 incidentes

    for (const expected of EXPECTED_RESULTS) {
      const found = incidents.find((i) => i.keys.includes(expected.keys[0]!))
      expect(found, `grupo ${expected.group}`).toBeDefined()
      // Agrupación
      expect(found!.keys, `grupo ${expected.group}: avisos`).toEqual(expected.keys)
      expect(found!.buildingId).toBe(expected.buildingId)
      expect(found!.floor).toBe(expected.floor)
      // Categoría
      if ('existingId' in expected.category) {
        expect(found!.categoryId, `grupo ${expected.group}: categoría`).toBe(expected.category.existingId)
        expect(found!.official).toBe(true)
      } else {
        expect(expected.category.newNames, `grupo ${expected.group}: categoría nueva`).toContain(found!.category)
        expect(found!.official).toBe(false)
      }
      // Gravedad y protocolo: el valor principal, exacto
      expect(found!.severity, `grupo ${expected.group}: gravedad`).toBe(expected.severity.main)
      expect(found!.protocolId, `grupo ${expected.group}: protocolo`).toBe(expected.protocol.main)
      // Relación
      const relatedGroup = expected.relatedToGroup
        ? EXPECTED_RESULTS.find((g) => g.group === expected.relatedToGroup)!
        : null
      const relatedIncident = relatedGroup
        ? incidents.find((i) => i.keys.includes(relatedGroup.keys[0]!))!
        : null
      expect(found!.relatedToNumber, `grupo ${expected.group}: relación`).toBe(
        relatedIncident ? relatedIncident.number : null,
      )
    }
  })

  it('todos los incidentes terminan pendientes y todos los avisos asignados', async () => {
    const { state } = await runBurst()
    expect(Object.values(state.incidents).every((i) => i.state === 'pending')).toBe(true)
    expect(Object.values(state.reports).every((r) => r.status === 'done' && r.incidentId !== null)).toBe(true)
    expect(Object.keys(state.reports)).toHaveLength(9)
  })

  it('numera los incidentes en el orden de la ráfaga: A, D, B, C, E', async () => {
    const { state } = await runBurst()
    const byNumber = summarize(state).map((i) => i.keys[0])
    expect(byNumber).toEqual(['S1', 'S3', 'S6', 'S8', 'S9'])
  })

  it('la gravedad de A sube S1 Media → S2 Alta → S4 Alta → S7 Crítica', async () => {
    expect(['S1', 'S2', 'S4', 'S7'].map((k) => FALLBACK_FIXTURES[k]!.severity)).toEqual([
      'medium',
      'high',
      'high',
      'critical',
    ])
    const { state } = await runBurst()
    expect(summarize(state)[0]!.severity).toBe('critical')
  })

  it('es determinista: dos ejecuciones dan exactamente el mismo resultado', async () => {
    const a = await runBurst()
    const b = await runBurst()
    expect(summarize(a.state)).toEqual(summarize(b.state))
    expect(a.state).toEqual(b.state)
  })

  it('espera 600 ms por aviso (la latencia simulada), una vez por aviso', async () => {
    const { sleeps } = await runBurst()
    expect(sleeps).toEqual(Array(9).fill(FALLBACK_DELAY_MS))
  })
})

describe('FallbackEngine: respuestas pregrabadas', () => {
  it('hay una respuesta por cada aviso del guion y ninguna de más', () => {
    expect(Object.keys(FALLBACK_FIXTURES).sort()).toEqual(BURST_SCRIPT.map((e) => e.key).sort())
  })

  it('usan solo protocolos y categorías que existen, y textos dentro de los límites', () => {
    for (const [key, f] of Object.entries(FALLBACK_FIXTURES)) {
      expect(PROTOCOL_IDS, key).toContain(f.protocolId)
      if ('existingId' in f.category) {
        expect(['fire-smoke', 'electrical', 'medical', 'security'], key).toContain(f.category.existingId)
      } else {
        expect(f.category.newName.length, key).toBeLessThanOrEqual(40)
      }
      expect(f.summary.length, key).toBeLessThanOrEqual(300)
      expect(f.rationale.length, key).toBeLessThanOrEqual(200)
    }
  })

  it('un join apunta a un aviso ancla anterior de la misma ráfaga, y un create no apunta a nadie', () => {
    const order = BURST_SCRIPT.map((e) => e.key)
    for (const [key, f] of Object.entries(FALLBACK_FIXTURES)) {
      if (f.action === 'join') {
        expect(f.targetAnchor, key).not.toBeNull()
        expect(order.indexOf(f.targetAnchor!), key).toBeLessThan(order.indexOf(key))
        expect(f.relatedAnchor, key).toBeNull()
      } else {
        expect(f.targetAnchor, key).toBeNull()
      }
    }
  })

  it('un aviso que no es del guion no tiene respuesta: devuelve server', async () => {
    const state = createInitialState('fallback')
    const made = createReport(state, { id: 'manual', buildingId: 'torre-central', floor: 1, text: 'x', createdAt: 0 })
    const engine = createFallbackEngine(() => made.state, async () => {})
    expect(
      await engine.propose({ report: made.report, contextIncidents: [], categories: [] }),
    ).toEqual({ ok: false, error: 'server' })
  })

  it('si un ancla no tiene incidente, el destino es null y applyDecision lo trata como «crear»', async () => {
    // S2 se procesa sin que S1 se haya procesado: no hay incidente al que unirse.
    let state = createInitialState('fallback')
    const made = createReport(state, { id: 's2', buildingId: 'torre-central', floor: 2, text: 'x', createdAt: 0, scriptKey: 'S2' })
    state = markProcessing(enqueueReports(made.state, [made.report]), 's2')
    const engine = createFallbackEngine(() => state, async () => {})
    const result = await engine.propose({ report: state.reports.s2!, contextIncidents: [], categories: [] })
    expect(result.ok && result.decision.action).toBe('join')
    expect(result.ok && result.decision.targetIncidentId).toBeNull()
    if (!result.ok) throw new Error('S2 debía tener respuesta')
    const applied = applyDecision(state, {
      reportId: 's2',
      decision: result.decision,
      newIncidentId: 'i1',
      newCategoryId: 'c1',
    }).state
    expect(Object.keys(applied.incidents)).toEqual(['i1'])
  })
})

// --- Por la cola y el store, como en la aplicación ---------------------------

describe('modo sin API por la cola y el store', () => {
  function makeStore() {
    const calls: unknown[] = []
    let n = 0
    const sleeps: number[] = []
    const store = createTriageStore({
      call: async (args) => {
        calls.push(args)
        return { ok: false, error: 'server' }
      },
      fallbackEngine: (getState) =>
        createFallbackEngine(getState, async (ms) => {
          sleeps.push(ms)
        }),
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      uuid: () => `u${++n}`,
      now: () => 1000,
    })
    return { ...store, calls, sleeps }
  }

  it('«Simular ráfaga» en modo sin API termina en los incidentes del guion, sin llamadas ni contraseña', async () => {
    const { useTriageStore, triageActions, calls } = makeStore()
    triageActions.setMode('fallback')
    await triageActions.startBurst()

    const s = useTriageStore.getState()
    expect(calls).toHaveLength(0) // ninguna llamada a la IA
    expect(s.passwordPrompt).toBeNull() // sin contraseña
    expect(s.demoPassword).toBeNull()
    expect(s.running).toBe(false)
    expect(Object.values(s.state.incidents)).toHaveLength(5)

    const incidents = summarize(s.state)
    expect(incidents.map((i) => i.keys)).toEqual([['S1', 'S2', 'S4', 'S7'], ['S3', 'S5'], ['S6'], ['S8'], ['S9']])
    expect(incidents.map((i) => i.severity)).toEqual(['critical', 'medium', 'high', 'medium', 'medium'])
    expect(incidents[2]!.relatedToNumber).toBe(1)
  })

  it('en la aplicación la ráfaga de la cola da el mismo resultado que la directa', async () => {
    const direct = summarize((await runBurst()).state)
    const { useTriageStore, triageActions } = makeStore()
    triageActions.setMode('fallback')
    await triageActions.startBurst()
    // Los IDs y las horas cambian; el resto debe coincidir.
    expect(summarize(useTriageStore.getState().state)).toEqual(direct)
  })

  it('repetir la ráfaga tras «Reiniciar» da el mismo resultado', async () => {
    const { useTriageStore, triageActions } = makeStore()
    triageActions.setMode('fallback')
    await triageActions.startBurst()
    const first = summarize(useTriageStore.getState().state)
    triageActions.resetDemo()
    expect(useTriageStore.getState().state.mode).toBe('fallback') // el reinicio conserva el modo
    await triageActions.startBurst()
    expect(summarize(useTriageStore.getState().state)).toEqual(first)
  })

  it('un aviso manual en modo sin API se ignora', async () => {
    const { useTriageStore, triageActions } = makeStore()
    triageActions.setMode('fallback')
    await triageActions.submitManualReport({ buildingId: 'torre-central', floor: 2, text: 'Humo' })
    expect(Object.keys(useTriageStore.getState().state.reports)).toHaveLength(0)
  })
})
