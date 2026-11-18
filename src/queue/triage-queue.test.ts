import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  createReport,
  enqueueReports,
  markError,
  markProcessing,
} from '../domain/actions'
import { burstProgress, queueOrder } from '../domain/selectors'
import type {
  Mode,
  TriageDecision,
  TriageEngine,
  TriageInput,
  TriageResult,
  TriageState,
} from '../domain/types'
import { createLlmEngine } from '../engines/llm-engine'
import { createTriageStore } from '../store/triage-store'
import { BURST_PAUSE_MS, createTriageQueue, type PasswordPrompt } from './triage-queue'

// --- Ayudas ---------------------------------------------------------------

const decision = (over: Partial<TriageDecision> = {}): TriageDecision => ({
  action: 'create',
  targetIncidentId: null,
  relatedIncidentId: null,
  category: { existingId: 'fire-smoke' },
  severity: 'medium',
  protocolId: 'notify',
  summary: 's',
  rationale: 'r',
  ...over,
})
const ok = (over: Partial<TriageDecision> = {}): TriageResult => ({ ok: true, decision: decision(over) })
const fail = (error: Extract<TriageResult, { ok: false }>['error']): TriageResult => ({ ok: false, error })

// Motor falso: `responder` decide la respuesta; cuenta llamadas y concurrencia.
function fakeEngine(responder: (input: TriageInput, call: number) => Promise<TriageResult> | TriageResult) {
  const engine = {
    calls: 0,
    inFlight: 0,
    maxInFlight: 0,
    seen: [] as string[],
    propose: async (input: TriageInput): Promise<TriageResult> => {
      engine.calls += 1
      engine.inFlight += 1
      engine.maxInFlight = Math.max(engine.maxInFlight, engine.inFlight)
      engine.seen.push(input.report.id)
      try {
        await Promise.resolve()
        return await responder(input, engine.calls)
      } finally {
        engine.inFlight -= 1
      }
    },
  }
  return engine
}

// Una promesa que el test resuelve a mano, para parar el motor a mitad de una llamada.
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function setup(engine: TriageEngine & object, options: { mode?: Mode; password?: string | null } = {}) {
  let state: TriageState = createInitialState(options.mode ?? 'llm')
  const ui = {
    running: false,
    password: options.password === undefined ? 'secreta' : options.password,
    prompt: null as PasswordPrompt,
  }
  const sleeps: number[] = []
  let n = 0
  const queue = createTriageQueue({
    getState: () => state,
    setState: (next) => (state = next),
    getEngine: () => engine,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    uuid: () => `id${++n}`,
    now: () => 1000,
    ui: {
      isRunning: () => ui.running,
      setRunning: (v) => (ui.running = v),
      getPassword: () => ui.password,
      setPassword: (p) => (ui.password = p),
      setPasswordPrompt: (p) => (ui.prompt = p),
    },
  })
  return {
    queue,
    ui,
    sleeps,
    get: () => state,
    set: (next: TriageState) => (state = next),
  }
}

const manual = (text: string, floor = 2) => ({ buildingId: 'torre-central', floor, text })

// --- Cola -----------------------------------------------------------------

