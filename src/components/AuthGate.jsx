import { useState } from 'react'
import { LockKeyhole, LogIn, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AuthGate({ auth }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setBusy(true)
    setStatus(null)
    try {
      await action()
    } catch (err) {
      setStatus({ tone: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (!auth.isConfigured) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Supabase is not configured</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to enable login.
          </p>
        </div>
      </div>
    )
  }

  if (auth.loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <div className="h-32 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  const canSubmit = email.trim() && password.length >= 6 && !busy
  const canSendLink = email.trim() && !busy

  return (
    <div className="flex h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-sm">
        <div className="mb-5">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
            <LockKeyhole className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Sign in to Writing Blocks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your blocks and builds sync after login.</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) run(() => auth.signIn({ email, password }))
          }}
        >
          <div className="relative">
            <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="email"
              className="pl-8 bg-background"
            />
          </div>
          <Input
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            className="bg-background"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" disabled={!canSubmit}>
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canSubmit}
              onClick={() => run(() => auth.signUp({ email, password }))}
            >
              Create
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={!canSendLink}
            onClick={() => run(async () => {
              await auth.sendMagicLink(email)
              setStatus({ tone: 'ok', text: 'Magic link sent.' })
            })}
            className="w-full"
          >
            Send magic link
          </Button>
        </form>

        {status && (
          <p className={status.tone === 'error'
            ? 'mt-3 text-sm text-destructive'
            : 'mt-3 text-sm text-muted-foreground'
          }>
            {status.text}
          </p>
        )}
      </div>
    </div>
  )
}
