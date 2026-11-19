import { createFileRoute } from '@tanstack/react-router'
import { Siren } from 'lucide-react'
import { useTriageStore } from '#/store/triage-store'
import { ControlPanel } from '#/components/ControlPanel'
import { IncidentBoard } from '#/components/IncidentBoard'
import { PasswordDialog } from '#/components/PasswordDialog'
import { ReportFeed } from '#/components/ReportFeed'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/')({ component: Home })

// Pantalla única: cabecera, panel lateral, feed de avisos y tablero de incidentes.
function Home() {
  const mode = useTriageStore((s) => s.state.mode)

  return (
    <div className="flex h-screen min-w-[1180px] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Siren className="size-5" aria-hidden />
          <h1 className="text-lg font-semibold">EmergencyTriage</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mode === 'llm' ? 'default' : 'secondary'} data-testid="mode-badge">
            Modo: {mode === 'llm' ? 'IA' : 'Sin API'}
          </Badge>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[300px_340px_1fr] gap-5 p-5">
        <aside className="overflow-y-auto pr-1">
          <ControlPanel />
        </aside>
        <div className="flex min-h-0 flex-col">
          <ReportFeed />
        </div>
        <IncidentBoard />
      </main>

      <PasswordDialog />
    </div>
  )
}