describe('cola: procesamiento secuencial', () => {
  it('procesa los avisos de uno en uno y nunca hay dos propose en curso', async () => {
    const engine = fakeEngine(() => ok())
    const t = setup(engine)
    await t.queue.submitManualReport(manual('uno', 1))
    await t.queue.submitManualReport(manual('dos', 2))
    await t.queue.submitManualReport(manual('tres', 3))
    expect(engine.calls).toBe(3)
    expect(engine.maxInFlight).toBe(1)
    expect(Object.values(t.get().reports).every((r) => r.status === 'done')).toBe(true)
    expect(Object.keys(t.get().incidents)).toHaveLength(3)
    expect(t.ui.running).toBe(false)
  })

  it('procesa en orden de seq, y varios encolados a la vez, con un solo drain', async () => {
    const engine = fakeEngine(() => ok())
    const t = setup(engine)
    let s = t.get()
    const made = ['a', 'b', 'c'].map((id, i) => {
      const m = createReport(s, { id, buildingId: 'torre-central', floor: i, text: id, createdAt: 0 })
      s = m.state
      return m.report
    })
    t.set(enqueueReports(s, made))
    await t.queue.drain()
    expect(engine.seen).toEqual(['a', 'b', 'c'])
  })

  it('un aviso encolado durante el procesamiento se procesa en el mismo drain()', async () => {
    const gate = deferred<TriageResult>()
    const engine = fakeEngine((_, call) => (call === 1 ? gate.promise : ok({ protocolId: 'evac-plan' })))
    const t = setup(engine)

    const first = t.queue.submitManualReport(manual('primero', 1))
    await Promise.resolve()
    expect(t.ui.running).toBe(true)
    // Mientras el primero está en el motor, llega otro: no abre un segundo bucle.
    await t.queue.submitManualReport(manual('segundo', 2))
    expect(engine.calls).toBe(1)

    gate.resolve(ok())
    await first
    expect(engine.calls).toBe(2)
    expect(engine.maxInFlight).toBe(1)
    expect(Object.values(t.get().reports).map((r) => r.status)).toEqual(['done', 'done'])
    expect(t.ui.running).toBe(false)
  })

  it('un error deja el aviso en error y la cola sigue con el siguiente', async () => {
    const engine = fakeEngine((_, call) => (call === 1 ? fail('timeout') : ok()))
    const t = setup(engine)
    let s = t.get()
    const made = ['a', 'b'].map((id, i) => {
      const m = createReport(s, { id, buildingId: 'torre-central', floor: i, text: id, createdAt: 0 })
      s = m.state
      return m.report
    })
    t.set(enqueueReports(s, made))
    await t.queue.drain()
    expect(t.get().reports.a).toMatchObject({ status: 'error', errorKind: 'timeout' })
    expect(t.get().reports.b!.status).toBe('done')
    expect(engine.calls).toBe(2)
  })

  it('un error de la IA de cualquier tipo se guarda tal cual en el aviso', async () => {
    for (const kind of ['rate_limit', 'invalid_output', 'invalid_ref', 'network', 'server', 'invalid_input'] as const) {
      const t = setup(fakeEngine(() => fail(kind)))
      await t.queue.submitManualReport(manual('x'))
      expect(Object.values(t.get().reports)[0]).toMatchObject({ status: 'error', errorKind: kind })
    }
  })

  it('si propose lanza una excepción, el aviso queda en error «server» y la cola sigue', async () => {
    const engine = fakeEngine((_, call) => {
      if (call === 1) throw new Error('boom')
      return ok()
    })
    const t = setup(engine)
    let s = t.get()
    const made = ['a', 'b'].map((id, i) => {
      const m = createReport(s, { id, buildingId: 'torre-central', floor: i, text: id, createdAt: 0 })
      s = m.state
      return m.report
    })
    t.set(enqueueReports(s, made))
    await t.queue.drain()
    expect(t.get().reports.a).toMatchObject({ status: 'error', errorKind: 'server' })
    expect(t.get().reports.b!.status).toBe('done')
    expect(t.ui.running).toBe(false)
  })

  it('si applyDecision lanza (referencia inexistente), el aviso queda en error «server»', async () => {
    const t = setup(fakeEngine(() => ok({ category: { existingId: 'inventada' } })))
    await t.queue.submitManualReport(manual('x'))
    expect(Object.values(t.get().reports)[0]).toMatchObject({ status: 'error', errorKind: 'server' })
    expect(Object.keys(t.get().incidents)).toHaveLength(0)
  })

  it('«Procesando» nunca queda atascado tras un drain', async () => {
    const t = setup(fakeEngine((_, call) => (call % 2 ? fail('server') : ok())))
    for (let i = 0; i < 4; i++) await t.queue.submitManualReport(manual(`t${i}`, i))
    expect(Object.values(t.get().reports).some((r) => r.status === 'processing')).toBe(false)
  })
})

