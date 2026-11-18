import { createHash, timingSafeEqual } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import {
  buildAliases,
  checkCrossFieldRules,
  eligibilityFlags,
  parseTriageRequest,
  sanitizeDecision,
} from '#/ai/contract'
import { buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from '#/ai/prompt'
import type { TriageResult } from '#/domain/types'
import { callTriageModel } from '#/server/llm-client'

// Server Function `triageReport` (Technical Plan §5). Nunca lanza excepciones al cliente:
// siempre devuelve un `TriageResult`.

const RATE_LIMIT_PER_MINUTE = 20
const hits: number[] = []

// Paso 1: contador en memoria por instancia. Cuenta también las contraseñas incorrectas.
function rateLimited(now: number): boolean {
  while (hits.length > 0 && now - hits[0]! > 60_000) hits.shift()
  if (hits.length >= RATE_LIMIT_PER_MINUTE) return true
  hits.push(now)
  return false
}

// Paso 2: SHA-256 de las dos cadenas y `timingSafeEqual` sobre los resúmenes. Los dos miden
// siempre 32 bytes, así que la comparación nunca lanza una excepción.
function passwordMatches(input: string, expected: string): boolean {
  const a = createHash('sha256').update(input).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

function rawPassword(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'password' in data) {
    const value = (data as { password: unknown }).password
    if (typeof value === 'string') return value.slice(0, 200)
  }
  return ''
}

export const triageReport = createServerFn({ method: 'POST' })
  // Validador solo de tipo: la validación real es un `safeParse` dentro de la función,
  // porque un validador de Zod lanzaría una excepción en lugar de devolver `invalid_input`.
  .validator((data: unknown) => data)
  .handler(async ({ data }): Promise<TriageResult> => {
    const started = Date.now()
    let outcome: string = 'server'
    let model: string | undefined
    let tokens: { input: number | null; output: number | null } | undefined
    try {
      // 1. Límite de peticiones.
      if (rateLimited(started)) {
        outcome = 'rate_limit'
        return { ok: false, error: 'rate_limit' }
      }

      // 2. Contraseña. Si falta o es corta en el servidor es un error de configuración.
      const expected = process.env.DEMO_PASSWORD
      if (!expected || expected.length < 12) {
        outcome = 'server_config'
        return { ok: false, error: 'server' }
      }
      if (!passwordMatches(rawPassword(data), expected)) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        outcome = 'unauthorized'
        return { ok: false, error: 'unauthorized' }
      }

      // 3. Validación de entrada.
      const request = parseTriageRequest(data)
      if (!request) {
        outcome = 'invalid_input'
        return { ok: false, error: 'invalid_input' }
      }
      const { input } = request

      model = process.env.TRIAGE_MODEL
      if (!model || !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        outcome = 'server_config'
        return { ok: false, error: 'server' }
      }

      // 4. Elegibilidad y alias.
      const aliases = buildAliases(input)
      const flags = eligibilityFlags(input)

      // 5. Llamada a la IA (con la clasificación de errores del paso 8).
      const result = await callTriageModel(
        model,
        buildSystemPrompt(),
        buildUserPrompt(input, aliases, flags),
      )
      if (!result.ok) {
        outcome = result.error
        return { ok: false, error: result.error }
      }
      tokens = result.tokens

      // 6. Reglas entre campos (el esquema ya lo validó el SDK).
      if (checkCrossFieldRules(result.decision) !== null) {
        outcome = 'invalid_output'
        return { ok: false, error: 'invalid_output' }
      }

      // 7. Traducción y saneado de referencias.
      const sanitized = sanitizeDecision(result.decision, input, aliases)
      if (!sanitized.ok) {
        outcome = sanitized.error
        return { ok: false, error: sanitized.error }
      }
      outcome = 'ok'
      return { ok: true, decision: sanitized.decision }
    } catch {
      // 8. Cualquier excepción inesperada.
      outcome = 'server'
      return { ok: false, error: 'server' }
    } finally {
      // 9. Una línea de log por llamada, sin secretos ni textos de avisos.
      console.log(
        JSON.stringify({
          model,
          promptVersion: PROMPT_VERSION,
          latencyMs: Date.now() - started,
          tokens,
          outcome,
        }),
      )
    }
  })
