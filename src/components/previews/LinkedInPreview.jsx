import { useCallback, useEffect, useRef, useState } from 'react'
import { Globe, MessageSquareText, Repeat2, Send, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// Ported from MIT-licensed gatteo/linkedinpreview.com (post-card / user-info /
// content-section): 14px/20px body in a device-width card, CSS 3-line clamp, and
// the "…more" affordance painted only when the text actually overflows the fold.
const DEVICE_WIDTHS = { desktop: 555, mobile: 320 }
const LINE_HEIGHT = 20
const CLAMP_LINES = 3

export function LinkedInPreview({ text, viewport = 'mobile' }) {
  const contentRef = useRef(null)
  // Expansion is keyed to the viewport so toggling device width re-collapses
  // the fold without needing a state-resetting effect.
  const [expandedViewport, setExpandedViewport] = useState(null)
  const [overflows, setOverflows] = useState(false)
  const expanded = expandedViewport === viewport
  const width = DEVICE_WIDTHS[viewport] ?? DEVICE_WIDTHS.mobile

  // The fold falls out of the layout: scrollHeight always reports the full text
  // height, clamped or not, so comparing it to 3 lines works in both states.
  const measure = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    setOverflows(el.scrollHeight > CLAMP_LINES * LINE_HEIGHT + 1)
  }, [])

  useEffect(() => { measure() }, [text, viewport, expanded, measure])

  useEffect(() => {
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  return (
    <div className="mx-auto" style={{ width: '100%', maxWidth: width }}>
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/15 dark:bg-[#1B1F23]">
        <div className="pt-3 pb-1 pl-4 pr-4">

          {/* User info */}
          <div className="flex gap-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300">
              You
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-5 text-black/90 dark:text-white/90">Your Name</div>
              <div className="truncate text-xs leading-4 text-black/60 dark:text-white/60">Your headline</div>
              <div className="flex items-center gap-1 text-xs leading-4 text-black/60 dark:text-white/60">
                Now <span aria-hidden>•</span> <Globe className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Content with "…see more" fold */}
          <div className="relative mt-3">
            <div
              ref={contentRef}
              className={cn(
                'relative overflow-hidden whitespace-pre-line text-sm leading-5 text-black/90 dark:text-white/90',
                !expanded && 'line-clamp-3'
              )}
            >
              {text || <span className="text-black/40 dark:text-white/40">Your LinkedIn post will appear here…</span>}
              {expanded && overflows && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => setExpandedViewport(null)}
                    className="text-sm font-normal text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    ...less
                  </button>
                </>
              )}
            </div>
            {!expanded && overflows && (
              <button
                type="button"
                onClick={() => setExpandedViewport(viewport)}
                className="absolute bottom-0 right-0 bg-white pl-1 text-sm font-normal text-neutral-500 hover:text-neutral-700 hover:underline dark:bg-[#1B1F23] dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                ...more
              </button>
            )}
          </div>

          {/* Social proof */}
          <div className="mt-2 flex items-center justify-between border-b border-black/10 pb-1.5 text-xs leading-4 text-black/60 dark:border-white/15 dark:text-white/60">
            <span>👍 ❤️ You and 42 others</span>
            <span>4 comments · 1 repost</span>
          </div>

          {/* Action bar */}
          <div className="flex items-stretch py-0.5">
            {[
              { label: 'Like', Icon: ThumbsUp },
              { label: 'Comment', Icon: MessageSquareText },
              { label: 'Repost', Icon: Repeat2 },
              { label: 'Send', Icon: Send },
            ].map(action => (
              <button
                key={action.label}
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded py-2.5 font-semibold text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5',
                  viewport === 'mobile' ? 'text-xs' : 'text-[13px]'
                )}
              >
                <action.Icon className="h-4 w-4" />
                {action.label}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