describe('cola: contraseña', () => {
  it('sin contraseña en modo IA, se detiene antes de llamar y abre el diálogo', async () => {
    const engine = fakeEngine(() => ok())
    const t = setup(engine, { password: null })
    await t.queue.submitManualReport(manual('x'))
    expect(engine.calls).toBe(0)
    expect(t.ui.prompt).toEqual({ rejected: false })
    expect(Object.values(t.get().reports)[0]!.status).toBe('queued')
    expect(t.ui.running).toBe(false)
  })

  it('al introducir la contraseña, la cola continúa sin perder ningún aviso', async () => {
    const engine = fakeEngine(() => ok())
    const t = setup(engine, { password: null })
    await t.queue.submitManualReport(manual('a', 1))
    await t.queue.submitManualReport(manual('b', 2))
    expect(engine.calls).toBe(0)
    await t.queue.submitPassword('buena')
    expect(t.ui.password).toBe('buena')
    expect(t.ui.prompt).toBeNull()
    expect(engine.calls).toBe(2)
    expect(Object.values(t.get().reports).every((r) => r.status === 'done')).toBe(true)
  })

  it('ante unauthorized, el aviso vuelve a la cola en su posición y la cola se detiene', async () => {
    const engine = fakeEngine(() => fail('unauthorized'))
    const t = setup(engine)
    let s = t.get()
    const made = ['a', 'b', 'c'].map((id, i) => {
      const m = createReport(s, { id, buildingId: 'torre-central', floor: i, text: id, createdAt: 0 })
      s = m.state
      return m.report
    })
    t.set(enqueueReports(s, made))
    await t.queue.drain()

    expect(engine.calls).toBe(1) // no sigue con los demás
    expect(t.get().reports.a).toMatchObject({ status: 'queued', seq: 1, errorKind: null })
    expect(queueOrder(t.get()).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(t.ui.password).toBeNull()
    expect(t.ui.prompt).toEqual({ rejected: true })
    expect(t.ui.running).toBe(false)
  })

  it('tras un unauthorized, una contraseña correcta reanuda sin perder avisos ni orden', async () => {
    let authorized = false
    const engine = fakeEngine(() => (authorized ? ok() : fail('unauthorized')))
    const t = setup(engine)
    let s = t.get()
    const made = ['a', 'b'].map((id, i) => {
      const m = createReport(s, { id, buildingId: 'torre-central', floor: i, text: id, createdAt: 0 })
      s = m.state
      return m.report
    })
    t.set(enqueueReports(s, made))
    await t.queue.drain()
    expect(t.ui.prompt).toEqual({ rejected: true })
    expect(queueOrder(t.get()).map((r) => r.id)).toEqual(['a', 'b'])
    authorized = true
    await t.queue.submitPassword('correcta')
    expect(Object.values(t.get().reports).every((r) => r.status === 'done')).toBe(true)
    expect(engine.seen).toEqual(['a', 'a', 'b']) // «a» se rechazó y se reprocesó primero
    expect(t.ui.prompt).toBeNull()
  })

  it('en modo sin API no pide contraseña', async () => {
    const engine = fakeEngine(() => ok())
    const t = setup(engine, { mode: 'fallback', password: null })
    await t.queue.startBurst()
    expect(t.ui.prompt).toBeNull()
    expect(engine.calls).toBe(9)
  })

  it('una contraseña vacía se ignora', async () => {
    const t = setup(fakeEngine(() => ok()), { password: null })
    await t.queue.submitPassword('')
    expect(t.ui.password).toBeNull()
  })
})

describe('cola: reintento, ráfaga y avisos manuales', () => {
  it('retry vuelve a procesar el aviso después de los que ya estaban en cola', async () => {
    const gate = deferred<TriageResult>()
    const engine = fakeEngine((_, call) => {
      if (call === 1) return fail('rate_limit') // «a» falla
      if (call === 2) return gate.promise // «b» se queda en el motor
      return ok() // el reintento de «a»
    })
    const t = setup(engine)
    await t.queue.submitManualReport(manual('a', 1))
    const failedId = Object.keys(t.get().reports)[0]!
    expect(t.get().reports[failedId]!.status).toBe('error')

    // Mientras «b» está en el motor, se reintenta «a»: queda en cola, detrás de «b».
    const first = t.queue.submitManualReport(manual('b', 2))
    await Promise.resolve()
    await t.queue.retry(failedId)
    expect(t.get().reports[failedId]).toMatchObject({ status: 'queued', errorKind: null, seq: 3 })

    gate.resolve(ok())
    await first
    expect(engine.seen).toEqual([failedId, expect.not.stringMatching(failedId), failedId])
    expect(engine.calls).toBe(3)
    expect(t.get().reports[failedId]!.status).toBe('done')
  })

  it('retry no hace nada con avisos que no están en error o con invalid_input', async () => {
    const t = setup(fakeEngine(() => fail('invalid_input')))
    await t.queue.submitManualReport(manual('a'))
    const id = Object.keys(t.get().reports)[0]!
    const before = t.get()
    await t.queue.retry(id)
    expect(t.get()).toBe(before)
    await t.queue.retry('no-existe')
    expect(t.get()).toBe(before)
  })

  it('startBurst encola los 9 avisos del guion y los procesa con una pausa por aviso', async () => {
    const engine = fakeEngine(() => ok())
    const t = setup(engine)
    await t.queue.startBurst()
    const reports = Object.values(t.get().reports).sort((a, b) => a.seq - b.seq)
    expect(reports.map((r) => r.scriptKey)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'])
    expect(t.get().burstStartSeq).toBe(1)
    expect(engine.calls).toBe(9)
    expect(t.sleeps).toEqual(Array(9).fill(BURST_PAUSE_MS))
    expect(burstProgress(t.get())).toEqual({ done: 9, total: 9 })
  })

  it('startBurst no hace nada mientras la cola procesa', async () => {
    const gate = deferred<TriageResult>()
    const engine = fakeEngine(() => gate.promise)
    const t = setup(engine)
    const first = t.queue.submitManualReport(manual('a'))
    await Promise.resolve()
    await t.queue.startBurst()
    expect(Object.keys(t.get().reports)).toHaveLength(1)
    gate.resolve(ok())
    await first
  })

  it('en modo sin API, startBurst solo vale con el tablero vacío', async () => {
    const engine = fakeEngine(() => ok())
    const t = setup(engine, { mode: 'fallback' })
    const made = createReport(t.get(), { id: 'x', buildingId: 'torre-central', floor: 1, text: 'x', createdAt: 0 })
    t.set(markError(markProcessing(enqueueReports(made.state, [made.report]), 'x'), 'x', 'server'))
    await t.queue.startBurst()
    expect(Object.keys(t.get().reports)).toEqual(['x'])
    expect(engine.calls).toBe(0)
  })

  it('en modo IA, startBurst vale aunque el tablero tenga avisos', async () => {
    const t = setup(fakeEngine(() => ok()))
    await t.queue.submitManualReport(manual('previo'))
    await t.queue.startBurst()
    expect(Object.keys(t.get().reports)).toHaveLength(10)
  })

  it('un aviso manual se valida: texto, edificio y planta, y no vale en modo sin API', async () => {
    const t = setup(fakeEngine(() => ok()))
    await t.queue.submitManualReport(manual('   '))
    await t.queue.submitManualReport(manual('x'.repeat(501)))
    await t.queue.submitManualReport({ buildingId: 'no-existe', floor: 1, text: 'x' })
    await t.queue.submitManualReport(manual('x', 99))
    expect(Object.keys(t.get().reports)).toHaveLength(0)

    await t.queue.submitManualReport(manual('  con espacios  '))
    expect(Object.values(t.get().reports)[0]!.text).toBe('con espacios')

    const f = setup(fakeEngine(() => ok()), { mode: 'fallback' })
    await f.queue.submitManualReport(manual('x'))
    expect(Object.keys(f.get().reports)).toHaveLength(0)
  })
})

// --- Motor de IA ----------------------------------------------------------

describe('createLlmEngine', () => {
  const input = (): TriageInput => {
    const made = createReport(createInitialState(), { id: 'r', buildingId: 'torre-central', floor: 2, text: 'x', createdAt: 0 })
    return { report: made.report, contextIncidents: [], categories: [] }
  }

  it('envía la contraseña y el contexto a la Server Function y devuelve su resultado', async () => {
    let sent: unknown
    const engine = createLlmEngine(() => 'pw', async (args) => {
      sent = args
      return ok()
    })
    const result = await engine.propose(input())
    expect(result.ok).toBe(true)
    expect(sent).toMatchObject({ data: { password: 'pw', report: { id: 'r' }, contextIncidents: [], categories: [] } })
  })

  it('sin contraseña envía una cadena vacía', async () => {
    let sent: { data: { password: string } } | undefined
    const engine = createLlmEngine(() => null, async (args) => {
      sent = args as never
      return fail('unauthorized')
    })
    expect(await engine.propose(input())).toEqual({ ok: false, error: 'unauthorized' })
    expect(sent!.data.password).toBe('')
  })

  it('un fallo de red es network', async () => {
    const engine = createLlmEngine(() => 'pw', async () => {
      throw new TypeError('fetch failed')
    })
    expect(await engine.propose(input())).toEqual({ ok: false, error: 'network' })
  })
})

// --- Store ----------------------------------------------------------------

describe('store', () => {
  function makeStore(responder: () => Promise<TriageResult> | TriageResult = () => ok()) {
    const calls: unknown[] = []
    let n = 0
    return {
      calls,
      ...createTriageStore({
        call: async (args) => {
          calls.push(args)
          return responder()
        },
        fallbackEngine: () => ({ propose: async () => ok() }),
        sleep: async () => {},
        uuid: () => `u${++n}`,
        now: () => 1000,
      }),
    }
  }

  it('empieza vacío, en modo IA, sin contraseña ni diálogo', () => {
    const { useTriageStore } = makeStore()
    const s = useTriageStore.getState()
    expect(s.state.mode).toBe('llm')
    expect(s.running).toBe(false)
    expect(s.demoPassword).toBeNull()
    expect(s.passwordPrompt).toBeNull()
  })

  it('flujo completo: aviso, diálogo de contraseña, contraseña y decisión aplicada', async () => {
    const { useTriageStore, triageActions, calls } = makeStore()
    await triageActions.submitManualReport(manual('Huele a humo'))
    expect(useTriageStore.getState().passwordPrompt).toEqual({ rejected: false })
    expect(calls).toHaveLength(0)

    await triageActions.setPassword('mi-clave')
    const s = useTriageStore.getState()
    expect(s.passwordPrompt).toBeNull()
    expect(s.demoPassword).toBe('mi-clave')
    expect(calls).toHaveLength(1)
    expect((calls[0] as { data: { password: string } }).data.password).toBe('mi-clave')
    expect(Object.values(s.state.incidents)).toHaveLength(1)
    expect(s.running).toBe(false)
  })

  it('«Reiniciar» conserva el modo y la contraseña y cierra el diálogo', async () => {
    const { useTriageStore, triageActions } = makeStore()
    await triageActions.setPassword('pw')
    await triageActions.submitManualReport(manual('x'))
    useTriageStore.setState({ passwordPrompt: { rejected: true } })
    triageActions.resetDemo()
    const s = useTriageStore.getState()
    expect(Object.keys(s.state.reports)).toHaveLength(0)
    expect(s.state.mode).toBe('llm')
    expect(s.demoPassword).toBe('pw')
    expect(s.passwordPrompt).toBeNull()
    expect(s.state.nextSeq).toBe(1)

    triageActions.setMode('fallback')
    triageActions.resetDemo()
    expect(useTriageStore.getState().state.mode).toBe('fallback')
  })

  it('el modo solo cambia con el tablero vacío', async () => {
    const { useTriageStore, triageActions } = makeStore()
    await triageActions.setPassword('pw')
    triageActions.setMode('fallback')
    expect(useTriageStore.getState().state.mode).toBe('fallback')
    triageActions.setMode('llm')
    await triageActions.startBurst()
    triageActions.setMode('fallback')
    expect(useTriageStore.getState().state.mode).toBe('llm') // el tablero ya tiene avisos
  })

  it('mientras la cola procesa, las acciones del operador no hacen nada', async () => {
    const gate = deferred<TriageResult>()
    let n = 0
    const store = makeStore(() => (n++ === 0 ? ok() : gate.promise))
    const { useTriageStore, triageActions } = store
    await triageActions.setPassword('pw')
    await triageActions.submitManualReport(manual('a', 1))
    const incidentId = Object.keys(useTriageStore.getState().state.incidents)[0]!

    const pending = triageActions.submitManualReport(manual('b', 2)) // queda en el motor
    await Promise.resolve()
    expect(useTriageStore.getState().running).toBe(true)

    triageActions.validateIncident(incidentId)
    triageActions.discardIncident(incidentId)
    triageActions.editIncident(incidentId, { summary: 'a mano' })
    triageActions.approveCategory('no-existe')
    triageActions.resetDemo()
    triageActions.setMode('fallback')
    const during = useTriageStore.getState().state
    expect(during.incidents[incidentId]).toMatchObject({ state: 'pending' })
    expect(during.incidents[incidentId]!.locks.summary).toBe(false)
    expect(Object.keys(during.reports)).toHaveLength(2) // el reinicio no se aplicó
    expect(during.mode).toBe('llm')

    // «Enviar aviso» sí sigue activo, porque solo añade a la cola.
    await triageActions.submitManualReport(manual('c', 3))
    expect(Object.keys(useTriageStore.getState().state.reports)).toHaveLength(3)

    gate.resolve(ok())
    await pending
    expect(useTriageStore.getState().running).toBe(false)

    // Con la cola parada, las acciones vuelven a funcionar.
    triageActions.validateIncident(incidentId)
    expect(useTriageStore.getState().state.incidents[incidentId]!.state).toBe('validated')
  })
})
