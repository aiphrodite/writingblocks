import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CoverFramePicker } from '@/components/previews/CoverFramePicker'

function Thumb({ cover, grayscale, className, rounded = 'rounded-xl' }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-neutral-800', rounded, className)} style={{ aspectRatio: '16 / 9' }}>
      {cover ? (
        <img
          src={cover}
          alt="Video thumbnail"
          className={cn('absolute inset-0 h-full w-full object-cover', grayscale && 'grayscale')}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-white/40">
          No thumbnail
        </div>
      )}
    </div>
  )
}

export function VodPreview({ title, text, cover, onCoverChange }) {
  const [grayscale, setGrayscale] = useState(false)
  const displayTitle = title || 'Untitled video'

  return (
    <div>
      {/* Player-style script preview */}
      <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
          {cover && <img src={cover} alt="Cover frame" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-4">
            <p className="line-clamp-3 text-sm text-white">
              {text || <span className="text-white/40">Your VOD script will appear here…</span>}
            </p>
          </div>
          <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-white/70">16:9</div>
        </div>
        <div className="px-3 py-2">
          <div className="truncate text-sm font-semibold text-foreground">
            {title || <span className="text-muted-foreground/40">Untitled video</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">Your channel · Just now</div>
        </div>
      </div>

      {/* YouTube card mock — hand-rolled approximation of the home grid and
          search/suggested layouts, dark theme */}
      <div className="mt-4 rounded-lg bg-[#0f0f0f] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            YouTube card mock · approximate
          </span>
          <button
            type="button"
            onClick={() => setGrayscale(value => !value)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
              grayscale ? 'border-white bg-white text-black' : 'border-white/25 text-white/60 hover:text-white'
            )}
          >
            Grayscale check
          </button>
        </div>

        {/* Home grid card */}
        <Thumb cover={cover} grayscale={grayscale} className="w-full" />
        <div className="mt-3 flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-white/70">Y</div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-medium leading-5 text-white">{displayTitle}</h3>
            <div className="mt-0.5 text-xs leading-4 text-[#aaaaaa]">Your channel</div>
            <div className="text-xs leading-4 text-[#aaaaaa]">1.2K views · 1 hour ago</div>
          </div>
        </div>

        {/* Small-size (search / suggested, 168×94) legibility check */}
        <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
          <Thumb cover={cover} grayscale={grayscale} className="w-[168px]" rounded="rounded-lg" />
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-[13px] font-medium leading-[18px] text-white">{displayTitle}</h4>
            <div className="mt-0.5 text-xs leading-4 text-[#aaaaaa]">Your channel · 1.2K views</div>
            <div className="mt-1 text-[10px] text-white/40">168×94 — is the thumbnail still legible?</div>
          </div>
        </div>
      </div>

      <CoverFramePicker onCover={onCoverChange} />
    </div>
  )
}
