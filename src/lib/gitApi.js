export async function fetchGitLog() {
  const res = await fetch('/api/git-log')
  if (!res.ok) return []
  return res.json()
}

export async function fetchGitSnapshot(hash) {
  const res = await fetch(`/api/git-show?hash=${encodeURIComponent(hash)}`)
  if (!res.ok) throw new Error('Snapshot not found')
  return res.json()
}

export async function saveGitSnapshot(ideas, message) {
  const res = await fetch('/api/git-commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ideas, message }),
  })
  return res.json()
}

export function timeAgo(isoDate) {
  const secs = Math.floor((Date.now() - new Date(isoDate)) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
