import type { Category, Incident, Report, Severity } from './types'

const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high', 'critical']

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s)
}

export function maxSeverity(a: Severity, b: Severity): Severity {
  return severityRank(a) >= severityRank(b) ? a : b
}

// Un aviso solo entra en un incidente pendiente de su mismo edificio y planta.
export function canJoin(incident: Incident, report: Report): boolean {
  return (
    incident.state === 'pending' &&
    incident.buildingId === report.buildingId &&
    incident.floor === report.floor
  )
}

// Se relaciona un incidente pendiente de otra planta del edificio o uno validado
// del edificio. Un pendiente de la misma planta nunca se relaciona (se agrupa o
// se separa); uno descartado nunca.
export function canRelate(incident: Incident, report: Report): boolean {
  if (incident.buildingId !== report.buildingId) return false
  if (incident.state === 'validated') return true
  if (incident.state === 'pending') return incident.floor !== report.floor
  return false
}

// Minúsculas, sin tildes y con los espacios simplificados.
export function normalizeCategoryName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function findCategoryByName(
  categories: Iterable<Category>,
  name: string,
): Category | undefined {
  const wanted = normalizeCategoryName(name)
  if (wanted === '') return undefined
  for (const c of categories) {
    if (normalizeCategoryName(c.name) === wanted) return c
  }
  return undefined
}
