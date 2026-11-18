import { z } from 'zod'
import { getBuilding } from '../data/buildings'
import { PROTOCOLS } from '../data/protocols'
import { canJoin, canRelate, findCategoryByName } from '../domain/rules'
import type { TriageDecision, TriageInput } from '../domain/types'

// Contrato con la IA (Technical Plan §4). La IA recibe alias cortos (I1…, C1…, P1…P5),
// nunca IDs reales, y devuelve un objeto plano en el que «sin valor» es `null`.

// Esquema que recibe el SDK. Sin límites de longitud en los textos: los recorta
// `sanitizeDecision`, para que una respuesta algo larga no falle antes de llegar aquí.
export const AiDecisionSchema = z.object({
  action: z.enum(['join', 'create']),
  targetRef: z.string().nullable(),
  relatedRef: z.string().nullable(),
  categoryRef: z.string().nullable(),
  newCategoryName: z.string().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  protocolRef: z.string(),
  summary: z.string(),
  rationale: z.string(),
})

export type AiDecision = z.infer<typeof AiDecisionSchema>

export const MAX_SUMMARY = 300
export const MAX_RATIONALE = 200
export const MAX_CATEGORY_NAME = 40

// ---------------------------------------------------------------------------
// Reglas entre campos (paso 6). Devuelve el motivo del fallo, o `null` si cumple.
// ---------------------------------------------------------------------------
export function checkCrossFieldRules(d: AiDecision): string | null {
  if (d.action === 'join' && isBlank(d.targetRef)) {
    return 'join exige targetRef'
  }
  const hasRef = !isBlank(d.categoryRef)
  const hasName = !isBlank(d.newCategoryName)
  if (hasRef === hasName) {
    return 'exactamente uno de categoryRef o newCategoryName'
  }
  return null
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim() === ''
}

// ---------------------------------------------------------------------------
// Alias (paso 4)
// ---------------------------------------------------------------------------
export type Aliases = {
  incidents: Record<string, string> // «I1» → ID real
  categories: Record<string, string> // «C1» → ID real
  protocols: Record<string, string> // «P1» → ID real
  incidentAlias: Record<string, string> // ID real → «I1»
  categoryAlias: Record<string, string>
  protocolAlias: Record<string, string>
}

function aliasMaps(prefix: string, ids: string[]) {
  const toId: Record<string, string> = {}
  const toAlias: Record<string, string> = {}
  ids.forEach((id, i) => {
    const alias = `${prefix}${i + 1}`
    toId[alias] = id
    toAlias[id] = alias
  })
  return { toId, toAlias }
}

// El orden es el del contexto: incidentes por número, categorías como llegan, protocolos fijos.
export function buildAliases(input: TriageInput): Aliases {
  const i = aliasMaps('I', input.contextIncidents.map((c) => c.incident.id))
  const c = aliasMaps('C', input.categories.map((cat) => cat.id))
  const p = aliasMaps('P', PROTOCOLS.map((pr) => pr.id))
  return {
    incidents: i.toId,
    categories: c.toId,
    protocols: p.toId,
    incidentAlias: i.toAlias,
    categoryAlias: c.toAlias,
    protocolAlias: p.toAlias,
  }
}

export type EligibilityFlags = Record<string, { canJoin: boolean; canRelate: boolean }>

// Indicadores por ID real de incidente. El servidor los calcula con datos que envía el
// cliente: no son una frontera de seguridad, manda `applyDecision`.
export function eligibilityFlags(input: TriageInput): EligibilityFlags {
  const flags: EligibilityFlags = {}
  for (const { incident } of input.contextIncidents) {
    flags[incident.id] = {
      canJoin: canJoin(incident, input.report),
      canRelate: canRelate(incident, input.report),
    }
  }
  return flags
}

// ---------------------------------------------------------------------------
// Traducción y saneado de referencias (paso 7)
// ---------------------------------------------------------------------------
export type SanitizeResult =
  | { ok: true; decision: TriageDecision }
  | { ok: false; error: 'invalid_ref' }

