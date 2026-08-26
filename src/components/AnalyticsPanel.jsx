import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, TrendingUp, TrendingDown, Heart, Repeat2, MessageCircle,
  Eye, MousePointerClick, Link2, Users, Loader2, AlertTriangle, Plug, BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MOCK_MODE, X_WINDOWS, getXConnection, beginXAuth, disconnectX, fetchXAnalytics,
} from '@/lib/xAnalyticsApi'
import { cn } from '@/lib/utils'

// ── formatting helpers ───────────────────────────────────────────────────────

function compact(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function pct(rate) {
  return (rate * 100).toFixed(2) + '%'
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'X'
}

// The X wordmark, rendered like the platform pips elsewhere in the app.
function XGlyph({ className }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded bg-foreground font-bold text-background leading-none',
      className
    )}>
      𝕏
    </span>
  )
}

// ── delta vs. prior period ───────────────────────────────────────────────────

function Delta({ current, prior }) {
  if (prior == null || prior === 0) return null
  const change = (current - prior) / prior
  const up = change >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11px] font-medium',
      up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
    )}>
      <Icon className="h-3 w-3" />
      {(Math.abs(change) * 100).toFixed(1)}%
    </span>
  )
}

function MetricCard({ icon, label, value, current, prior }) {
  const Icon = icon
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {current != null && <Delta current={current} prior={prior} />}
      </div>
    </div>
  )
}

// ── impressions area chart (inline SVG, matches the app's MiniFlow pattern) ───

