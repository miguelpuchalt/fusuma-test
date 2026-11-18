// Tipos del Technical Plan §2, más los del contrato entre cola, motores y servidor.

export type Severity = 'low' | 'medium' | 'high' | 'critical' // low < medium < high < critical
export type IncidentState = 'pending' | 'validated' | 'discarded'
export type Mode = 'llm' | 'fallback'

export type ReportErrorKind =
  | 'rate_limit'
  | 'timeout'
  | 'invalid_input'
  | 'invalid_output'
  | 'invalid_ref'
  | 'network'
  | 'server'
// «unauthorized» nunca se guarda en un aviso.
export type TriageErrorKind = ReportErrorKind | 'unauthorized'

export type ReportStatus = 'queued' | 'processing' | 'done' | 'error'

export type Report = {
  id: string
  seq: number // orden de cola, feed y lista de avisos; «Reintentar» asigna uno nuevo (al final)
  buildingId: string
  floor: number
  text: string // 1..500 caracteres
  createdAt: number // solo para mostrar la hora
  status: ReportStatus
  errorKind: ReportErrorKind | null
  incidentId: string | null // ÚNICA relación aviso→incidente
  scriptKey: string | null // "S1".."S9" si viene de la ráfaga
}

export type Locks = {
  category: boolean
  severity: boolean
  protocol: boolean
  summary: boolean
}

export type Incident = {
  id: string
  number: number // etiqueta estable «INC-n», asignada al crearlo
  buildingId: string
  floor: number // la del primer aviso; no cambia
  categoryId: string
  severity: Severity
  protocolId: string
  summary: string // ≤ 300
  rationale: string // ≤ 200; motivo de la última propuesta aplicada
  state: IncidentState
  relatedIncidentId: string | null
  locks: Locks
}

export type Category = {
  id: string
  name: string // ≤ 40
  official: boolean
}

export type TriageState = {
  mode: Mode
  nextSeq: number
  nextIncidentNumber: number
  burstStartSeq: number | null // seq del primer aviso de la última ráfaga (progreso «n/9»)
  reports: Record<string, Report>
  incidents: Record<string, Incident>
  categories: Record<string, Category>
}

// Decisión con IDs reales (ya traducida desde los alias de la IA).
export type TriageDecision = {
  action: 'join' | 'create'
  targetIncidentId: string | null
  relatedIncidentId: string | null
  category: { existingId: string } | { newName: string }
  severity: Severity
  protocolId: string
  summary: string
  rationale: string
}

export type TriageResult =
  | { ok: true; decision: TriageDecision }
  | { ok: false; error: TriageErrorKind }

export type TriageInput = {
  report: Report
  contextIncidents: { incident: Incident; reports: Report[] }[]
  categories: Category[]
}

export interface TriageEngine {
  propose(input: TriageInput): Promise<TriageResult>
}
