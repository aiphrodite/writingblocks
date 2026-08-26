import { createContext } from 'react'
import { AI_PROVIDERS } from '@/lib/aiApi'

export const SETTINGS_KEY = 'writingblocks_settings'

export const DEFAULT_SETTINGS = {
  aiProvider: 'anthropic',
  aiAnthropicKey: '',
  aiAnthropicModel: AI_PROVIDERS.anthropic.defaultModel,
  aiOpenaiKey: '',
  aiOpenaiModel: AI_PROVIDERS.openai.defaultModel,
  aiPromptTweet: 'You are a skilled Twitter/X writer. Given the idea title and context notes below, write a compelling tweet (max 280 characters). Be punchy, insightful, and end with a hook or question. Output only the tweet text, nothing else.',
  aiPromptLinkedin: 'You are a skilled LinkedIn writer. Given the idea title, context notes, and (when present) the existing tweet below, write a professional yet personal LinkedIn post (max 3000 characters). Expand on the tweet\'s angle if one is provided. Open with a bold hook in the first 2-3 lines, use short paragraphs, and end with a question to drive engagement. Output only the post text, nothing else.',
  aiPromptSubstack: 'You are a skilled newsletter/blog writer. Given the idea title, context notes, and (when present) the existing tweet and LinkedIn post below, write a compelling Substack post that builds on the upstream drafts. Include a catchy title on the first line (prefixed with "Title: "), then the full body. Use a narrative arc, concrete examples, and end with a strong CTA or reflection. Output only the title line and body, nothing else.',
  aiPromptShorts: 'You are a skilled short-form video scriptwriter (TikTok/Reels/YouTube Shorts). Given the idea title and context notes below, write a punchy 30–60 second script. Start with a hook in the first 3 seconds. Use direct, conversational language and short lines suitable for spoken delivery. Output only the script, nothing else.',
  aiPromptVod: 'You are a skilled long-form video scriptwriter (YouTube, podcast). Given the idea title, context notes, and (when present) the existing short-form script below, write a structured 5–15 minute video script that expands on the short\'s angle. Include an intro hook, clearly delineated body sections, and a closing CTA. Output only the script, nothing else.',
  aiPromptResearch: 'You are a thorough research assistant. Given the short idea below, produce a focused research note that expands the idea: relevant background, key facts and definitions, surprising angles or counterintuitive points, and 2–3 directions worth exploring further. Use 2–4 short paragraphs and bullet lists where helpful. Output only the research note, nothing else.',
}

export const SettingsContext = createContext(null)

export function migrateSettings(stored) {
  if (!stored) return null
  const next = { ...stored }
  if (stored.aiApiKey && !stored.aiAnthropicKey) next.aiAnthropicKey = stored.aiApiKey
  if (stored.aiModel  && !stored.aiAnthropicModel) next.aiAnthropicModel = stored.aiModel
  delete next.aiApiKey
  delete next.aiModel
  return next
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const stored = raw ? migrateSettings(JSON.parse(raw)) : null
    return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveLocalSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