function ImpressionsChart({ series }) {
  const W = 720, H = 200, padX = 8, padTop = 16, padBottom = 28
  const max = Math.max(...series.map(d => d.impressions), 1)
  const innerW = W - padX * 2
  const innerH = H - padTop - padBottom
  const step = series.length > 1 ? innerW / (series.length - 1) : 0

  const pts = series.map((d, i) => ({
    x: padX + i * step,
    y: padTop + innerH - (d.impressions / max) * innerH,
    d,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${padTop + innerH} L ${pts[0].x.toFixed(1)} ${padTop + innerH} Z`
  const baseY = padTop + innerH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Impressions over time">
      <defs>
        <linearGradient id="impFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="text-foreground">
        <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="currentColor" strokeOpacity="0.12" />
        <path d={area} fill="url(#impFill)" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            {/* wide invisible hit area gives a native hover tooltip per day */}
            <rect x={p.x - step / 2} y={padTop} width={Math.max(step, 2)} height={innerH} fill="transparent">
              <title>{`${p.d.date}: ${p.d.impressions.toLocaleString()} impressions`}</title>
            </rect>
            {(i === 0 || i === pts.length - 1 || p.d.impressions === max) && (
              <circle cx={p.x} cy={p.y} r="2.5" className="fill-foreground" />
            )}
          </g>
        ))}
        {/* first / last date labels */}
        <text x={padX} y={H - 8} className="fill-muted-foreground text-[11px]">{series[0]?.date.slice(5)}</text>
        <text x={W - padX} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[11px]">
          {series[series.length - 1]?.date.slice(5)}
        </text>
      </g>
    </svg>
  )
}

// ── connect call-to-action (not-connected state) ─────────────────────────────

function ConnectCard({ onConnect, connecting }) {
  const [handle, setHandle] = useState('')
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <XGlyph className="h-12 w-12 rounded-2xl text-2xl" />
      <h2 className="mt-5 text-lg font-semibold text-foreground">Connect your X account</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        See impressions, engagement rate, and your top posts from the last ~30 days — all in one place.
      </p>

      <ul className="mt-5 w-full space-y-2 text-left text-xs text-muted-foreground">
        {['Impressions & reach over time', 'Engagement rate, likes, reposts & replies', 'Your best-performing posts'].map(item => (
          <li key={item} className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">✓</span>
            {item}
          </li>
        ))}
      </ul>

      {MOCK_MODE && (
        <div className="mt-5 w-full rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-[11px] text-amber-700 dark:text-amber-400">
          <strong>Preview mode.</strong> Connecting loads realistic sample data. Live X data turns on once
          API credentials + the backend proxy are configured.
        </div>
      )}

      <div className="mt-5 w-full">
        <div className="flex items-center rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-ring/40">
          <span className="pl-3 text-sm text-muted-foreground">@</span>
          <input
            value={handle}
            onChange={e => setHandle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onConnect(handle)}
            placeholder="yourhandle"
            className="h-9 flex-1 bg-transparent px-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        </div>
      </div>

      <Button onClick={() => onConnect(handle)} disabled={connecting} className="mt-3 h-9 w-full gap-2">
        {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
        {connecting ? 'Connecting…' : 'Connect X account'}
      </Button>
    </div>
  )
}

// ── main panel ───────────────────────────────────────────────────────────────

export function AnalyticsPanel() {
  const [connection, setConnection] = useState(() => getXConnection())
  const [connecting, setConnecting] = useState(false)
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  const [window, setWindow] = useState('28d')

  const load = useCallback(async (win) => {
    setStatus('loading')
    setError(null)
    try {
      const result = await fetchXAnalytics({ window: win })
      setData(result)
      setStatus('ready')
    } catch (err) {
      setError(err.message || 'Failed to load analytics.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (connection) load(window)
  }, [connection, window, load])

  async function handleConnect(handle) {
    setConnecting(true)
    try {
      const conn = await beginXAuth({ handle })
      setConnection(conn)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    } finally {
      setConnecting(false)
    }
  }

  function handleDisconnect() {
    disconnectX()
    setConnection(null)
    setData(null)
    setStatus('idle')
  }

  // Not connected → CTA.
  if (!connection) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader />
        <ScrollArea className="flex-1">
          <ConnectCard onConnect={handleConnect} connecting={connecting} />
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        connection={connection}
        window={window}
        onWindow={setWindow}
        onRefresh={() => load(window)}
        onDisconnect={handleDisconnect}
        loading={status === 'loading'}
      />

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-6 py-6">

          {MOCK_MODE && data?.mock && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span><strong>Demo data.</strong> Not connected to the live X API yet — these numbers are sample data.</span>
            </div>
          )}

          {status === 'loading' && !data && <LoadingState />}

          {status === 'error' && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />
              <p className="text-sm font-medium text-foreground">Couldn’t load analytics</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => load(window)} className="mt-3 gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}

          {data && (
            <div className={cn('space-y-5 transition-opacity', status === 'loading' && 'opacity-50')}>
              <AccountCard account={data.account} />

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard icon={Eye} label="Impressions" value={compact(data.summary.impressions)}
                  current={data.summary.impressions} prior={data.summary.prior.impressions} />
                <MetricCard icon={BarChart3} label="Engagement" value={pct(data.summary.engagementRate)}
                  current={data.summary.engagementRate} prior={data.summary.prior.engagementRate} />
                <MetricCard icon={Heart} label="Likes" value={compact(data.summary.likes)}
                  current={data.summary.likes} prior={data.summary.prior.likes} />
                <MetricCard icon={Repeat2} label="Reposts" value={compact(data.summary.reposts)}
                  current={data.summary.reposts} prior={data.summary.prior.reposts} />
                <MetricCard icon={MessageCircle} label="Replies" value={compact(data.summary.replies)}
                  current={data.summary.replies} prior={data.summary.prior.replies} />
                <MetricCard icon={MousePointerClick} label="Profile visits" value={compact(data.summary.profileClicks)}
                  current={data.summary.profileClicks} prior={data.summary.prior.profileClicks} />
                <MetricCard icon={Link2} label="Link clicks" value={compact(data.summary.linkClicks)}
                  current={data.summary.linkClicks} prior={data.summary.prior.linkClicks} />
                <MetricCard icon={Users} label="Followers" value={compact(data.account.followers)} />
              </div>

              <div className="rounded-xl border border-border bg-card px-4 py-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Impressions</h3>
                  <span className="text-xs text-muted-foreground">
                    {compact(data.summary.impressions)} over {X_WINDOWS.find(w => w.value === window)?.label}
                  </span>
                </div>
                <ImpressionsChart series={data.series} />
              </div>

              <TopPosts posts={data.topPosts} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function PanelHeader({ connection, window, onWindow, onRefresh, onDisconnect, loading }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <XGlyph className="h-7 w-7 rounded-lg text-sm" />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground">X Analytics</h1>
          {connection
            ? <p className="truncate text-xs text-muted-foreground">@{connection.handle}</p>
            : <p className="text-xs text-muted-foreground">Not connected</p>}
        </div>
      </div>

      {connection && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
            {X_WINDOWS.map(w => (
              <button
                key={w.value}
                onClick={() => onWindow(w.value)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  window === w.value ? 'bg-background text-foreground shadow-sm dark:bg-muted/80' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="h-8 w-8 p-0" title="Refresh">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDisconnect} className="h-8 text-xs text-muted-foreground hover:text-foreground" title="Disconnect X account">
            Disconnect
          </Button>
        </div>
      )}
    </div>
  )
}

function AccountCard({ account }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-base font-semibold text-background">
        {initials(account.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
        <p className="truncate text-xs text-muted-foreground">@{account.handle}</p>
      </div>
      <div className="flex items-center gap-5 text-right">
        <Stat label="Followers" value={compact(account.followers)} delta={account.followerDelta} />
        <Stat label="Following" value={compact(account.following)} />
        <Stat label="Posts" value={compact(account.tweetCount)} />
      </div>
    </div>
  )
}

function Stat({ label, value, delta }) {
  return (
    <div>
      <div className="flex items-center justify-end gap-1">
        <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
        {delta != null && delta !== 0 && (
          <span className={cn('text-[10px] font-medium', delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {delta > 0 ? '+' : ''}{compact(delta)}
          </span>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

function TopPosts({ posts }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Top posts</h3>
        <p className="text-xs text-muted-foreground">Best performing in this window, by impressions</p>
      </div>
      <ul className="divide-y divide-border">
        {posts.map((p, i) => (
          <li key={p.id} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 w-4 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm text-foreground">{p.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted-foreground">
                <span className="text-muted-foreground/70">{timeAgo(p.createdAt)}</span>
                <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{compact(p.impressions)}</span>
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{compact(p.likes)}</span>
                <span className="inline-flex items-center gap-1"><Repeat2 className="h-3 w-3" />{compact(p.reposts)}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{compact(p.replies)}</span>
                <span className="font-medium text-foreground">{pct(p.engagementRate)} eng.</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="mt-3 text-sm">Loading analytics…</p>
    </div>
  )
}
