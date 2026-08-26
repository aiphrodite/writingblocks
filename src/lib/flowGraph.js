// Shared graph topology used by both the editor's interactive flow tree and
// the sidebar's mini flow card. `column`/`row` are layout hints — actual pixel
// coordinates are decided by each consumer.

export const FLOW_NODES = [
  { key: 'tweet',    label: 'Tweet',    column: 0, row: 0, glyph: '𝕏'  },
  { key: 'linkedin', label: 'LinkedIn', column: 1, row: 0, glyph: 'in' },
  { key: 'shorts',   label: 'Shorts',   column: 1, row: 1, glyph: '▶'  },
  { key: 'substack', label: 'Substack', column: 2, row: 0, glyph: 'S'  },
  { key: 'vod',      label: 'VOD',      column: 2, row: 1, glyph: 'YT' },
]

export const FLOW_EDGES = [
  ['tweet',    'linkedin'],
  ['tweet',    'shorts'],
  ['linkedin', 'substack'],
  ['linkedin', 'vod'],
  ['shorts',   'vod'],
]

export function platformHasDraft(idea, key) {
  if (key === 'substack') return !!idea?.substackBody
  return !!idea?.[key]
}
