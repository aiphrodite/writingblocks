const KEY = 'writingblocks_v2'

export function loadIdeas() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
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
    title: '',
    status: 'idea',
    context: '',
    tweet: '',
    linkedin: '',
    substackTitle: '',
    substackBody: '',
    createdAt: Date.now(),
    ...overrides,
  }
}
