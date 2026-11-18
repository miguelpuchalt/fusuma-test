import { useMemo } from 'react'
import { incidentsByState } from '#/domain/selectors'
import type { IncidentState } from '#/domain/types'
import { useTriageStore } from '#/store/triage-store'
import { IncidentCard } from '#/components/IncidentCard'

const COLUMNS: { state: IncidentState; title: string; empty: string }[] = [
  { state: 'pending', title: 'Pendiente', empty: 'Sin incidentes pendientes.' },
  { state: 'validated', title: 'Validado', empty: 'Ningún incidente validado.' },
  { state: 'discarded', title: 'Descartado', empty: 'Ningún incidente descartado.' },
]

// Tablero de incidentes: una columna por estado.
export function IncidentBoard() {
  const state = useTriageStore((s) => s.state)
  const columns = useMemo(
    () => COLUMNS.map((c) => ({ ...c, incidents: incidentsByState(state, c.state) })),
    [state],
  )

  return (
    <section className="grid min-h-0 flex-1 grid-cols-3 gap-3" aria-label="Tablero de incidentes">
      {columns.map((column) => (
        <div
          key={column.state}
          className="flex min-h-0 flex-col gap-3 rounded-xl bg-muted/40 p-3"
          data-column={column.state}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">{column.title}</h2>
            <span className="text-xs text-muted-foreground">{column.incidents.length}</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {column.incidents.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                {column.empty}
              </p>
            ) : (
              column.incidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
