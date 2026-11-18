import { useMemo, useState } from 'react'
import { PROTOCOLS } from '#/data/protocols'
import type { IncidentEdit } from '#/domain/actions'
import { visibleCategories } from '#/domain/selectors'
import type { Incident, Severity } from '#/domain/types'
import { triageActions, useTriageStore } from '#/store/triage-store'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { SEVERITY_LABEL } from '#/components/IncidentCard'

const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical']
const MAX_SUMMARY = 300

// Edición de un incidente pendiente. Solo los campos que cambian quedan bloqueados frente a la IA.
export function EditIncidentDialog({
  incident,
  onClose,
}: {
  incident: Incident
  onClose: () => void
}) {
  const state = useTriageStore((s) => s.state)
  const running = useTriageStore((s) => s.running)
  const categories = useMemo(() => visibleCategories(state), [state])

  const [categoryId, setCategoryId] = useState(incident.categoryId)
  const [severity, setSeverity] = useState<Severity>(incident.severity)
  const [protocolId, setProtocolId] = useState(incident.protocolId)
  const [summary, setSummary] = useState(incident.summary)

  const edit: IncidentEdit = {}
  if (categoryId !== incident.categoryId) edit.categoryId = categoryId
  if (severity !== incident.severity) edit.severity = severity
  if (protocolId !== incident.protocolId) edit.protocolId = protocolId
  if (summary.trim() !== incident.summary && summary.trim().length > 0) {
    edit.summary = summary.trim()
  }
  const changed = Object.keys(edit).length > 0

  function save() {
    triageActions.editIncident(incident.id, edit)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar INC-{incident.number}</DialogTitle>
          <DialogDescription>
            Los campos que cambies quedan bloqueados: la IA no los volverá a modificar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-category">Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="edit-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.official ? '' : ' (no oficial)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-severity">Gravedad</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger id="edit-severity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-protocol">Protocolo</Label>
            <Select value={protocolId} onValueChange={setProtocolId}>
              <SelectTrigger id="edit-protocol" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROTOCOLS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-summary">Resumen</Label>
            <Textarea
              id="edit-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={MAX_SUMMARY}
              rows={4}
            />
            <p className="text-right text-xs text-muted-foreground">
              {summary.length}/{MAX_SUMMARY}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!changed || running}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