export function sanitizeDecision(
  ai: AiDecision,
  input: TriageInput,
  aliases: Aliases,
): SanitizeResult {
  const protocolId = lookup(aliases.protocols, ai.protocolRef)
  if (protocolId === null) return { ok: false, error: 'invalid_ref' }

  let category: TriageDecision['category']
  if (!isBlank(ai.categoryRef)) {
    const categoryId = lookup(aliases.categories, ai.categoryRef)
    if (categoryId === null) return { ok: false, error: 'invalid_ref' }
    category = { existingId: categoryId }
  } else {
    const name = (ai.newCategoryName ?? '').trim().slice(0, MAX_CATEGORY_NAME)
    if (name === '') return { ok: false, error: 'invalid_ref' }
    // Un nombre que, normalizado, coincide con una categoría existente es esa categoría.
    const equivalent = findCategoryByName(input.categories, name)
    category = equivalent ? { existingId: equivalent.id } : { newName: name }
  }

  // Un alias desconocido pasa a `null`: `applyDecision` lo trata como «crear».
  // `targetRef` solo vale con `join`; `relatedRef`, solo con `create`.
  const targetIncidentId = ai.action === 'join' ? lookup(aliases.incidents, ai.targetRef) : null
  const relatedIncidentId =
    ai.action === 'create' ? lookup(aliases.incidents, ai.relatedRef) : null

  return {
    ok: true,
    decision: {
      action: ai.action,
      targetIncidentId,
      relatedIncidentId,
      category,
      severity: ai.severity,
      protocolId,
      summary: ai.summary.trim().slice(0, MAX_SUMMARY),
      rationale: ai.rationale.trim().slice(0, MAX_RATIONALE),
    },
  }
}

function lookup(map: Record<string, string>, alias: string | null): string | null {
  if (alias === null) return null
  const id = map[alias.trim()]
  return id ?? null
}

// ---------------------------------------------------------------------------
// Validación de entrada (paso 3)
// ---------------------------------------------------------------------------
export const LIMITS = {
  incidents: 30,
  reports: 150,
  bytes: 128 * 1024,
  reportText: 500,
  password: 200,
}

const severity = z.enum(['low', 'medium', 'high', 'critical'])

const ReportSchema = z.object({
  id: z.string().min(1).max(100),
  seq: z.number().int(),
  buildingId: z.string().min(1).max(100),
  floor: z.number().int(),
  text: z.string().min(1).max(LIMITS.reportText),
  createdAt: z.number(),
  status: z.enum(['queued', 'processing', 'done', 'error']),
  errorKind: z
    .enum(['rate_limit', 'timeout', 'invalid_input', 'invalid_output', 'invalid_ref', 'network', 'server'])
    .nullable(),
  incidentId: z.string().nullable(),
  scriptKey: z.string().nullable(),
})

const IncidentSchema = z.object({
  id: z.string().min(1).max(100),
  number: z.number().int(),
  buildingId: z.string().min(1).max(100),
  floor: z.number().int(),
  categoryId: z.string().min(1).max(100),
  severity,
  protocolId: z.string().min(1).max(100),
  summary: z.string().max(MAX_SUMMARY),
  rationale: z.string().max(MAX_RATIONALE),
  state: z.enum(['pending', 'validated', 'discarded']),
  relatedIncidentId: z.string().nullable(),
  locks: z.object({
    category: z.boolean(),
    severity: z.boolean(),
    protocol: z.boolean(),
    summary: z.boolean(),
  }),
})

const CategorySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(MAX_CATEGORY_NAME),
  official: z.boolean(),
})

export const TriageRequestSchema = z.object({
  password: z.string().max(LIMITS.password),
  report: ReportSchema,
  contextIncidents: z
    .array(z.object({ incident: IncidentSchema, reports: z.array(ReportSchema) }))
    .max(LIMITS.incidents),
  categories: z.array(CategorySchema).min(1).max(100),
})

export type ParsedTriageRequest = { password: string; input: TriageInput }

// Devuelve `null` si la entrada no es válida (el servidor responde `invalid_input`).
export function parseTriageRequest(data: unknown): ParsedTriageRequest | null {
  const parsed = TriageRequestSchema.safeParse(data)
  if (!parsed.success) return null
  const { password, report, contextIncidents, categories } = parsed.data

  const building = getBuilding(report.buildingId)
  if (!building || !building.floors.includes(report.floor)) return null

  // Todos los incidentes del contexto son del edificio del aviso.
  if (contextIncidents.some((c) => c.incident.buildingId !== report.buildingId)) return null

  const reportCount = contextIncidents.reduce((n, c) => n + c.reports.length, 0)
  if (reportCount > LIMITS.reports) return null

  if (new TextEncoder().encode(JSON.stringify(data)).length > LIMITS.bytes) return null

  return { password, input: { report, contextIncidents, categories } }
}
