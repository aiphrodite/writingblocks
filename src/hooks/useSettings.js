import { useState, useCallback } from 'react'

const KEY = 'writingblocks_settings'

const DEFAULTS = {
  aiApiKey:  '',
  aiModel:   'claude-sonnet-4-5',
  aiPromptTweet: 'You are a skilled Twitter/X writer. Given the idea title and context notes below, write a compelling tweet (max 280 characters). Be punchy, insightful, and end with a hook or question. Output only the tweet text, nothing else.',
  aiPromptLinkedin: 'You are a skilled LinkedIn writer. Given the idea title and context notes below, write a professional yet personal LinkedIn post (max 3000 characters). Open with a bold hook in the first 2-3 lines, use short paragraphs, and end with a question to drive engagement. Output only the post text, nothing else.',
  aiPromptSubstack: 'You are a skilled newsletter/blog writer. Given the idea title and context notes below, write a compelling Substack post. Include a catchy title on the first line (prefixed with "Title: "), then the full body. Use a narrative arc, concrete examples, and end with a strong CTA or reflection. Output only the title line and body, nothing else.',
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  const update = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, update }
}
