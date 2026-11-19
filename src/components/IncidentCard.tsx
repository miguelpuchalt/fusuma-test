import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Link2, Lock, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { SEVERITY_RUBRIC } from '#/data/burst-script'
import { floorLabel, getBuilding } from '#/data/buildings'
import { getProtocol } from '#/data/protocols'
import { reportsOf } from '#/domain/selectors'
import type { Incident, Severity } from '#/domain/types'
import { triageActions, useTriageStore } from '#/store/triage-store'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '#/components/ui/card'
import { EditIncidentDialog } from '#/components/EditIncidentDialog'
import { formatTime } from '#/components/ReportFeed'

export const SEVERITY_LABEL: Record<Severity, string> = Object.fromEntries(
  SEVERITY_RUBRIC.map((r) => [r.severity, r.label]),
) as Record<Severity, string>

const SEVERITY_STYLE: Record<Severity, { badge: string; border: string }> = {
  low: { badge: 'bg-sev-low text-white', border: 'border-l-sev-low' },
  medium: { badge: 'bg-sev-medium text-black', border: 'border-l-sev-medium' },
  high: { badge: 'bg-sev-high text-black', border: 'border-l-sev-high' },
  critical: { badge: 'bg-sev-critical text-white', border: 'border-l-sev-critical' },
}

// Destello breve en la tarjeta para seguir la ráfaga en directo (mismo ámbar que la presentación).
const FLASH: Keyframe[] = [
  { boxShadow: '0 0 0 0 rgba(240, 162, 26, 0)' },
  { boxShadow: '0 0 0 6px rgba(240, 162, 26, .55)', offset: 0.25 },
  { boxShadow: '0 0 0 0 rgba(240, 162, 26, 0)' },
]

// Se activa cuando el incidente aparece mientras la cola procesa, recibe un aviso o sube de gravedad.
function useFlashOnChange(count: number, severity: Severity, running: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const prev = useRef<{ count: number; severity: Severity } | null>(null)
  useEffect(() => {
    const before = prev.current
    prev.current = { count, severity }
    const changed = before ? count > before.count || severity !== before.severity : running
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (changed && !reduced) ref.current?.animate(FLASH, { duration: 1100, easing: 'ease-out' })
  }, [count, severity, running])
  return ref
}

function LockIcon({ locked }: { locked: boolean }) {
  if (!locked) return null
  return (
    <Lock
      className="inline size-3 text-muted-foreground"
      aria-label="Campo editado a mano: la IA no lo cambia"
    />
  )
}

export function IncidentCard({ incident }: { incident: Incident }) {
  const state = useTriageStore((s) => s.state)
  const running = useTriageStore((s) => s.running)
  const [editing, setEditing] = useState(false)

  const category = state.categories[incident.categoryId]
  const related = incident.relatedIncidentId ? state.incidents[incident.relatedIncidentId] : null
  const reports = reportsOf(state, incident.id)
  const last = reports.at(-1)
  const protocol = getProtocol(incident.protocolId)
  const protocolText = protocol?.textByBuilding[incident.buildingId]
  const building = getBuilding(incident.buildingId)
  const style = SEVERITY_STYLE[incident.severity]
  const pending = incident.state === 'pending'
  const flashRef = useFlashOnChange(reports.length, incident.severity, running)

  return (
    <Card
      ref={flashRef}
      className={`shrink-0 border-l-4 ${style.border} gap-3 py-3`}
      data-testid={`incident-${incident.number}`}
      data-state={incident.state}
    >
      <CardHeader className="gap-1.5 px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold">INC-{incident.number}</span>
          <Badge className={style.badge}>
            {SEVERITY_LABEL[incident.severity]} <LockIcon locked={incident.locks.severity} />
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-medium">{category?.name ?? '—'}</span>
          <LockIcon locked={incident.locks.category} />
          {category && !category.official && (
            <>
              <Badge variant="outline">No oficial</Badge>
              <Button
                size="xs"
                variant="secondary"
                disabled={running}
                onClick={() => triageActions.approveCategory(category.id)}
              >
                <CheckCircle2 /> Aprobar categoría
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {building?.name ?? incident.buildingId} · {floorLabel(incident.floor)}
        </p>
        {related && (
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#2A5BD7]/40 bg-[#E4ECFB] px-2.5 py-0.5 text-xs font-semibold text-[#2A5BD7]"
            data-testid="related"
          >
            <Link2 className="size-3.5" /> Relacionado con INC-{related.number}
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-3 text-sm">
        <div className="rounded-md bg-muted/60 p-2">
          <p className="text-xs font-medium">
            Protocolo propuesto: {protocol?.title ?? incident.protocolId}{' '}
            <LockIcon locked={incident.locks.protocol} />
          </p>
          <p className="text-xs text-muted-foreground">
            {protocolText ?? '—'} <span className="font-medium">[FICTICIO]</span>
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p>
            {incident.summary} <LockIcon locked={incident.locks.summary} />
          </p>
          <p className="text-xs text-muted-foreground">Motivo: {incident.rationale}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {reports.length} {reports.length === 1 ? 'aviso' : 'avisos'}
          {last ? ` · último a las ${formatTime(last.createdAt)}` : ''}
        </p>
      </CardContent>

      <CardFooter className="flex-wrap gap-2 px-3">
        {pending ? (
          <>
            <Button size="sm" variant="outline" disabled={running} onClick={() => setEditing(true)}>
              <Pencil /> Editar
            </Button>
            <Button
              size="sm"
              disabled={running}
              onClick={() => triageActions.validateIncident(incident.id)}
            >
              <ShieldCheck /> Validar
            </Button>
          <Button
              size="sm"
              variant="destructive"
              disabled={running}
              onClick={() => triageActions.discardIncident(incident.id)}
            >
              <Trash2 /> Descartar
            </Button>
          </>
        ) : incident.state === 'validated' ? (
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <ShieldCheck className="size-3.5" /> Protocolo aprobado (no ejecutado: demo)
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Descartado: no cambia.</p>
        )}
      </CardFooter>

      {editing && <EditIncidentDialog incident={incident} onClose={() => setEditing(false)} />}
    </Card>
  )
}
