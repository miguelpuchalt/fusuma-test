import { create } from 'zustand'
import {
  approveCategory as approveCategoryDomain,
  createInitialState,
  discardIncident as discardIncidentDomain,
  editIncident as editIncidentDomain,
  validateIncident as validateIncidentDomain,
  type IncidentEdit,
} from '../domain/actions'
import { isBoardEmpty } from '../domain/selectors'
import type { Mode, TriageEngine, TriageState } from '../domain/types'
import { createFallbackEngine } from '../engines/fallback-engine'
import { createLlmEngine, type TriageCall } from '../engines/llm-engine'
import {
  createTriageQueue,
  type ManualReport,
  type PasswordPrompt,
} from '../queue/triage-queue'
import { triageReport } from '../server/triage-report'

// Estado del dominio más tres campos de interfaz. Sin persistencia: una recarga empieza de cero.
export type TriageStore = {
  state: TriageState
  running: boolean // la cola está procesando
  demoPassword: string | null // solo en memoria
  passwordPrompt: PasswordPrompt
}

export type TriageStoreDeps = {
  call: TriageCall
  // El motor sin API lee el estado actual para traducir sus avisos ancla a incidentes.
  fallbackEngine: (getState: () => TriageState) => TriageEngine
  sleep(ms: number): Promise<void>
  uuid(): string
  now(): number
}

// Fábrica: la aplicación usa la instancia de abajo; los tests, esta con dependencias falsas.
export function createTriageStore(deps: TriageStoreDeps) {
  const useTriageStore = create<TriageStore>(() => ({
    state: createInitialState('llm'),
    running: false,
    demoPassword: null,
    passwordPrompt: null,
  }))

  const get = () => useTriageStore.getState()
  const patch = (partial: Partial<TriageStore>) => useTriageStore.setState(partial)

  const llmEngine = createLlmEngine(() => get().demoPassword, deps.call)
  const fallbackEngine = deps.fallbackEngine(() => get().state)

  const triageQueue = createTriageQueue({
    getState: () => get().state,
    setState: (state) => patch({ state }),
    getEngine: (mode) => (mode === 'llm' ? llmEngine : fallbackEngine),
    sleep: deps.sleep,
    uuid: deps.uuid,
    now: deps.now,
    ui: {
      isRunning: () => get().running,
      setRunning: (running) => patch({ running }),
      getPassword: () => get().demoPassword,
      setPassword: (demoPassword) => patch({ demoPassword }),
      setPasswordPrompt: (passwordPrompt) => patch({ passwordPrompt }),
    },
  })

  // Mientras la cola procesa, el tablero no cambia por acciones del operador: estas acciones no
  // hacen nada. La interfaz además las desactiva. «Enviar aviso» y «Reintentar» siguen activos,
  // porque solo añaden avisos a la cola.
  const whenIdle = (change: (state: TriageState) => TriageState) => {
    if (get().running) return
    patch({ state: change(get().state) })
  }

  const triageActions = {
    // Solo con el tablero vacío y la cola parada.
    setMode(mode: Mode) {
      if (get().running || !isBoardEmpty(get().state)) return
      patch({ state: { ...get().state, mode } })
    },
    // «Reiniciar» conserva el modo y la contraseña, y cierra el diálogo.
    resetDemo() {
      if (get().running) return
      patch({ state: createInitialState(get().state.mode), passwordPrompt: null })
    },
    setPassword: (password: string) => triageQueue.submitPassword(password),
    editIncident: (incidentId: string, edit: IncidentEdit) =>
      whenIdle((s) => editIncidentDomain(s, incidentId, edit)),
    validateIncident: (incidentId: string) =>
      whenIdle((s) => validateIncidentDomain(s, incidentId)),
    discardIncident: (incidentId: string) =>
      whenIdle((s) => discardIncidentDomain(s, incidentId)),
    approveCategory: (categoryId: string) =>
      whenIdle((s) => approveCategoryDomain(s, categoryId)),
    submitManualReport: (input: ManualReport) => triageQueue.submitManualReport(input),
    startBurst: () => triageQueue.startBurst(),
    retry: (reportId: string) => triageQueue.retry(reportId),
  }

  return { useTriageStore, triageQueue, triageActions }
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const { useTriageStore, triageQueue, triageActions } = createTriageStore({
  call: triageReport,
  fallbackEngine: (getState) => createFallbackEngine(getState, realSleep),
  sleep: realSleep,
  uuid: () => crypto.randomUUID(),
  now: () => Date.now(),
})
