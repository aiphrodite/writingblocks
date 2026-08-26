// Git-style local-first versioning for writingblocks.
//
// Concepts:
//   - A **commit** is a snapshot of the full ideas[] array at a point in time.
//   - A **branch** is a named pointer to a head commit. Commits form a parent
//     chain; switching branches changes which commit chain you're on.
//   - HEAD = the current branch's head commit.
//
// Backing store is localStorage today; everything funnels through a single
// state object so we can swap to IndexedDB or a remote DB without changing
// callers.

const KEY = 'wb_versioning_v1'
const DEFAULT_BRANCH_NAME = 'main'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persist(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function ensure() {
  let state = load()
  if (!state || !state.branches || !Object.keys(state.branches).length) {
    const branchId = uid()
    state = {
      branches: {
        [branchId]: {
          id: branchId,
          name: DEFAULT_BRANCH_NAME,
          headCommitId: null,
          parentBranchId: null,
          parentCommitId: null,
          createdAt: Date.now(),
        },
      },
      commits: {},
      currentBranchId: branchId,
    }
    persist(state)
  }
  return state
}

export function getCurrentBranch() {
  const state = ensure()
  return state.branches[state.currentBranchId] ?? null
}

export function getBranches() {
  const state = ensure()
  return Object.values(state.branches).sort((a, b) => a.createdAt - b.createdAt)
}

export function getCommit(id) {
  if (!id) return null
  const state = ensure()
  return state.commits[id] ?? null
}

// Walk back from a branch's head, returning commits newest-first.
export function getCommits(branchId) {
  const state = ensure()
  const branch = state.branches[branchId ?? state.currentBranchId]
  if (!branch) return []
  const out = []
  const seen = new Set()
  let cur = branch.headCommitId
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const commit = state.commits[cur]
    if (!commit) break
    out.push(commit)
    cur = commit.parentId
  }
  return out
}

export function commit(snapshot, message) {
  const state = ensure()
  const branch = state.branches[state.currentBranchId]
  if (!branch) throw new Error('No active branch')

  // Skip if the working copy is identical to the current head.
  const head = branch.headCommitId ? state.commits[branch.headCommitId] : null
  if (head && JSON.stringify(head.snapshot) === JSON.stringify(snapshot)) {
    return { commit: head, noop: true }
  }

  const id = uid()
  const newCommit = {
    id,
    parentId: branch.headCommitId,
    branchId: branch.id,
    message: (message ?? '').trim() || `Snapshot — ${new Date().toLocaleString()}`,
    timestamp: Date.now(),
    snapshot,
  }
  state.commits[id] = newCommit
  state.branches[branch.id] = { ...branch, headCommitId: id }
  persist(state)
  return { commit: newCommit, noop: false }
}

export function createBranch(name, fromCommitId) {
  const state = ensure()
  const cleanName = (name || '').trim().slice(0, 64) ||
    `branch-${Object.keys(state.branches).length + 1}`
  if (Object.values(state.branches).some(b => b.name === cleanName)) {
    throw new Error(`Branch "${cleanName}" already exists`)
  }
  const startCommit = fromCommitId ?? state.branches[state.currentBranchId]?.headCommitId ?? null
  const id = uid()
  state.branches[id] = {
    id,
    name: cleanName,
    headCommitId: startCommit,
    parentBranchId: state.currentBranchId,
    parentCommitId: startCommit,
    createdAt: Date.now(),
  }
  state.currentBranchId = id
  persist(state)
  return state.branches[id]
}

export function switchBranch(branchId) {
  const state = ensure()
  if (!state.branches[branchId]) throw new Error('Branch not found')
  state.currentBranchId = branchId
  persist(state)
  return state.branches[branchId]
}

export function deleteBranch(branchId) {
  const state = ensure()
  if (branchId === state.currentBranchId) {
    throw new Error('Cannot delete the current branch')
  }
  if (Object.keys(state.branches).length <= 1) {
    throw new Error('Cannot delete the only branch')
  }
  delete state.branches[branchId]
  // Note: orphan commits are kept (no GC) so branches descending through them
  // would still traverse correctly. We can prune later if storage size becomes
  // an issue.
  persist(state)
}

export function timeAgo(timestamp) {
  const secs = Math.floor((Date.now() - timestamp) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
