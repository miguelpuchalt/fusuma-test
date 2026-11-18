import { z } from 'zod'

// Fase 0: solo el esquema de §4 del diseño. Las reglas entre campos, los alias
// y el saneado llegan en la fase 2. Sin límites de longitud en los textos
// (los recorta el paso 7 de la Server Function, también en la fase 2).
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
