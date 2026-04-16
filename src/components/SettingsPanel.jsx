import { useState } from 'react'
import { Settings, Eye, EyeOff, Download, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

const AI_MODELS = [
  { value: 'claude-opus-4-5',           label: 'Claude Opus 4.5',       badge: 'powerful' },
  { value: 'claude-sonnet-4-5',         label: 'Claude Sonnet 4.5',     badge: 'balanced' },
  { value: 'claude-haiku-3-5',          label: 'Claude Haiku 3.5',      badge: 'fast'     },
]

function Section({ title, children }) {
  return (
    <div className="px-4 py-4 border-b border-border last:border-0">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {title}
      </p>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}

function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
      {children}
    </label>
  )
}

export function SettingsPanel({ ideas }) {
  const { settings, update } = useSettings()
  const { theme, toggle: toggleTheme } = useTheme()
  const [showKey, setShowKey] = useState(false)

  function handleExport() {
    const blob = new Blob([JSON.stringify(ideas, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `writingblocks-${new Date().toISOString().slice(0, 10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">

      {/* Panel title */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Settings</span>
      </div>

      {/* ── Appearance ── */}
      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <Label>Theme</Label>
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => theme === 'dark' && toggleTheme()}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
                theme === 'light'
                  ? 'bg-background text-foreground shadow-sm dark:bg-muted/80'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sun className="h-3 w-3" /> Light
            </button>
            <button
              onClick={() => theme === 'light' && toggleTheme()}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
                theme === 'dark'
                  ? 'bg-background text-foreground shadow-sm dark:bg-muted/80'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Moon className="h-3 w-3" /> Dark
            </button>
          </div>
        </div>
      </Section>

      {/* ── AI ── */}
      <Section title="AI Generation">
        {/* API key */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-key">Anthropic API Key</Label>
          <div className="relative">
            <input
              id="ai-key"
              type={showKey ? 'text' : 'password'}
              value={settings.aiApiKey}
              onChange={e => update({ aiApiKey: e.target.value })}
              placeholder="sk-ant-…"
              className="h-8 w-full rounded-md border border-border bg-background pr-8 pl-3 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-ring/40 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-2 top-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {showKey
                ? <EyeOff className="h-3.5 w-3.5" />
                : <Eye    className="h-3.5 w-3.5" />
              }
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Stored only in your browser. Never sent anywhere except Anthropic.
          </p>
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ai-model">Model</Label>
          <div className="flex flex-col gap-1">
            {AI_MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => update({ aiModel: m.value })}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors',
                  settings.aiModel === m.value
                    ? 'border-foreground/30 bg-accent text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                <span className="font-medium">{m.label}</span>
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                  m.badge === 'powerful' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400' :
                  m.badge === 'balanced' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400' :
                                           'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                )}>
                  {m.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Data ── */}
      <Section title="Data">
        <div className="flex flex-col gap-1.5">
          <Label>Export</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 w-full justify-start gap-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Download all ideas as JSON
          </Button>
          <p className="text-[10px] text-muted-foreground/60">
            {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'} · ideas are also auto-saved to localStorage
          </p>
        </div>
      </Section>

    </div>
  )
}
