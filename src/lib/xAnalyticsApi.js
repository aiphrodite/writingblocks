/**
 * X (Twitter) analytics client.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STATUS: MOCK MODE. We don't have X API credentials yet, so this module
 * returns realistically-shaped sample data. Every object below mirrors the
 * real X API v2 response shape, so the UI does not have to change when we
 * flip MOCK_MODE off — only this file does.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * GOING LIVE — the real data path
 * --------------------------------
 * The interesting analytics (impressions, profile clicks, link clicks via the
 * `non_public_metrics` / `organic_metrics` fields) require OAuth 2.0 *user
 * context* and are only available for the authenticated user's OWN posts from
 * the last ~30 days. The OAuth client secret and the user's access token must
 * NOT live in the browser, and X blocks browser CORS on these endpoints — so
 * the live path goes through this app's own backend proxy (e.g. Supabase Edge
 * Functions in the writingblocks project), NOT a direct fetch from here. The
 * flow:
 *
 *   1. beginXAuth()  ──▶ full-page redirect to
 *        `${API_BASE}/x/oauth/authorize`
 *      The backend builds the X authorize URL (PKCE challenge + CSRF state)
 *      and 302s the user to https://x.com/i/oauth2/authorize.
 *   2. X redirects back to the backend callback, which exchanges the code for
 *      an access/refresh token, stores it encrypted keyed by the user, then
 *      redirects back to this app (?x_connected=1).
 *   3. fetchXAnalytics() ──▶ GET
 *        `${API_BASE}/x/analytics?window=28d`
 *      The backend reads the stored token, calls X API v2
 *      (GET /2/users/me, GET /2/users/:id/tweets with
 *       tweet.fields=public_metrics,non_public_metrics,organic_metrics),
 *      aggregates, and returns the JSON shape produced by buildMockAnalytics().
 *
 * Required X app scopes:  tweet.read  users.read  offline.access
 * Required X API access:  paid — the free tier was discontinued in 2026, so
 *                         this needs pay-per-use billing or a legacy Basic/Pro
 *                         plan on the developer account.
 */

export const MOCK_MODE = true

const CONNECTION_KEY = 'writingblocks_x_connection'

// Base URL of this app's backend OAuth/analytics proxy. Wired in when
// MOCK_MODE is false.
// const API_BASE = import.meta.env.VITE_X_PROXY_BASE_URL ?? ''

/** Selectable reporting windows. X organic/non-public metrics only cover ~30d. */
export const X_WINDOWS = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '28d', label: '28 days', days: 28 },
]

const DEFAULT_WINDOW = '28d'

// ── Connection state ────────────────────────────────────────────────────────
// In MOCK_MODE this lives in localStorage. In live mode the source of truth is
// the backend (whether a valid token exists for the user); this cache just
// avoids a round-trip on first paint.

