import { APICallError, generateText, NoObjectGeneratedError, Output } from 'ai'
import { AiDecisionSchema, type AiDecision } from '#/ai/contract'

export type TriageErrorKind =
  | 'rate_limit'
  | 'timeout'
  | 'invalid_input'
  | 'invalid_output'
  | 'invalid_ref'
  | 'network'
  | 'server'
  | 'unauthorized'

export type ModelCallResult =
  | {
      ok: true
      decision: AiDecision
      tokens: { input: number | null; output: number | null }
      finishReason: string
      cost: string | null
    }
  | { ok: false; error: TriageErrorKind }

// Único archivo que importa `ai`. Configuración del paso 5 y errores del paso 8.
export async function callTriageModel(
  model: string,
  system: string,
  user: string,
): Promise<ModelCallResult> {
  try {
    const result = await generateText({
      model, // 'proveedor/modelo' a través de AI Gateway
      output: Output.object({ schema: AiDecisionSchema }),
      system,
      prompt: user,
      temperature: 0,
      maxOutputTokens: 800,
      maxRetries: 0,
      reasoning: 'none',
      abortSignal: AbortSignal.timeout(15_000),
    })
    const gw = (result.providerMetadata as Record<string, any> | undefined)
      ?.gateway
    return {
      ok: true,
      decision: result.output,
      tokens: {
        input: result.usage.inputTokens ?? null,
        output: result.usage.outputTokens ?? null,
      },
      finishReason: result.finishReason,
      cost: gw?.cost != null ? String(gw.cost) : null,
    }
  } catch (error) {
    return { ok: false, error: classifyError(error) }
  }
}

// Orden del paso 8: timeout, 429, salida que no cumple el esquema, resto.
function classifyError(error: unknown): TriageErrorKind {
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
