import { useState } from 'react'
import { Plus, Search, History, Settings, LayoutList, Workflow, StickyNote, BarChart3 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HistoryPanel } from '@/components/HistoryPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { AuthPanel } from '@/components/AuthPanel'
import { FLOW_NODES, FLOW_EDGES, platformHasDraft } from '@/lib/flowGraph'
import { cn } from '@/lib/utils'

function PlatformPip({ label, color }) {
  return (
    <span className={cn(
      'inline-flex h-4 w-5 items-center justify-center rounded text-[9px] font-bold text-white leading-none',
      color
    )}>
      {label}
    </span>
  )
}

// Compact non-interactive flow card for the sidebar's "Builds" tab. Each node
// is filled when a draft exists for that platform, outlined otherwise.
function MiniFlow({ idea }) {
  const COL_X = [30, 110, 190]
  const ROW_Y = [22, 62]
  const R = 11

  const pos = Object.fromEntries(
    FLOW_NODES.map(n => [n.key, { x: COL_X[n.column], y: ROW_Y[n.row] }])
  )

  return (
    <svg viewBox="0 0 220 88" className="w-full text-muted-foreground" aria-hidden="true">
      {FLOW_EDGES.map(([from, to]) => {
        const f = pos[from], t = pos[to]
        const x1 = f.x + R, x2 = t.x - R
        const cx = (x1 + x2) / 2
        const d = `M ${x1} ${f.y} C ${cx} ${f.y}, ${cx} ${t.y}, ${x2} ${t.y}`
        return (
          <path key={`${from}-${to}`} d={d} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.9" strokeLinecap="round" />
        )
      })}
      {FLOW_NODES.map(n => {
        const p = pos[n.key]
        const has = platformHasDraft(idea, n.key)
        const fillClass = has ? 'fill-foreground' : 'fill-background'
        const strokeClass = has ? 'text-foreground' : 'text-muted-foreground/40'
        const labelClass = has ? 'fill-background' : 'fill-muted-foreground/60'
        return (
          <g key={n.key} className={strokeClass}>
            <circle cx={p.x} cy={p.y} r={R} className={fillClass} stroke="currentColor" strokeWidth="1" />
            <text
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              className={cn('text-[8px] font-bold', labelClass)}
              style={{ fontFamily: 'inherit' }}
            >
              {n.glyph}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// tab: 'list' | 'builds' | 'history'
export function Sidebar({ ideas, activeId, auth, syncState, onSelect, onAddBlock, onAddBuild, onRestore, onToggleAnalytics, analyticsActive }) {
  const [search, setSearch]       = useState('')
  const [tab, setTab]             = useState('list')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const blocks = ideas.filter(i => i.type !== 'build')
  const builds = ideas.filter(i => i.type === 'build')

  const visibleBlocks = blocks.filter(idea => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return idea.title.toLowerCase().includes(q) || idea.context.toLowerCase().includes(q)
  })

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Writing Blocks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'} · {builds.length} {builds.length === 1 ? 'build' : 'builds'}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {/* X Analytics */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleAnalytics}
                className={cn('h-8 w-8 p-0', analyticsActive && 'bg-accent text-accent-foreground')}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">X Analytics</TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            className="h-8 w-8 p-0"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* New block (short idea) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onAddBlock}
                className="h-8 w-8 p-0"
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New block (⌘N)</TooltipContent>
          </Tooltip>

          {/* New build (full project) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={onAddBuild} className="h-8 w-8 rounded-full p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New build (⇧⌘N)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Settings panel ── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {settingsOpen ? (
          <SettingsPanel ideas={ideas} onClose={() => setSettingsOpen(false)} />
        ) : (
          <>
          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setTab('list')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                tab === 'list'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Blocks
            </button>
            <button
              onClick={() => setTab('builds')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                tab === 'builds'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Workflow className="h-3.5 w-3.5" />
              Builds
            </button>
            <button
              onClick={() => setTab('history')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                tab === 'history'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
          </div>

          {/* ── Tab: History ── */}
          {tab === 'history' && (
            <HistoryPanel
              ideas={ideas}
              onRestore={(restored) => {
                onRestore(restored)
                setTab('list')
              }}
            />
          )}

          {/* ── Tab: Builds ── */}
          {tab === 'builds' && (
            <ScrollArea className="flex-1 px-2 pt-2">
              {builds.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No builds yet.
                </div>
              ) : (
                <ul className="space-y-1.5 pb-4">
                  {builds.map(idea => {
                    const isActive = idea.id === activeId
                    return (
                      <li key={idea.id}>
                        <button
                          onClick={() => onSelect(idea.id)}
                          className={cn(
                            'group w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                            isActive
                              ? 'border-foreground/30 bg-accent text-accent-foreground'
                              : 'border-border bg-background/50 hover:bg-accent/50 text-foreground'
                          )}
                        >
                          <p className={cn('truncate text-sm font-medium leading-tight', !idea.title && 'italic text-muted-foreground')}>
                            {idea.title || 'Untitled block'}
                          </p>
                          <div className="mt-2">
                            <MiniFlow idea={idea} />
                          </div>
                          {Array.isArray(idea.sourceBlockIds) && idea.sourceBlockIds.length > 0 && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {idea.sourceBlockIds.length} input {idea.sourceBlockIds.length === 1 ? 'block' : 'blocks'}
                            </p>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          )}

          {/* ── Tab: Blocks list ── */}
          {tab === 'list' && (
            <>
              {/* Search */}
              <div className="px-3 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search blocks…"
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Block list */}
              <ScrollArea className="flex-1 px-2">
                {visibleBlocks.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    {search ? 'No matches found.' : 'No blocks yet.'}
                  </div>
                ) : (
                  <ul className="space-y-0.5 pb-4">
                    {visibleBlocks.map(idea => {
                      const previewText = idea.context || idea.tweet || idea.linkedin || idea.substackBody || idea.shorts || idea.vod || ''
                      const isActive = idea.id === activeId
                      return (
                        <li key={idea.id}>
                          <button
                            onClick={() => onSelect(idea.id)}
                            className={cn(
                              'group w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'
                            )}
                          >
                            <p className={cn('truncate text-sm font-medium leading-tight', !idea.title && 'italic text-muted-foreground')}>
                              {idea.title || 'Untitled block'}
                            </p>
                            {previewText && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{previewText}</p>
                            )}
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {idea.tweet        && <PlatformPip label="X"  color="bg-foreground" />}
                              {idea.linkedin     && <PlatformPip label="in" color="bg-blue-600"   />}
                              {idea.substackBody && <PlatformPip label="S"  color="bg-orange-500" />}
                              {idea.shorts       && <PlatformPip label="▶"  color="bg-rose-500"   />}
                              {idea.vod          && <PlatformPip label="V"  color="bg-purple-600" />}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>
            </>
          )}
          </>
        )}
      </div>

      <AuthPanel auth={auth} syncState={syncState} />
    </aside>
  )
}
