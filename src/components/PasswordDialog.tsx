import { useState } from 'react'
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
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

// Contraseña de demo para el modo con IA. Se abre cuando la cola la necesita. No se puede cerrar
// sin introducirla: para salir sin ella se recarga la página, que equivale a reiniciar la demo
// porque el estado solo está en memoria.
export function PasswordDialog() {
  const prompt = useTriageStore((s) => s.passwordPrompt)
  return prompt ? <PasswordForm key={String(prompt.rejected)} rejected={prompt.rejected} /> : null
}

function PasswordForm({ rejected }: { rejected: boolean }) {
  const [password, setPassword] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length === 0) return
    void triageActions.setPassword(password)
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Contraseña de demo</DialogTitle>
            <DialogDescription>
              El análisis con IA está protegido por una contraseña compartida. Los avisos siguen en
              cola y se procesarán al introducirla.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="demo-password">Contraseña</Label>
            <Input
              id="demo-password"
              type="password"
              autoFocus
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={rejected}
              aria-describedby={rejected ? 'password-error' : undefined}
            />
            {rejected && (
              <p id="password-error" role="alert" className="text-sm text-destructive">
                Contraseña incorrecta
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Para salir sin contraseña, recarga la página: la demo empieza de cero.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={password.length === 0}>
              Continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