export function getXConnection() {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeXConnection(conn) {
  if (conn) localStorage.setItem(CONNECTION_KEY, JSON.stringify(conn))
  else localStorage.removeItem(CONNECTION_KEY)
}

/**
 * Start the connect flow.
 * MOCK: marks the account connected locally and resolves with the connection.
 * LIVE: returns a redirect URL the caller should navigate to (OAuth handoff).
 */
export async function beginXAuth({ handle } = {}) {
  if (MOCK_MODE) {
    const clean = (handle || 'yourhandle').replace(/^@+/, '').trim() || 'yourhandle'
    const conn = { handle: clean, connectedAt: Date.now(), mock: true }
    writeXConnection(conn)
    return conn
  }
  // LIVE: hand off to the backend OAuth flow with a full-page redirect, e.g.
  //   window.location.href = `${API_BASE}/x/oauth/authorize`
  throw new Error(
    'Live X OAuth is not wired yet. Set MOCK_MODE = false and configure the backend proxy + X app credentials.'
  )
}

/** Disconnect the account. LIVE should also tell the backend to revoke + delete the token. */
export function disconnectX() {
  writeXConnection(null)
}

// ── Analytics fetch ─────────────────────────────────────────────────────────

export async function fetchXAnalytics({ window = DEFAULT_WINDOW } = {}) {
  const conn = getXConnection()
  if (!conn) throw new Error('X account not connected.')

  if (!MOCK_MODE) {
    // LIVE path (backend proxy — see file header):
    //   const res = await fetch(
    //     `${API_BASE}/x/analytics?window=${window}`,
    //     { headers: { Authorization: `Bearer ${supabaseSessionJwt}` } }
    //   )
    //   if (!res.ok) throw new Error((await res.json())?.message || `X analytics error ${res.status}`)
    //   return res.json()
    throw new Error('Live analytics not wired yet.')
  }

  await delay(450) // simulate network latency
  const win = X_WINDOWS.find(w => w.value === window) ?? X_WINDOWS[1]
  return buildMockAnalytics(conn.handle, win)
}

// ── Mock data generation ────────────────────────────────────────────────────
// Deterministic so the dashboard is stable across refreshes (seeded by handle +
// window), but plausible enough to design against.

const SAMPLE_POSTS = [
  'The best writing tool is the one you actually open. Here is how I cut my drafting time in half 🧵',
  'Most "productivity" advice is just procrastination with extra steps.',
  'Shipped a tiny feature today I have wanted for months. Momentum > motivation.',
  'A thread on turning one idea into five pieces of content without sounding repetitive:',
  'Unpopular opinion: your first draft should be embarrassing. That is the point.',
  'I analyzed 100 viral posts. The pattern was not what I expected.',
  'Stop writing for everyone. Write for the one person who needs to hear it today.',
  'Consistency beats virality. Eighteen months of showing up changed everything for me.',
  'Your audience does not want more content. They want the one thing that helps.',
  'Wrote this in 12 minutes. It outperformed posts I agonized over for an hour.',
]

function buildMockAnalytics(handle, win) {
  const rand = mulberry32(hashStr(`${handle}:${win.value}`))
  const today = startOfDay(new Date())

  // Daily impressions series, with a gentle upward trend + weekday noise.
  const base = 1200 + Math.floor(rand() * 1800)
  const series = []
  for (let i = win.days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const trend = 1 + (win.days - i) * 0.012
    const noise = 0.7 + rand() * 0.6
    const impressions = Math.round(base * trend * noise)
    series.push({ date: date.toISOString().slice(0, 10), impressions })
  }

  const totalImpressions = series.reduce((s, d) => s + d.impressions, 0)

  // Engagement is a small, plausible fraction of impressions.
  const likes = Math.round(totalImpressions * (0.012 + rand() * 0.01))
  const reposts = Math.round(likes * (0.18 + rand() * 0.12))
  const replies = Math.round(likes * (0.22 + rand() * 0.12))
  const quotes = Math.round(likes * (0.06 + rand() * 0.05))
  const profileClicks = Math.round(totalImpressions * (0.004 + rand() * 0.004))
  const linkClicks = Math.round(totalImpressions * (0.006 + rand() * 0.006))
  const engagements = likes + reposts + replies + quotes
  const engagementRate = engagements / Math.max(totalImpressions, 1)

  // Prior-period comparison drives the up/down deltas in the UI.
  const prior = {
    impressions: Math.round(totalImpressions * (0.78 + rand() * 0.3)),
    engagementRate: engagementRate * (0.82 + rand() * 0.3),
    likes: Math.round(likes * (0.8 + rand() * 0.3)),
    reposts: Math.round(reposts * (0.8 + rand() * 0.35)),
    replies: Math.round(replies * (0.8 + rand() * 0.35)),
    profileClicks: Math.round(profileClicks * (0.8 + rand() * 0.35)),
    linkClicks: Math.round(linkClicks * (0.8 + rand() * 0.35)),
  }

  const followers = 8000 + Math.floor(rand() * 18000)
  const followerDelta = Math.round((rand() - 0.2) * 0.02 * followers)

  // Top posts by impressions within the window.
  const postCount = 6
  const topPosts = Array.from({ length: postCount }, (_, i) => {
    const imp = Math.round((totalImpressions / postCount) * (1.6 - i * 0.18) * (0.85 + rand() * 0.3))
    const pLikes = Math.round(imp * (0.015 + rand() * 0.02))
    const pReposts = Math.round(pLikes * (0.15 + rand() * 0.15))
    const pReplies = Math.round(pLikes * (0.2 + rand() * 0.2))
    const ageDays = Math.floor(rand() * win.days)
    const created = new Date(today)
    created.setDate(created.getDate() - ageDays)
    const eng = pLikes + pReposts + pReplies
    return {
      id: `mock-${handle}-${i}`,
      text: SAMPLE_POSTS[(hashStr(handle) + i) % SAMPLE_POSTS.length],
      createdAt: created.toISOString(),
      impressions: imp,
      likes: pLikes,
      reposts: pReposts,
      replies: pReplies,
      engagementRate: eng / Math.max(imp, 1),
    }
  }).sort((a, b) => b.impressions - a.impressions)

  return {
    mock: true,
    window: win.value,
    fetchedAt: Date.now(),
    account: {
      handle,
      name: handleToName(handle),
      followers,
      following: 400 + Math.floor(rand() * 1500),
      tweetCount: 1200 + Math.floor(rand() * 6000),
      followerDelta,
    },
    summary: {
      impressions: totalImpressions,
      engagements,
      engagementRate,
      likes,
      reposts,
      replies,
      quotes,
      profileClicks,
      linkClicks,
      prior,
    },
    series,
    topPosts,
  }
}

// ── small helpers ───────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function handleToName(handle) {
  return handle
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || handle
}

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
