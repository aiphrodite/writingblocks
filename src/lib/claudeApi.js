/**
 * Calls the Anthropic Messages API directly from the browser.
 * The API key is stored in the user's localStorage settings and
 * is only ever sent to api.anthropic.com.
 */
export async function generateWithClaude({ apiKey, model, systemPrompt, userContent }) {
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
      messages: [
        { role: 'user', content: userContent },
      ],
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

/**
 * Builds the user content string for a given platform from an idea.
 */
export function buildUserContent(idea) {
  const parts = []
  if (idea.title)   parts.push(`Title: ${idea.title}`)
  if (idea.context) parts.push(`Context / Notes:\n${idea.context}`)
  return parts.join('\n\n') || 'No content provided.'
}
