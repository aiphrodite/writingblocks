import { useState } from 'react'
import { LogIn, LogOut, Mail, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const SYNC_LABELS = {
  syncing: 'Syncing',
  synced: 'Synced',
  error: 'Sync issue',
  local: 'Local only',
  'signed-out': 'Local only',
}

export function AuthPanel({ auth, syncState }) {
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
      <div className="border-t border-border px-4 py-3">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Add Supabase env vars to enable login.
        </div>
      </div>
    )
  }

  if (auth.loading) {
    return (
      <div className="border-t border-border px-4 py-3">
        <div className="h-8 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (auth.user) {
    const syncLabel = SYNC_LABELS[syncState?.status] ?? 'Signed in'

    return (
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{auth.user.email}</p>
            <p className={syncState?.status === 'error'
              ? 'text-[10px] text-destructive'
              : 'text-[10px] text-muted-foreground'
            }>
              {syncLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => run(auth.signOut)}
            disabled={busy}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
        {syncState?.status === 'error' && syncState.error && (
          <p className="mt-2 text-xs text-destructive">{syncState.error}</p>
        )}
      </div>
    )
  }

  const canSubmit = email.trim() && password.length >= 6 && !busy
  const canSendLink = email.trim() && !busy

  return (
    <div className="border-t border-border px-4 py-3">
      <form
        className="space-y-2"
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
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
        <Input
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          className="h-8 text-xs bg-background"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <Button type="submit" size="sm" disabled={!canSubmit} className="h-8">
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canSubmit}
            onClick={() => run(() => auth.signUp({ email, password }))}
            className="h-8"
          >
            Create
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!canSendLink}
          onClick={() => run(async () => {
            await auth.sendMagicLink(email)
            setStatus({ tone: 'ok', text: 'Magic link sent.' })
          })}
          className="h-7 w-full text-xs"
        >
          Send magic link
        </Button>
      </form>
      {status && (
        <p className={status.tone === 'error'
          ? 'mt-2 text-xs text-destructive'
          : 'mt-2 text-xs text-muted-foreground'
        }>
          {status.text}
        </p>
      )}
    </div>
  )
}
