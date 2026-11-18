// Fixtures de demostración, no recomendaciones de seguridad.

import type { Severity } from '../domain/types'

export type ScriptEntry = {
  key: string
  buildingId: string
  floor: number
  text: string
  group: 'A' | 'B' | 'C' | 'D' | 'E'
}

// Orden de la ráfaga: S1 a S9. Los grupos A y D se intercalan a propósito.
export const BURST_SCRIPT: ScriptEntry[] = [
  { key: 'S1', buildingId: 'torre-central', floor: 2, group: 'A', text: 'Huele a humo en el pasillo de la segunda planta, cerca de las salas de reuniones.' },
  { key: 'S2', buildingId: 'torre-central', floor: 2, group: 'A', text: 'Hay una especie de niebla gris saliendo del falso techo junto a la sala 2.04.' },
  { key: 'S3', buildingId: 'anexo-a', floor: 0, group: 'D', text: 'Se ha ido la luz en toda la recepción y las puertas automáticas no abren.' },
  { key: 'S4', buildingId: 'torre-central', floor: 2, group: 'A', text: 'Olor a quemado muy fuerte junto a la escalera de la planta 2, pican los ojos.' },
  { key: 'S5', buildingId: 'anexo-a', floor: 0, group: 'D', text: 'En recepción tampoco funcionan los ordenadores ni el ascensor, parece un corte general.' },
  { key: 'S6', buildingId: 'torre-central', floor: 3, group: 'B', text: 'Está entrando humo por la puerta de la escalera en la planta 3.' },
  { key: 'S7', buildingId: 'torre-central', floor: 2, group: 'A', text: 'Ya se ven llamas pequeñas en el cuarto de fotocopiadoras de la segunda planta.' },
  { key: 'S8', buildingId: 'torre-central', floor: 2, group: 'C', text: 'Una persona se ha desmayado en la cafetería de la planta 2. Está consciente y responde cuando le hablan.' },
  { key: 'S9', buildingId: 'laboratorios', floor: -1, group: 'E', text: 'Cae agua del techo en el almacén del sótano y se está formando un charco grande.' },
]

// Rúbrica de gravedad (ficticia, sin valor operativo). Va en el prompt.
export const SEVERITY_RUBRIC: { severity: Severity; label: string; criterion: string }[] = [
  { severity: 'low', label: 'Baja', criterion: 'Anomalía sin riesgo para las personas ni efecto en el uso del edificio.' },
  { severity: 'medium', label: 'Media', criterion: 'Afecta a un servicio o a una zona (luz, accesos, ascensores, agua), o a una persona sin gravedad aparente.' },
  { severity: 'high', label: 'Alta', criterion: 'Riesgo posible para las personas o propagación probable (humo en zonas de paso, varias personas afectadas).' },
  { severity: 'critical', label: 'Crítica', criterion: 'Peligro activo con riesgo inmediato para la vida (llamas, humo denso que se extiende, personas atrapadas).' },
]

export type ExpectedGroup = {
  group: ScriptEntry['group']
  keys: string[]
  buildingId: string
  floor: number
  // `existingId` si la categoría ya existe; `newNames` si la IA debe crear una no oficial.
  category: { existingId: string } | { newNames: string[] }
  severity: { main: Severity; range: Severity[] }
  protocol: { main: string; alternatives: string[] }
  relatedToGroup: ExpectedGroup['group'] | null
}

// El valor principal es el de `main`; el rango o la alternativa son los aceptados con la IA real.
export const EXPECTED_RESULTS: ExpectedGroup[] = [
  { group: 'A', keys: ['S1', 'S2', 'S4', 'S7'], buildingId: 'torre-central', floor: 2, category: { existingId: 'fire-smoke' }, severity: { main: 'critical', range: ['high', 'critical'] }, protocol: { main: 'evac-plan', alternatives: ['evac-nearest'] }, relatedToGroup: null },
  { group: 'B', keys: ['S6'], buildingId: 'torre-central', floor: 3, category: { existingId: 'fire-smoke' }, severity: { main: 'high', range: ['high', 'critical'] }, protocol: { main: 'evac-nearest', alternatives: ['evac-plan'] }, relatedToGroup: 'A' },
  { group: 'C', keys: ['S8'], buildingId: 'torre-central', floor: 2, category: { existingId: 'medical' }, severity: { main: 'medium', range: ['medium', 'high'] }, protocol: { main: 'notify', alternatives: [] }, relatedToGroup: null },
  { group: 'D', keys: ['S3', 'S5'], buildingId: 'anexo-a', floor: 0, category: { existingId: 'electrical' }, severity: { main: 'medium', range: ['medium', 'high'] }, protocol: { main: 'notify', alternatives: [] }, relatedToGroup: null },
  { group: 'E', keys: ['S9'], buildingId: 'laboratorios', floor: -1, category: { newNames: ['Fuga de agua', 'Filtración de agua'] }, severity: { main: 'medium', range: ['low', 'medium'] }, protocol: { main: 'notify', alternatives: [] }, relatedToGroup: null },
]
