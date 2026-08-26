const KEY = 'writingblocks_v2'

function fillDefaults(idea) {
  const next = {
    // Legacy items predate the type field — they had all the platform fields,
    // so default them to 'build'.
    type: 'build',
    tweet: '',
    linkedin: '',
    substackTitle: '',
    substackBody: '',
    shorts: '',
    vod: '',
    sourceBlockIds: [],
    flowGraph: null,
    userId: null,
    updatedAt: idea.createdAt ?? Date.now(),
    ...idea,
  }
  if (!Array.isArray(next.sourceBlockIds)) next.sourceBlockIds = []
  // Strip legacy classifiers — blocks are raw ideas, no lifecycle status.
  delete next.status
  delete next.statuses
  return next
}

export function loadIdeas() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) ?? []
    return Array.isArray(raw) ? raw.map(fillDefaults) : []
  } catch {
    return []
  }
}

export function saveIdeas(ideas) {
  localStorage.setItem(KEY, JSON.stringify(ideas))
}

export function createIdea(overrides = {}) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: 'build', // 'block' = short raw idea, 'build' = full multi-platform project
    title: '',
    context: '',
    tweet: '',
    linkedin: '',
    substackTitle: '',
    substackBody: '',
    shorts: '',
    vod: '',
    sourceBlockIds: [],
    flowGraph: null,
    userId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}
