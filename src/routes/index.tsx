import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BURST_SCRIPT } from '#/data/burst-script'
import {
  createInitialState,
  createReport,
  enqueueReports,
  markProcessing,
} from '#/domain/actions'
import { buildTriageInput } from '#/domain/selectors'
import { triageReport } from '#/server/triage-report'

export const Route = createFileRoute('/')({ component: Home })

// FASE 0-2: botón temporal. Se quita en la fase 5.
function buildS1Request() {
  const s1 = BURST_SCRIPT[0]!
  const made = createReport(createInitialState('llm'), {
    id: 'temp-s1',
    buildingId: s1.buildingId,
    floor: s1.floor,
    text: s1.text,
    createdAt: Date.now(),
    scriptKey: s1.key,
  })
  const state = markProcessing(enqueueReports(made.state, [made.report]), 'temp-s1')
  return buildTriageInput(state, 'temp-s1')
}

function Home() {
  const [password, setPassword] = useState('')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await triageReport({ data: { password, ...buildS1Request() } })
      setOutput(JSON.stringify(res, null, 2))
    } catch (e) {
      setOutput('Error de red o de la Server Function: ' + String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold">EmergencyTriage — fase 2</h1>
      <p className="mt-2">
        Demo con datos ficticios. Llamada temporal con el aviso S1.
      </p>
      <input
        type="password"
        className="mt-4 block border p-2 w-full"
        placeholder="Contraseña de demo"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        className="mt-2 border px-3 py-2 disabled:opacity-50"
        disabled={busy || password.length === 0}
        onClick={run}
      >
        {busy ? 'Llamando…' : 'Probar triageReport con S1'}
      </button>
      <pre className="mt-4 text-sm whitespace-pre-wrap">{output}</pre>
    </div>
  )
}
