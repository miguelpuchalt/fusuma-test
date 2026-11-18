import type { Severity } from '../domain/types'

// Respuestas pregrabadas del modo sin API: una por aviso del guion (S1 a S9).
// No usan IDs de incidente, porque no existen hasta que se procesa la ráfaga: apuntan a un
// «aviso ancla» («unirse al incidente del aviso S1»), que `FallbackEngine` traduce al
// `incidentId` actual de ese aviso. Usan siempre el valor principal de los resultados
// esperados de `burst-script.ts`. Fixtures de demostración, no recomendaciones de seguridad.

export type FallbackFixture = {
  action: 'join' | 'create'
  targetAnchor: string | null // clave del aviso cuyo incidente recibe este aviso (solo con join)
  relatedAnchor: string | null // clave del aviso cuyo incidente se relaciona (solo con create)
  category: { existingId: string } | { newName: string }
  severity: Severity
  protocolId: string
  summary: string
  rationale: string
}

export const FALLBACK_FIXTURES: Record<string, FallbackFixture> = {
  S1: {
    action: 'create',
    targetAnchor: null,
    relatedAnchor: null,
    category: { existingId: 'fire-smoke' },
    severity: 'medium',
    protocolId: 'evac-plan',
    summary: 'Olor a humo en el pasillo de la planta 2 de Torre Central, cerca de las salas de reuniones.',
    rationale: 'Primer aviso: posible incendio en una zona de paso.',
  },
  S2: {
    action: 'join',
    targetAnchor: 'S1',
    relatedAnchor: null,
    category: { existingId: 'fire-smoke' },
    severity: 'high',
    protocolId: 'evac-plan',
    summary: 'Niebla gris saliendo del falso techo y olor a humo en el pasillo de la planta 2.',
    rationale: 'Describe el mismo fenómeno en la misma planta que el aviso anterior.',
  },
  S3: {
    action: 'create',
    targetAnchor: null,
    relatedAnchor: null,
    category: { existingId: 'electrical' },
    severity: 'medium',
    protocolId: 'notify',
    summary: 'Corte de luz en la recepción del Anexo A; las puertas automáticas no abren.',
    rationale: 'Primer aviso de un fallo eléctrico que afecta a un servicio.',
  },
  S4: {
    action: 'join',
    targetAnchor: 'S1',
    relatedAnchor: null,
    category: { existingId: 'fire-smoke' },
    severity: 'high',
    protocolId: 'evac-plan',
    summary: 'Olor a quemado intenso junto a la escalera de la planta 2; el humo irrita los ojos.',
    rationale: 'Mismo suceso en la misma planta, con más intensidad.',
  },
  S5: {
    action: 'join',
    targetAnchor: 'S3',
    relatedAnchor: null,
    category: { existingId: 'electrical' },
    severity: 'medium',
    protocolId: 'notify',
    summary: 'Corte de luz en la recepción del Anexo A; tampoco funcionan los ordenadores ni el ascensor.',
    rationale: 'Parece el mismo corte eléctrico en la misma planta.',
  },
  S6: {
    action: 'create',
    targetAnchor: null,
    relatedAnchor: 'S1',
    category: { existingId: 'fire-smoke' },
    severity: 'high',
    protocolId: 'evac-nearest',
    summary: 'Entra humo por la puerta de la escalera de la planta 3.',
    rationale: 'Mismo fenómeno en otra planta: incidente nuevo relacionado con el de la planta 2.',
  },
  S7: {
    action: 'join',
    targetAnchor: 'S1',
    relatedAnchor: null,
    category: { existingId: 'fire-smoke' },
    severity: 'critical',
    protocolId: 'evac-plan',
    summary: 'Llamas pequeñas en el cuarto de fotocopiadoras de la planta 2, además del humo anterior.',
    rationale: 'Hay fuego visible: peligro activo en la misma planta.',
  },
  S8: {
    action: 'create',
    targetAnchor: null,
    relatedAnchor: null,
    category: { existingId: 'medical' },
    severity: 'medium',
    protocolId: 'notify',
    summary: 'Una persona desmayada en la cafetería de la planta 2; está consciente y responde.',
    rationale: 'Suceso distinto al humo de la misma planta: incidente nuevo sin relación.',
  },
  S9: {
    action: 'create',
    targetAnchor: null,
    relatedAnchor: null,
    category: { newName: 'Fuga de agua' },
    severity: 'medium',
    protocolId: 'notify',
    summary: 'Cae agua del techo en el almacén del sótano y se forma un charco grande.',
    rationale: 'Ninguna categoría existente encaja: se propone una nueva.',
  },
}
