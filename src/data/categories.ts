import type { Category } from '../domain/types'

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'fire-smoke', name: 'Incendio/Humo', official: true },
  { id: 'electrical', name: 'Fallo Eléctrico', official: true },
  { id: 'medical', name: 'Médico', official: true },
  { id: 'security', name: 'Seguridad', official: true },
]
