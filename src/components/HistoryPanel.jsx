import { useEffect, useState } from 'react'
import { History, Save, RotateCcw, ChevronRight, Loader2, Lightbulb, PenLine, CheckCircle2, AlertTriangle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { fetchGitLog, fetchGitSnapshot, saveGitSnapshot, timeAgo } from '@/lib/gitApi'
import { cn } from '@/lib/utils'

const STATUS_ICON = {
  idea:      { Icon: Lightbulb,     cls: 'text-amber-500'   },
  drafting:  { Icon: PenLine,       cls: 'text-blue-500'    },
  published: { Icon: CheckCircle2,  cls: 'text-emerald-500' },
}

export function HistoryPanel({ ideas, onRestore }) {
  const [commits, setCommits]         = useState(null)   // null = loading
  const [saving, setSaving]           = useState(false)
  const [saveLabel, setSaveLabel]     = useState('')
  const [expanded, setExpanded]       = useState(null)   // hash of expanded commit
  const [preview, setPreview]         = useState({})     // hash -> ideas[]
  const [loadingPreview, setLoadingPreview] = useState(null)
  const [restoreTarget, setRestoreTarget]   = useState(null) // { hash, ideas }
  const [saveMsg, setSaveMsg]         = useState(null)   // 'saved' | 'nochange' | 'error'

  // Load history on mount
  useEffect(() => {
    fetchGitLog().then(setCommits)
  }, [])

  // Reload after save
  async function reload() {
    setCommits(null)
    const fresh = await fetchGitLog()
    setCommits(fresh)
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    const label = saveLabel.trim() || undefined
    const result = await saveGitSnapshot(ideas, label)
    setSaving(false)
    setSaveLabel('')
    if (result.error) {
      setSaveMsg('error')
    } else if (result.noop) {
      setSaveMsg('nochange')
    } else {
      setSaveMsg('saved')
      await reload()
    }
    setTimeout(() => setSaveMsg(null), 3000)
  }

  async function loadPreview(hash) {
    if (preview[hash]) return
    setLoadingPreview(hash)
    try {
      const data = await fetchGitSnapshot(hash)
      setPreview(p => ({ ...p, [hash]: Array.isArray(data) ? data : [] }))
    } catch {
      setPreview(p => ({ ...p, [hash]: [] }))
    } finally {
      setLoadingPreview(null)
    }
  }

  function toggleExpand(hash) {
    const next = expanded === hash ? null : hash
    setExpanded(next)
    if (next) loadPreview(next)
  }

  async function confirmRestore(hash) {
    const data = preview[hash] ?? await fetchGitSnapshot(hash)
    setRestoreTarget({ hash, ideas: Array.isArray(data) ? data : [] })
  }

  function doRestore() {
    if (!restoreTarget) return
    onRestore(restoreTarget.ideas)
    setRestoreTarget(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Version History</span>
        </div>

        {/* Save snapshot */}
        <div className="flex gap-1.5">
          <input
            value={saveLabel}
            onChange={e => setSaveLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
            placeholder="Snapshot label (optional)"
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-ring/40"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-7 gap-1.5 text-xs shrink-0"
          >
            {saving
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Save className="h-3 w-3" />
            }
            Save
          </Button>
        </div>

        {/* Save feedback */}
        {saveMsg === 'saved' && (
          <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">Snapshot saved.</p>
        )}
        {saveMsg === 'nochange' && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">No changes since last snapshot.</p>
        )}
        {saveMsg === 'error' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3 w-3" /> Save failed — check the console.
          </p>
        )}
      </div>

      {/* Commit list */}
      <ScrollArea className="flex-1">
        {commits === null ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : commits.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs font-medium text-muted-foreground">No snapshots yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground/60">
              Save a snapshot to start tracking your writing history.
            </p>
          </div>
        ) : (
          <ul className="px-2 py-2 space-y-0.5">
            {commits.map((commit, i) => {
              const isOpen = expanded === commit.hash
              const snapshotIdeas = preview[commit.hash]
              return (
                <li key={commit.hash}>
                  <button
                    onClick={() => toggleExpand(commit.hash)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left transition-colors',
                      isOpen ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {commit.subject || 'Snapshot'}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {timeAgo(commit.date)} · {commit.hash.slice(0, 7)}
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                        isOpen && 'rotate-90'
                      )} />
                    </div>
                  </button>

                  {/* Expanded preview */}
                  {isOpen && (
                    <div className="mx-2 mb-1 rounded-b-lg border border-t-0 border-border bg-background/50 px-3 pb-3 pt-2">
                      {loadingPreview === commit.hash ? (
                        <div className="flex justify-center py-3">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        </div>
                      ) : snapshotIdeas && snapshotIdeas.length > 0 ? (
                        <>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {snapshotIdeas.length} {snapshotIdeas.length === 1 ? 'idea' : 'ideas'}
                          </p>
                          <ul className="space-y-1 mb-2">
                            {snapshotIdeas.slice(0, 5).map(idea => {
                              const s = STATUS_ICON[idea.status]
                              return (
                                <li key={idea.id} className="flex items-center gap-1.5">
                                  {s && <s.Icon className={cn('h-3 w-3 shrink-0', s.cls)} />}
                                  <span className="truncate text-[11px] text-foreground">
                                    {idea.title || <em className="text-muted-foreground">Untitled</em>}
                                  </span>
                                </li>
                              )
                            })}
                            {snapshotIdeas.length > 5 && (
                              <li className="text-[10px] text-muted-foreground pl-4">
                                +{snapshotIdeas.length - 5} more…
                              </li>
                            )}
                          </ul>
                          <button
                            onClick={() => confirmRestore(commit.hash)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                          >
                            <RotateCcw className="h-3 w-3" /> Restore this version
                          </button>
                        </>
                      ) : (
                        <p className="py-2 text-center text-[11px] text-muted-foreground">No ideas in this snapshot.</p>
                      )}
                    </div>
                  )}

                  {i < commits.length - 1 && (
                    <div className="mx-3 border-b border-border/50" />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={open => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current writing will be replaced with the selected snapshot.
              Consider saving a snapshot first if you want to keep your current work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
