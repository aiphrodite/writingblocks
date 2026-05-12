/**
 * Thin client for generating text with either Anthropic (Claude) or OpenAI.
 * The API key lives only in the user's browser (localStorage settings) and is
 * sent directly to the chosen provider's API — never to any other server.
 */

async function generateWithAnthropic({ apiKey, model, systemPrompt, userContent }) {
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Anthropic API error ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

async function generateWithOpenAI({ apiKey, model, systemPrompt, userContent }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI API error ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/**
 * Generates text with the configured provider.
 * @param {{ provider: 'anthropic' | 'openai', apiKey: string, model: string, systemPrompt: string, userContent: string }} opts
 */
export async function generateWithAI({ provider, apiKey, model, systemPrompt, userContent }) {
  if (!apiKey) {
    const name = provider === 'openai' ? 'OpenAI' : 'Anthropic'
    throw new Error(`No ${name} API key configured. Add it in Settings.`)
  }
  if (provider === 'openai') {
    return generateWithOpenAI({ apiKey, model, systemPrompt, userContent })
  }
  return generateWithAnthropic({ apiKey, model, systemPrompt, userContent })
}

/**
 * Builds the user message describing the idea to rewrite.
 */
export function buildUserContent(idea) {
  const parts = []
  if (idea.title)   parts.push(`Title: ${idea.title}`)
  if (idea.context) parts.push(`Context / Notes:\n${idea.context}`)
  return parts.join('\n\n') || 'No content provided.'
}
