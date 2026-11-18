import { INITIAL_CATEGORIES } from '../data/categories'
import { PROTOCOL_IDS } from '../data/protocols'
import { visibleCategories } from './selectors'
import type {
  Incident,
  Mode,
  Report,
  ReportErrorKind,
  Severity,
  TriageState,
} from './types'

// Todas las acciones son funciones puras: devuelven un estado nuevo, o el mismo
// si la acción no procede.

// «Reiniciar» conserva el modo: el store pasa el modo actual.
export function createInitialState(mode: Mode = 'llm'): TriageState {
  return {
    mode,
    nextSeq: 1,
    nextIncidentNumber: 1,
    burstStartSeq: null,
    reports: {},
    incidents: {},
    categories: Object.fromEntries(INITIAL_CATEGORIES.map((c) => [c.id, c])),
  }
}

export type NewReportInput = {
  id: string
  buildingId: string
  floor: number
  text: string
  createdAt: number
  scriptKey?: string | null
}

// Asigna `seq` y avanza el contador. El aviso no entra en el estado hasta `enqueueReports`.
export function createReport(
  state: TriageState,
  input: NewReportInput,
): { state: TriageState; report: Report } {
  const report: Report = {
    id: input.id,
    seq: state.nextSeq,
    buildingId: input.buildingId,
    floor: input.floor,
    text: input.text,
    createdAt: input.createdAt,
    status: 'queued',
    errorKind: null,
    incidentId: null,
    scriptKey: input.scriptKey ?? null,
  }
  return { state: { ...state, nextSeq: state.nextSeq + 1 }, report }
}

// Con `burst`, los avisos son una ráfaga y `burstStartSeq` pasa a ser el menor `seq`.
export function enqueueReports(
  state: TriageState,
  reports: Report[],
  burst = false,
): TriageState {
  if (reports.length === 0) return state
  const added = Object.fromEntries(
    reports.map((r) => [r.id, { ...r, status: 'queued' as const }]),
  )
  return {
    ...state,
    burstStartSeq: burst ? Math.min(...reports.map((r) => r.seq)) : state.burstStartSeq,
    reports: { ...state.reports, ...added },
  }
}

export function markProcessing(state: TriageState, reportId: string): TriageState {
  return updateReport(state, reportId, (r) =>
    r.status === 'queued' ? { ...r, status: 'processing' } : r,
  )
}

export function markError(
  state: TriageState,
  reportId: string,
  kind: ReportErrorKind,
): TriageState {
  return updateReport(state, reportId, (r) =>
    r.status === 'processing' ? { ...r, status: 'error', errorKind: kind } : r,
  )
}

// Vuelve a la cola con un `seq` nuevo, al final. `invalid_input` no se puede reintentar.
export function retryReport(state: TriageState, reportId: string): TriageState {
  const report = state.reports[reportId]
  if (!report || report.status !== 'error' || report.errorKind === 'invalid_input') {
    return state
  }
  return {
    ...state,
    nextSeq: state.nextSeq + 1,
    reports: {
      ...state.reports,
      [reportId]: { ...report, status: 'queued', errorKind: null, seq: state.nextSeq },
    },
  }
}

// Vuelve a la cola conservando su `seq` (contraseña rechazada).
export function returnToQueue(state: TriageState, reportId: string): TriageState {
  return updateReport(state, reportId, (r) =>
    r.status === 'processing' ? { ...r, status: 'queued' } : r,
  )
}

export type IncidentEdit = Partial<{
  categoryId: string
  severity: Severity
  protocolId: string
  summary: string
}>

// Cada campo editado queda bloqueado. Solo sobre incidentes `pending`. Un valor
// que no existe (categoría no visible, protocolo desconocido) se rechaza sin cambiar nada.
export function editIncident(
  state: TriageState,
  incidentId: string,
  edit: IncidentEdit,
): TriageState {
  const incident = state.incidents[incidentId]
  if (!incident || incident.state !== 'pending') return state
  const next: Incident = { ...incident, locks: { ...incident.locks } }

  if (edit.categoryId !== undefined) {
    if (!visibleCategories(state).some((c) => c.id === edit.categoryId)) return state
    next.categoryId = edit.categoryId
    next.locks.category = true
  }
  if (edit.protocolId !== undefined) {
    if (!PROTOCOL_IDS.includes(edit.protocolId)) return state
    next.protocolId = edit.protocolId
    next.locks.protocol = true
  }
  if (edit.severity !== undefined) {
    next.severity = edit.severity
    next.locks.severity = true
  }
  if (edit.summary !== undefined) {
    next.summary = edit.summary.slice(0, 300)
    next.locks.summary = true
  }
  return { ...state, incidents: { ...state.incidents, [incidentId]: next } }
}

export function validateIncident(state: TriageState, incidentId: string): TriageState {
  return setIncidentState(state, incidentId, 'validated')
}

export function discardIncident(state: TriageState, incidentId: string): TriageState {
  return setIncidentState(state, incidentId, 'discarded')
}

// Cambia el catálogo, no los incidentes.
export function approveCategory(state: TriageState, categoryId: string): TriageState {
  const category = state.categories[categoryId]
  if (!category || category.official) return state
  return {
    ...state,
    categories: { ...state.categories, [categoryId]: { ...category, official: true } },
  }
}

function setIncidentState(
  state: TriageState,
  incidentId: string,
  to: 'validated' | 'discarded',
): TriageState {
  const incident = state.incidents[incidentId]
  if (!incident || incident.state !== 'pending') return state
  return {
    ...state,
    incidents: { ...state.incidents, [incidentId]: { ...incident, state: to } },
  }
}

function updateReport(
  state: TriageState,
  reportId: string,
  change: (r: Report) => Report,
): TriageState {
  const report = state.reports[reportId]
  if (!report) return state
  const updated = change(report)
  if (updated === report) return state
  return { ...state, reports: { ...state.reports, [reportId]: updated } }
}
