import { google } from '@ai-sdk/google'
import { APICallError, generateText, NoObjectGeneratedError, Output } from 'ai'
import { AiDecisionSchema, type AiDecision } from '#/ai/contract'
import type { TriageErrorKind } from '#/domain/types'

export type ModelCallResult =
  | {
      ok: true
      decision: AiDecision
      tokens: { input: number | null; output: number | null }
      finishReason: string
    }
  | { ok: false; error: TriageErrorKind }

export const TIMEOUT_MS = 15_000
export const MAX_OUTPUT_TOKENS = 800

// Único archivo que importa `ai` y `@ai-sdk/google`. Configuración del paso 5 y errores del paso 8.
// La clave se lee de GOOGLE_GENERATIVE_AI_API_KEY (solo en el servidor).
export async function callTriageModel(
  modelId: string,
  system: string,
  user: string,
): Promise<ModelCallResult> {
  try {
    const result = await generateText({
      model: google(modelId),
      output: Output.object({ schema: AiDecisionSchema }),
      system,
      prompt: user,
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      reasoning: 'none', // para Gemini 2.5, thinkingBudget 0
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return {
      ok: true,
      decision: result.output,
      tokens: {
        input: result.usage.inputTokens ?? null,
        output: result.usage.outputTokens ?? null,
      },
      finishReason: result.finishReason,
    }
  } catch (error) {
    return { ok: false, error: classifyError(error) }
  }
}

// Orden del paso 8: timeout, 429, salida que no cumple el esquema, cualquier otro.
export function classifyError(error: unknown): TriageErrorKind {
  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return 'timeout'
  }
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return 'rate_limit'
  }
  if (NoObjectGeneratedError.isInstance(error)) return 'invalid_output'
  return 'server'
}
