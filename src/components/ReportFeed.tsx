import { useMemo } from 'react'
import { Loader2, RotateCw } from 'lucide-react'
import { floorLabel, getBuilding } from '#/data/buildings'
import type { Report, ReportErrorKind } from '#/domain/types'
import { triageActions, useTriageStore } from '#/store/triage-store'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'

const ERROR_LABEL: Record<ReportErrorKind, string> = {
  rate_limit: 'límite de peticiones',
  timeout: 'tiempo agotado',
  invalid_input: 'entrada no válida',
  invalid_output: 'respuesta no válida de la IA',
  invalid_ref: 'referencia no válida de la IA',
  network: 'fallo de red',
  server: 'fallo del servidor',
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Feed de avisos, del más reciente al más antiguo.
export function ReportFeed() {
  const state = useTriageStore((s) => s.state)
  const reports = useMemo(
    () => Object.values(state.reports).sort((a, b) => b.seq - a.seq),
    [state.reports],
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3" aria-label="Avisos">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Avisos</h2>
        <span className="text-xs text-muted-foreground">{reports.length}</span>
      </div>
      {reports.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no hay avisos. Envía uno desde el panel o pulsa «Simular ráfaga».
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {reports.map((report) => (
            <ReportItem key={report.id} report={report} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ReportItem({ report }: { report: Report }) {
  const incidentNumber = useTriageStore((s) =>
    report.incidentId ? s.state.incidents[report.incidentId]?.number : undefined,
  )
  const buildingName = getBuilding(report.buildingId)?.name ?? report.buildingId

  return (
    <li className="flex shrink-0 flex-col gap-1.5 rounded-lg border bg-card p-3 text-sm" data-status={report.status}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {buildingName} · {floorLabel(report.floor)}
          {report.scriptKey ? ` · ${report.scriptKey}` : ''}
        </span>
        <time dateTime={new Date(report.createdAt).toISOString()}>{formatTime(report.createdAt)}</time>
      </div>
      <p>{report.text}</p>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge report={report} incidentNumber={incidentNumber} />
        {report.status === 'error' && report.errorKind !== 'invalid_input' && (
          <Button size="xs" variant="outline" onClick={() => void triageActions.retry(report.id)}>
            <RotateCw /> Reintentar
          </Button>
        )}
      </div>
    </li>
  )
}

function StatusBadge({ report, incidentNumber }: { report: Report; incidentNumber?: number }) {
  switch (report.status) {
    case 'queued':
      return <Badge variant="outline">En cola</Badge>
    case 'processing':
      return (
        <Badge variant="secondary">
          <Loader2 className="animate-spin" /> Procesando
        </Badge>
      )
    case 'done':
      return <Badge>Asignado a INC-{incidentNumber ?? '?'}</Badge>
    case 'error':
      return (
        <Badge variant="destructive">
          Error: {report.errorKind ? ERROR_LABEL[report.errorKind] : 'desconocido'}
        </Badge>
      )
  }
}
