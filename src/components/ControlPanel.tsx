import { useState } from 'react'
import { Play, RotateCcw, Send } from 'lucide-react'
import { BUILDINGS, floorLabel, getBuilding } from '#/data/buildings'
import { MAX_REPORT_TEXT } from '#/queue/triage-queue'
import { burstProgress, isBoardEmpty, queueOrder } from '#/domain/selectors'
import { triageActions, useTriageStore } from '#/store/triage-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'

// Panel lateral: formulario de avisos, ráfaga, reinicio, modo y progreso. Las reglas de
// activación salen del estado del store y de los selectores del dominio.
export function ControlPanel() {
  const state = useTriageStore((s) => s.state)
  const running = useTriageStore((s) => s.running)

  const [buildingId, setBuildingId] = useState(BUILDINGS[0]!.id)
  const [floor, setFloor] = useState('2')
  const [text, setText] = useState('')

  const fallback = state.mode === 'fallback'
  const empty = isBoardEmpty(state)
  const building = getBuilding(buildingId)!
  const progress = burstProgress(state)
  const queued = queueOrder(state).length

  function changeBuilding(id: string) {
    setBuildingId(id)
    const next = getBuilding(id)!
    if (!next.floors.includes(Number(floor))) {
      setFloor(String(next.floors.includes(0) ? 0 : next.floors[0]))
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (text.trim().length === 0) return
    void triageActions.submitManualReport({ buildingId, floor: Number(floor), text })
    setText('')
  }

  return (
    <section className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Nuevo aviso">
        <h2 className="text-sm font-semibold">Nuevo aviso</h2>
        <fieldset disabled={fallback} className="flex flex-col gap-3 disabled:opacity-50">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="building">Edificio</Label>
              <Select value={buildingId} onValueChange={changeBuilding} disabled={fallback}>
                <SelectTrigger id="building" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUILDINGS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="floor">Planta</Label>
              <Select value={floor} onValueChange={setFloor} disabled={fallback}>
                <SelectTrigger id="floor" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...building.floors].reverse().map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      {floorLabel(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="text">Mensaje</Label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_REPORT_TEXT}
              rows={4}
              placeholder="Describe lo que ocurre, por ejemplo: «Huele a quemado junto a la escalera»"
              disabled={fallback}
            />
            <p className="text-right text-xs text-muted-foreground" aria-live="polite">
              {text.length}/{MAX_REPORT_TEXT}
            </p>
          </div>
          <Button type="submit" disabled={fallback || text.trim().length === 0}>
            <Send /> Enviar aviso
          </Button>
        </fieldset>
        {fallback && (
          <p className="text-xs text-muted-foreground">
            Desactivado en modo sin API: solo hay respuestas pregrabadas para los 9 avisos del
            guion.
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2 border-t pt-4">
        <h2 className="text-sm font-semibold">Demo</h2>
        <Button
          variant="secondary"
          onClick={() => void triageActions.startBurst()}
          disabled={running || (fallback && !empty)}
        >
          <Play /> Simular ráfaga
        </Button>
        {fallback && !empty && !running && (
          <p className="text-xs text-muted-foreground">
            En modo sin API la ráfaga solo se lanza con el tablero vacío.
          </p>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={running}>
              <RotateCcw /> Reiniciar demo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Reiniciar la demo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán todos los avisos, incidentes y categorías creadas. Se conservan el
                modo y la contraseña de esta sesión.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => triageActions.resetDemo()}>
                Reiniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="mt-1 flex items-start justify-between gap-3 rounded-lg border p-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="mode-switch">Modo sin API</Label>
            <p className="text-xs text-muted-foreground">
              Respuestas pregrabadas, sin IA ni contraseña. Solo con el tablero vacío.
            </p>
          </div>
          <Switch
            id="mode-switch"
            checked={fallback}
            disabled={running || !empty}
            onCheckedChange={(checked) => triageActions.setMode(checked ? 'fallback' : 'llm')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-4" aria-live="polite">
        <h2 className="text-sm font-semibold">Estado de la cola</h2>
        <p className="text-sm text-muted-foreground">
          {running ? 'Procesando avisos…' : queued > 0 ? `${queued} en cola` : 'Cola parada'}
        </p>
        {state.burstStartSeq !== null && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              Ráfaga: {progress.done}/{progress.total}
            </p>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-label="Progreso de la ráfaga"
            >
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
