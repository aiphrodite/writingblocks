import twitterText from 'twitter-text'

const {
  parseTweet,
  extractHashtagsWithIndices,
  extractUrlsWithIndices,
  extractMentionsWithIndices,
  extractCashtagsWithIndices,
  modifyIndicesFromUTF16ToUnicode,
} = twitterText

// Weighted tweet limit: URLs count as 23, CJK/emoji weigh 2 (twitter-text config v3).
export const TWEET_WEIGHTED_MAX = 280

export function parseDraftTweet(text) {
  return parseTweet(text ?? '')
}

const STUB_ID = '1'

// Neutral gray avatar as an inline SVG so react-tweet's <img> has a real src.
const AVATAR_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='24' fill='%23cfd9de'/%3E%3Ccircle cx='24' cy='19' r='8' fill='%23647786'/%3E%3Cpath d='M8 46a16 16 0 0 1 32 0z' fill='%23647786'/%3E%3C/svg%3E"

function toDisplayUrl(url) {
  const stripped = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  return stripped.length > 27 ? `${stripped.slice(0, 27)}…` : stripped
}

// twitter-text extractors return UTF-16 indices; react-tweet slices the text with
// Array.from (code points), so indices must be converted before handing them over.
function withUnicodeIndices(text, entities) {
  const copies = entities.map(entity => ({ ...entity, indices: [...entity.indices] }))
  modifyIndicesFromUTF16ToUnicode(text, copies)
  return copies
}

/**
 * Build a react-tweet `Tweet` (react-tweet/api) data object from a plain draft
 * string — no fetching. Counts, ids and edit_control are stubs; entities and
 * display_text_range are generated with twitter-text so hashtags, mentions,
 * cashtags and links render exactly like the real embed.
 */
export function draftToTweet(text) {
  const draft = text || ''

  const hashtags = withUnicodeIndices(draft, extractHashtagsWithIndices(draft))
    .map(e => ({ indices: e.indices, text: e.hashtag }))
  const urls = withUnicodeIndices(draft, extractUrlsWithIndices(draft))
    .map(e => ({ indices: e.indices, url: e.url, expanded_url: e.url, display_url: toDisplayUrl(e.url) }))
  const user_mentions = withUnicodeIndices(draft, extractMentionsWithIndices(draft))
    .map(e => ({ indices: e.indices, id_str: STUB_ID, name: e.screenName, screen_name: e.screenName }))
  const symbols = withUnicodeIndices(draft, extractCashtagsWithIndices(draft))
    .map(e => ({ indices: e.indices, text: e.cashtag }))

  return {
    __typename: 'Tweet',
    id_str: STUB_ID,
    text: draft,
    lang: 'en',
    display_text_range: [0, Array.from(draft).length],
    entities: { hashtags, urls, user_mentions, symbols },
    created_at: new Date().toISOString(),
    favorite_count: 0,
    conversation_count: 0,
    news_action_type: 'conversation',
    possibly_sensitive: false,
    edit_control: {
      edit_tweet_ids: [STUB_ID],
      editable_until_msecs: '0',
      is_edit_eligible: false,
      edits_remaining: '5',
    },
    isEdited: false,
    isStaleEdit: false,
    user: {
      id_str: STUB_ID,
      name: 'You',
      screen_name: 'you',
      profile_image_url_https: AVATAR_DATA_URI,
      profile_image_shape: 'Circle',
      verified: false,
      is_blue_verified: false,
    },
  }
}
