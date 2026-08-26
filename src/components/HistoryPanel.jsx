import { useEffect, useState, useCallback } from 'react'
import { History, Save, RotateCcw, ChevronRight, GitBranch, Plus, AlertTriangle, Check } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  commit as commitSnapshot,
  getCommits,
  getBranches,
  getCurrentBranch,
  createBranch,
  switchBranch,
  deleteBranch,
  timeAgo,
} from '@/lib/versioning'
import { cn } from '@/lib/utils'

export function HistoryPanel({ ideas, onRestore }) {
  const [branches, setBranches]       = useState(() => getBranches())
  const [current, setCurrent]         = useState(() => getCurrentBranch())
  const [commits, setCommits]         = useState(() => getCommits())
  const [saveLabel, setSaveLabel]     = useState('')
  const [saveMsg, setSaveMsg]         = useState(null)   // 'saved' | 'nochange' | 'error'
  const [expandedId, setExpandedId]   = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null) // { commit, mode }
  const [branchOpen, setBranchOpen]   = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchFrom, setNewBranchFrom] = useState(null) // commit to branch from

  const refresh = useCallback(() => {
    setBranches(getBranches())
    setCurrent(getCurrentBranch())
    setCommits(getCommits())
  }, [])

  // Refresh on mount and when external state may have changed.
  useEffect(() => { refresh() }, [refresh])

  function handleSave() {
    setSaveMsg(null)
    try {
      const { noop } = commitSnapshot(ideas, saveLabel)
      setSaveLabel('')
      refresh()
      setSaveMsg(noop ? 'nochange' : 'saved')
    } catch {
      setSaveMsg('error')
    }
    setTimeout(() => setSaveMsg(null), 2500)
  }

  function handleSwitch(branchId) {
    if (branchId === current?.id) return
    const branch = switchBranch(branchId)
    const branchCommits = getCommits(branch.id)
    const head = branchCommits[0]
    if (head) onRestore(head.snapshot)
    refresh()
  }

  function handleCreateBranch() {
    try {
      createBranch(newBranchName, newBranchFrom?.id)
      // After branching, working copy should mirror that commit (or empty if no commit yet).
      if (newBranchFrom) onRestore(newBranchFrom.snapshot)
      setNewBranchName('')
      setNewBranchFrom(null)
      setBranchOpen(false)
      refresh()
    } catch (err) {
      setSaveMsg('error')
      console.error(err)
    }
  }

  function openBranchFromCommit(c) {
    setNewBranchFrom(c)
    setBranchOpen(true)
  }

  function handleDeleteBranch(branchId) {
    try {
      deleteBranch(branchId)
      refresh()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Version History</span>
        </div>

        {/* Branch row */}
        <div className="mb-2 flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
          <select
            value={current?.id ?? ''}
            onChange={e => handleSwitch(e.target.value)}
            className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setNewBranchFrom(null); setBranchOpen(true) }}
            className="h-7 w-7 p-0"
            title="New branch from current"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Save snapshot */}
        <div className="flex gap-1.5">
          <input
            value={saveLabel}
            onChange={e => setSaveLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Commit message (optional)"
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-ring/40"
          />
          <Button
            size="sm"
            onClick={handleSave}
            className="h-7 gap-1.5 text-xs shrink-0"
          >
            <Save className="h-3 w-3" />
            Commit
          </Button>
        </div>

        {saveMsg === 'saved' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Commit saved.
          </p>
        )}
        {saveMsg === 'nochange' && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">No changes since last commit.</p>
        )}
        {saveMsg === 'error' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3 w-3" /> Something went wrong.
          </p>
        )}

        {current && branches.length > 1 && current.name !== 'main' && (
          <button
            onClick={() => handleDeleteBranch(current.id)}
            className="mt-1.5 text-[10px] text-muted-foreground/60 underline-offset-2 hover:underline"
          >
            Delete branch
          </button>
        )}
      </div>

      {/* Commit list */}
      <ScrollArea className="flex-1">
        {commits.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs font-medium text-muted-foreground">No commits yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground/60">
              Hit Commit to save the current state of every block.
            </p>
          </div>
        ) : (
          <ul className="px-2 py-2 space-y-0.5">
            {commits.map((c, i) => {
              const isOpen = expandedId === c.id
              const isHead = i === 0
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : c.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left transition-colors',
                      isOpen ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {c.message}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {timeAgo(c.timestamp)} · {c.id.slice(0, 7)} {isHead && '· HEAD'}
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                        isOpen && 'rotate-90'
                      )} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mx-2 mb-1 rounded-b-lg border border-t-0 border-border bg-background/50 px-3 pb-3 pt-2">
                      <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {c.snapshot?.length ?? 0} {c.snapshot?.length === 1 ? 'block' : 'blocks'}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setRestoreTarget({ commit: c })}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore
                        </button>
                        <button
                          onClick={() => openBranchFromCommit(c)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <GitBranch className="h-3 w-3" /> Branch
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>

      {/* Restore confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={open => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this commit?</AlertDialogTitle>
            <AlertDialogDescription>
              Your working copy will be replaced with the snapshot from this commit.
              The branch head will not move — commit again afterwards to capture the restored state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (restoreTarget) onRestore(restoreTarget.commit.snapshot ?? [])
              setRestoreTarget(null)
            }}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New branch dialog */}
      <AlertDialog open={branchOpen} onOpenChange={open => !open && setBranchOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New branch</AlertDialogTitle>
            <AlertDialogDescription>
              {newBranchFrom
                ? <>Forking from commit <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{newBranchFrom.id.slice(0, 7)}</code>: {newBranchFrom.message}</>
                : <>Forking from the current HEAD on <strong>{current?.name}</strong>.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1">
            <input
              autoFocus
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
              placeholder="branch name (e.g. experiment-tone)"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-ring/40 font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateBranch}>Create branch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
