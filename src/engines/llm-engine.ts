import type { TriageEngine, TriageInput, TriageResult } from '../domain/types'

// La llamada al servidor se inyecta para poder probar el motor sin red.
// En la aplicación es `triageReport` (ver `src/store/triage-store.ts`).
export type TriageCall = (args: { data: unknown }) => Promise<TriageResult>

// Motor de IA: llama a la Server Function con la contraseña en memoria. Un fallo de red
// (la petición no llega o la Server Function lanza) es `network`.
export function createLlmEngine(
  getPassword: () => string | null,
  call: TriageCall,
): TriageEngine {
  return {
    async propose(input: TriageInput): Promise<TriageResult> {
      try {
        return await call({ data: { password: getPassword() ?? '', ...input } })
      } catch {
        return { ok: false, error: 'network' }
      }
    },
  }
}
