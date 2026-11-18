import { BURST_SCRIPT } from '../data/burst-script'
import { getBuilding } from '../data/buildings'
import {
  createReport,
  enqueueReports,
  markError,
  markProcessing,
  retryReport,
  returnToQueue,
} from '../domain/actions'
import { applyDecision } from '../domain/apply-decision'
import { buildTriageInput, isBoardEmpty, queueOrder } from '../domain/selectors'
import type { Mode, TriageEngine, TriageState } from '../domain/types'

export type PasswordPrompt = { rejected: boolean } | null

// Campos de interfaz que la cola necesita leer o escribir: los guarda el store.
export type QueueUi = {
  isRunning(): boolean
  setRunning(running: boolean): void
  getPassword(): string | null
  setPassword(password: string | null): void
  setPasswordPrompt(prompt: PasswordPrompt): void
}

export type QueueDeps = {
  getState(): TriageState
  setState(next: TriageState): void
  getEngine(mode: Mode): TriageEngine
  sleep(ms: number): Promise<void>
  uuid(): string
  now(): number
  ui: QueueUi
}

export type ManualReport = { buildingId: string; floor: number; text: string }

export const MAX_REPORT_TEXT = 500
// Pausa entre avisos de una ráfaga, para que se vea cómo se van procesando.
export const BURST_PAUSE_MS = 300

// Cola secuencial: módulo de TypeScript sin React, con el store y los motores inyectados.
export function createTriageQueue(deps: QueueDeps) {
  const { getState, setState, getEngine, sleep, uuid, now, ui } = deps

  // Procesa los avisos en cola de uno en uno. Si ya hay un bucle en marcha, sale: el bucle en
  // curso recogerá los avisos nuevos, porque entre la última comprobación de la cola y el
  // `finally` no hay ningún `await`.
  async function drain(): Promise<void> {
    if (ui.isRunning()) return
    ui.setRunning(true)
    try {
      while (queueOrder(getState()).length > 0) {
        const s = getState()
        const report = queueOrder(s)[0]!

        if (s.mode === 'llm' && !ui.getPassword()) {
          ui.setPasswordPrompt({ rejected: false })
          break
        }

        setState(markProcessing(s, report.id))
        try {
          const result = await getEngine(s.mode).propose(
            buildTriageInput(getState(), report.id),
          )
          if (result.ok) {
            const applied = applyDecision(getState(), {
              reportId: report.id,
              decision: result.decision,
              newIncidentId: uuid(),
              newCategoryId: uuid(),
            })
            setState(applied.state)
          } else if (result.error === 'unauthorized') {
            setState(returnToQueue(getState(), report.id))
            ui.setPassword(null)
            ui.setPasswordPrompt({ rejected: true })
            break
          } else {
            setState(markError(getState(), report.id, result.error)) // la cola sigue
          }
        } catch {
          // Un fallo del cliente (motor, contexto o applyDecision) no deja el aviso en «Procesando».
          setState(markError(getState(), report.id, 'server'))
        }

        if (report.scriptKey) await sleep(BURST_PAUSE_MS)
      }
    } finally {
      ui.setRunning(false)
    }
  }

  // Aviso escrito por el operador. En modo sin API no hay respuestas pregrabadas para él.
  function submitManualReport(input: ManualReport): Promise<void> {
    const text = input.text.trim()
    const building = getBuilding(input.buildingId)
    const valid =
      getState().mode === 'llm' &&
      text.length >= 1 &&
      text.length <= MAX_REPORT_TEXT &&
      building !== undefined &&
      building.floors.includes(input.floor)
    if (!valid) return Promise.resolve()

    const made = createReport(getState(), {
      id: uuid(),
      buildingId: input.buildingId,
      floor: input.floor,
      text,
      createdAt: now(),
    })
    setState(enqueueReports(made.state, [made.report]))
    return drain()
  }

  // Encola los 9 avisos del guion. No se lanza mientras la cola procesa; en modo sin API,
  // solo con el tablero vacío.
  function startBurst(): Promise<void> {
    const s = getState()
    if (ui.isRunning()) return Promise.resolve()
    if (s.mode === 'fallback' && !isBoardEmpty(s)) return Promise.resolve()

    let next = s
    const reports = BURST_SCRIPT.map((entry) => {
      const made = createReport(next, {
        id: uuid(),
        buildingId: entry.buildingId,
        floor: entry.floor,
        text: entry.text,
        createdAt: now(),
        scriptKey: entry.key,
      })
      next = made.state
      return made.report
    })
    setState(enqueueReports(next, reports, true))
    return drain()
  }

  // «Reintentar»: el aviso vuelve al final de la cola.
  function retry(reportId: string): Promise<void> {
    const before = getState()
    const after = retryReport(before, reportId)
    if (after === before) return Promise.resolve()
    setState(after)
    return drain()
  }

  // Contraseña introducida en el diálogo: se guarda, se cierra el diálogo y se reanuda la cola.
  function submitPassword(password: string): Promise<void> {
    if (password.length === 0) return Promise.resolve()
    ui.setPassword(password)
    ui.setPasswordPrompt(null)
    return drain()
  }

  return { drain, submitManualReport, startBurst, retry, submitPassword }
}

export type TriageQueue = ReturnType<typeof createTriageQueue>
