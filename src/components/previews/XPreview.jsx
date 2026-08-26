import { useMemo } from 'react'
import { TweetContainer, TweetHeader, TweetBody, enrichTweet } from 'react-tweet'
import { draftToTweet } from '@/lib/draftToTweet'
import { cn } from '@/lib/utils'

// Composed from react-tweet's exported subcomponents instead of <EmbeddedTweet>,
// which hard-renders the embed-only TweetInfo / TweetActions / TweetReplies rows
// (the `components` prop can only swap TweetNotFound / AvatarImg / MediaImg).
export function XPreview({ text }) {
  const isEmpty = !text
  const tweet = useMemo(
    () => enrichTweet(draftToTweet(text || 'Your tweet will appear here…')),
    [text]
  )

  return (
    <div className={cn('[&_.react-tweet-theme]:my-0', isEmpty && 'opacity-50')}>
      <TweetContainer>
        <TweetHeader tweet={tweet} />
        <TweetBody tweet={tweet} />
      </TweetContainer>
    </div>
  )
}
