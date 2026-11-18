import type {
  Category,
  Incident,
  IncidentState,
  Report,
  TriageInput,
  TriageState,
} from './types'

export const BURST_SIZE = 9

// Avisos de un incidente, por `seq`. De aquí salen el contador y la hora del último aviso.
export function reportsOf(state: TriageState, incidentId: string): Report[] {
  return Object.values(state.reports)
    .filter((r) => r.incidentId === incidentId)
    .sort((a, b) => a.seq - b.seq)
}

// Avisos en cola, por `seq`.
export function queueOrder(state: TriageState): Report[] {
  return Object.values(state.reports)
    .filter((r) => r.status === 'queued')
    .sort((a, b) => a.seq - b.seq)
}

// Categorías oficiales más las no oficiales que usa algún incidente.
export function visibleCategories(state: TriageState): Category[] {
  const used = new Set(Object.values(state.incidents).map((i) => i.categoryId))
  return Object.values(state.categories).filter((c) => c.official || used.has(c.id))
}

export function incidentsByState(
  state: TriageState,
  incidentState: IncidentState,
): Incident[] {
  return Object.values(state.incidents)
    .filter((i) => i.state === incidentState)
    .sort((a, b) => a.number - b.number)
}

export function isBoardEmpty(state: TriageState): boolean {
  return Object.keys(state.reports).length === 0
}

// Avisos de la última ráfaga que ya no están en cola ni procesándose, sobre 9.
// Se limita a 9 porque «Reintentar» cambia el `seq` de un aviso.
export function burstProgress(state: TriageState): { done: number; total: number } {
  if (state.burstStartSeq === null) return { done: 0, total: BURST_SIZE }
  const start = state.burstStartSeq
  const done = Object.values(state.reports).filter(
    (r) =>
      r.scriptKey !== null &&
      r.seq >= start &&
      r.status !== 'queued' &&
      r.status !== 'processing',
  ).length
  return { done: Math.min(done, BURST_SIZE), total: BURST_SIZE }
}

// Contexto para la IA: el aviso, todos los incidentes de su edificio con sus
// avisos, y el catálogo de categorías completo.
export function buildTriageInput(state: TriageState, reportId: string): TriageInput {
  const report = state.reports[reportId]
  if (!report) throw new Error(`El aviso ${reportId} no existe`)
  const contextIncidents = Object.values(state.incidents)
    .filter((i) => i.buildingId === report.buildingId)
    .sort((a, b) => a.number - b.number)
    .map((incident) => ({ incident, reports: reportsOf(state, incident.id) }))
  return {
    report,
    contextIncidents,
    categories: Object.values(state.categories),
  }
}
