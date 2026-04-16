import { useState } from 'react'
import { Plus, Search, History, Settings, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HistoryPanel } from '@/components/HistoryPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  idea:      { bg: 'bg-amber-50   dark:bg-amber-950/40',   ring: 'ring-amber-200   dark:ring-amber-800/60'   },
  drafting:  { bg: 'bg-blue-50    dark:bg-blue-950/40',    ring: 'ring-blue-200    dark:ring-blue-800/60'    },
  published: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', ring: 'ring-emerald-200 dark:ring-emerald-800/60' },
}

const FILTERS = ['all', 'idea', 'drafting', 'published']

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full ring-1', cfg?.bg, cfg?.ring)} />
  )
}

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

// tab: 'list' | 'history'
export function Sidebar({ ideas, activeId, onSelect, onAdd, onRestore }) {
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [tab, setTab]             = useState('list')      // active sidebar tab
  const [settingsOpen, setSettingsOpen] = useState(false)

  function toggleSettings() {
    setSettingsOpen(o => !o)
  }

  const visible = ideas.filter(idea => {
    if (filter !== 'all' && idea.status !== filter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return idea.title.toLowerCase().includes(q) || idea.context.toLowerCase().includes(q)
  })

  const counts = {
    all:       ideas.length,
    idea:      ideas.filter(i => i.status === 'idea').length,
    drafting:  ideas.filter(i => i.status === 'drafting').length,
    published: ideas.filter(i => i.status === 'published').length,
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Writing Blocks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Settings */}
          <Button
            size="sm"
            variant={settingsOpen ? 'secondary' : 'ghost'}
            onClick={toggleSettings}
            className="h-8 w-8 p-0"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* New idea */}
          <Button size="sm" onClick={onAdd} className="h-8 w-8 rounded-full p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {settingsOpen ? (
        <SettingsPanel ideas={ideas} />
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
              Ideas
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

          {/* ── Tab: Ideas list ── */}
          {tab === 'list' && (
            <>
              {/* Search */}
              <div className="px-3 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search ideas…"
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-1 px-3 pb-2">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => {
                      setFilter(f)
                      const nextVisible = f === 'all' ? ideas : ideas.filter(i => i.status === f)
                      if (nextVisible.length > 0 && !nextVisible.find(i => i.id === activeId)) {
                        onSelect(nextVisible[0].id)
                      }
                    }}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors',
                      filter === f
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {f}
                    {counts[f] > 0 && (
                      <span className={cn('ml-1 text-[10px]', filter === f ? 'text-muted-foreground' : 'text-muted-foreground/60')}>
                        {counts[f]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Idea list */}
              <ScrollArea className="flex-1 px-2">
                {visible.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground">
                    {search ? 'No matches found.' : 'No ideas yet.'}
                  </div>
                ) : (
                  <ul className="space-y-0.5 pb-4">
                    {visible.map(idea => {
                      const previewText = idea.context || idea.tweet || idea.linkedin || idea.substackBody || ''
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
                            <div className="flex items-start gap-2.5">
                              <StatusDot status={idea.status} />
                              <div className="min-w-0 flex-1">
                                <p className={cn('truncate text-sm font-medium leading-tight', !idea.title && 'italic text-muted-foreground')}>
                                  {idea.title || 'Untitled idea'}
                                </p>
                                {previewText && (
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{previewText}</p>
                                )}
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  {idea.tweet        && <PlatformPip label="X"  color="bg-foreground" />}
                                  {idea.linkedin     && <PlatformPip label="in" color="bg-blue-600"   />}
                                  {idea.substackBody && <PlatformPip label="S"  color="bg-orange-500" />}
                                </div>
                              </div>
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
    </aside>
  )
}
