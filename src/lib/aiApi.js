/**
 * Multi-provider AI client. The API key is stored in the user's localStorage
 * settings and is only ever sent to the provider's endpoint.
 *
 * To add a new provider: add an entry to AI_PROVIDERS with `label`, `models`,
 * `defaultModel`, `keyPlaceholder`, `keyHint`, and a `generate` function.
 */

async function generateWithAnthropic({ apiKey, model, systemPrompt, userContent }) {
  if (!apiKey) throw new Error('No Anthropic API key configured. Add it in Settings.')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: userContent }],
      system: systemPrompt,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Anthropic API error ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

async function generateWithOpenai({ apiKey, model, systemPrompt, userContent }) {
  if (!apiKey) throw new Error('No OpenAI API key configured. Add it in Settings.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1024,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI API error ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export const AI_PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    keyPlaceholder: 'sk-ant-…',
    keyHint: 'Stored only in your browser. Never sent anywhere except Anthropic.',
    defaultModel: 'claude-sonnet-4-5',
    models: [
      { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5',   badge: 'powerful' },
      { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', badge: 'balanced' },
      { value: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5',  badge: 'fast'     },
    ],
    generate: generateWithAnthropic,
  },
  openai: {
    label: 'OpenAI',
    keyPlaceholder: 'sk-…',
    keyHint: 'Stored only in your browser. Never sent anywhere except OpenAI.',
    defaultModel: 'gpt-4o',
    models: [
      { value: 'gpt-4o',         label: 'GPT-4o',         badge: 'powerful' },
      { value: 'gpt-4o-mini',    label: 'GPT-4o mini',    badge: 'balanced' },
      { value: 'gpt-3.5-turbo',  label: 'GPT-3.5 Turbo',  badge: 'fast'     },
    ],
    generate: generateWithOpenai,
  },
}

export function generateWithAi({ provider, apiKey, model, systemPrompt, userContent }) {
  const p = AI_PROVIDERS[provider]
  if (!p) throw new Error(`Unknown AI provider: ${provider}`)
  return p.generate({ apiKey, model, systemPrompt, userContent })
}

/**
 * Builds the user content string for a given platform from an idea.
 */
export function buildUserContent(idea) {
  const parts = []
  if (idea.title)   parts.push(`Title: ${idea.title}`)
  if (idea.context) parts.push(`Context / Notes:\n${idea.context}`)
  return parts.join('\n\n') || 'No content provided.'
}
