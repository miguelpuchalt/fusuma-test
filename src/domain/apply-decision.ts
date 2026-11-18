import { PROTOCOL_IDS } from '../data/protocols'
import { canJoin, canRelate, findCategoryByName, maxSeverity } from './rules'
import type { Category, Incident, TriageDecision, TriageState } from './types'

const MAX_SUMMARY = 300
const MAX_RATIONALE = 200
const MAX_CATEGORY_NAME = 40
const NOT_ADMITTED_RATIONALE =
  'Incidente nuevo: el incidente propuesto no admitía este aviso.'

export type ApplyDecisionInput = {
  reportId: string
  decision: TriageDecision
  newIncidentId: string
  newCategoryId: string
}

export type ApplyDecisionResult = {
  state: TriageState
  createdCategory: Category | null
}

// Función pura y única comprobación que manda sobre qué cambia en el estado.
// Los IDs nuevos llegan como datos; `seq` e `INC-n` salen de los contadores.
export function applyDecision(
  state: TriageState,
  { reportId, decision, newIncidentId, newCategoryId }: ApplyDecisionInput,
): ApplyDecisionResult {
  // Regla 1: un aviso que no existe o que no está procesándose no cambia nada.
  const report = state.reports[reportId]
  if (!report || report.status !== 'processing') {
    return { state, createdCategory: null }
  }
  // Precondiciones del servidor (invariante 6). Si fallan es un error de programación;
  // la cola lo convierte en un error «server» del aviso.
  if (!PROTOCOL_IDS.includes(decision.protocolId)) {
    throw new Error(`Protocolo inexistente: ${decision.protocolId}`)
  }

  const target = decision.targetIncidentId
    ? state.incidents[decision.targetIncidentId]
    : undefined

  // Regla 2: `join` a un destino con `canJoin`.
  if (decision.action === 'join' && target && canJoin(target, report)) {
    let categories = state.categories
    let categoryId = target.categoryId
    let createdCategory: Category | null = null
    // Con la categoría bloqueada no se resuelve ni se crea la categoría propuesta.
    if (!target.locks.category) {
      const resolved = resolveCategory(state, decision, newCategoryId)
      categoryId = resolved.category.id
      createdCategory = resolved.created
      if (resolved.created) {
        categories = { ...categories, [resolved.created.id]: resolved.created }
      }
    }
    const updated: Incident = {
      ...target,
      categoryId,
      severity: target.locks.severity
        ? target.severity
        : maxSeverity(target.severity, decision.severity),
      protocolId: target.locks.protocol ? target.protocolId : decision.protocolId,
      summary: target.locks.summary
        ? target.summary
        : decision.summary.slice(0, MAX_SUMMARY),
      rationale: decision.rationale.slice(0, MAX_RATIONALE), // siempre
      // La relación del destino no cambia.
    }
    return {
      state: {
        ...state,
        categories,
        incidents: { ...state.incidents, [target.id]: updated },
        reports: {
          ...state.reports,
          [report.id]: { ...report, status: 'done', errorKind: null, incidentId: target.id },
        },
      },
      createdCategory,
    }
  }

  // Reglas 3 y 4: incidente nuevo.
  const isFailedJoin = decision.action === 'join'
  // Un `join` sin destino válido se relaciona con el destino si existe y tiene `canRelate`.
  const relatedCandidate = isFailedJoin
    ? target
    : decision.relatedIncidentId
      ? state.incidents[decision.relatedIncidentId]
      : undefined
  const relatedIncidentId =
    relatedCandidate && canRelate(relatedCandidate, report) ? relatedCandidate.id : null

  // Regla 5: categoría nueva (se reutiliza si el nombre normalizado ya existe).
  const resolved = resolveCategory(state, decision, newCategoryId)
  const categories = resolved.created
    ? { ...state.categories, [resolved.created.id]: resolved.created }
    : state.categories

  const incident: Incident = {
    id: newIncidentId,
    number: state.nextIncidentNumber,
    buildingId: report.buildingId,
    floor: report.floor,
    categoryId: resolved.category.id,
    severity: decision.severity,
    protocolId: decision.protocolId,
    summary: (isFailedJoin ? report.text : decision.summary).slice(0, MAX_SUMMARY),
    rationale: (isFailedJoin ? NOT_ADMITTED_RATIONALE : decision.rationale).slice(
      0,
      MAX_RATIONALE,
    ),
    state: 'pending',
    relatedIncidentId,
    locks: { category: false, severity: false, protocol: false, summary: false },
  }

  // Regla 6: el aviso pasa a `done`.
  return {
    state: {
      ...state,
      nextIncidentNumber: state.nextIncidentNumber + 1,
      categories,
      incidents: { ...state.incidents, [incident.id]: incident },
      reports: {
        ...state.reports,
        [report.id]: { ...report, status: 'done', errorKind: null, incidentId: incident.id },
      },
    },
    createdCategory: resolved.created,
  }
}

function resolveCategory(
  state: TriageState,
  decision: TriageDecision,
  newCategoryId: string,
): { category: Category; created: Category | null } {
  if ('existingId' in decision.category) {
    const existing = state.categories[decision.category.existingId]
    if (!existing) {
      throw new Error(`Categoría inexistente: ${decision.category.existingId}`)
    }
    return { category: existing, created: null }
  }
  const name = decision.category.newName.trim().slice(0, MAX_CATEGORY_NAME)
  if (name === '') throw new Error('El nombre de la categoría nueva está vacío')
  const equivalent = findCategoryByName(Object.values(state.categories), name)
  if (equivalent) return { category: equivalent, created: null }
  const created: Category = { id: newCategoryId, name, official: false }
  return { category: created, created }
}
