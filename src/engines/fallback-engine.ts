import { FALLBACK_FIXTURES } from '../data/fallback-fixtures'
import type { TriageEngine, TriageInput, TriageResult, TriageState } from '../domain/types'

// Pausa que simula la latencia de la IA, para que la ráfaga se vea procesar.
export const FALLBACK_DELAY_MS = 600

// Motor del modo sin API: devuelve la respuesta pregrabada de `report.scriptKey`, sin llamadas a
// la red ni contraseña. Es determinista: la misma ráfaga da siempre el mismo resultado.
//
// Las respuestas no usan IDs, sino el aviso ancla del grupo, que aquí se traduce al
// `incidentId` actual de ese aviso. El modo sin API solo procesa una ráfaga sobre un tablero
// vacío y nunca falla, así que cada ancla existe y es única. Si un ancla no tuviera incidente,
// el destino sería `null` y `applyDecision` lo trataría como «crear».
export function createFallbackEngine(
  getState: () => TriageState,
  sleep: (ms: number) => Promise<void>,
): TriageEngine {
  return {
    async propose(input: TriageInput): Promise<TriageResult> {
      await sleep(FALLBACK_DELAY_MS)

      const key = input.report.scriptKey
      const fixture = key ? FALLBACK_FIXTURES[key] : undefined
      // Un aviso que no es del guion no tiene respuesta pregrabada.
      if (!fixture) return { ok: false, error: 'server' }

      const state = getState()
      const incidentOfAnchor = (anchor: string | null): string | null => {
        if (anchor === null) return null
        const report = Object.values(state.reports).find((r) => r.scriptKey === anchor)
        return report?.incidentId ?? null
      }

      return {
        ok: true,
        decision: {
          action: fixture.action,
          targetIncidentId:
            fixture.action === 'join' ? incidentOfAnchor(fixture.targetAnchor) : null,
          relatedIncidentId:
            fixture.action === 'create' ? incidentOfAnchor(fixture.relatedAnchor) : null,
          category: fixture.category,
          severity: fixture.severity,
          protocolId: fixture.protocolId,
          summary: fixture.summary,
          rationale: fixture.rationale,
        },
      }
    },
  }
}
