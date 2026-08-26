import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CoverFramePicker } from '@/components/previews/CoverFramePicker'

// Percent insets derived from published creator-guideline pixel values on a
// 1080×1920 canvas. All are approximations — device UI shifts between app
// versions and screen shapes.
const SAFE_ZONES = [
  {
    key: 'tiktok',
    label: 'TikTok',
    color: '244 63 94', // rose-500
    // 130px top / 484px bottom / 140px right / 44px left on 1080×1920
    inset: { top: 6.8, bottom: 25.2, left: 4.1, right: 13.0 },
  },
  {
    key: 'reels',
    label: 'Reels',
    color: '168 85 247', // purple-500
    // ~220px top / ~420px bottom on 1080×1920
    inset: { top: 11.5, bottom: 21.9, left: 0, right: 0 },
  },
  {
    key: 'shorts',
    label: 'Shorts',
    color: '34 197 94', // green-500
    // keep essentials in the central 4:5: (1920 − 1080×5/4) / 2 = 285px top+bottom
    inset: { top: 14.8, bottom: 14.8, left: 0, right: 0 },
  },
]

// Centered 3:4 crop used by Instagram's grid (Jan 2025) and TikTok's profile
// grid: full width, central 75% of the height.
const GRID_CROP_INSET = 12.5

function ZoneOverlay({ zone }) {
  const { inset, color, label } = zone
  const bar = { backgroundColor: `rgb(${color} / 0.28)` }
  return (
    <div className="pointer-events-none absolute inset-0">
      {inset.top > 0 && <div className="absolute inset-x-0 top-0" style={{ height: `${inset.top}%`, ...bar }} />}
      {inset.bottom > 0 && <div className="absolute inset-x-0 bottom-0" style={{ height: `${inset.bottom}%`, ...bar }} />}
      {inset.left > 0 && (
        <div className="absolute left-0" style={{ top: `${inset.top}%`, bottom: `${inset.bottom}%`, width: `${inset.left}%`, ...bar }} />
      )}
      {inset.right > 0 && (
        <div className="absolute right-0" style={{ top: `${inset.top}%`, bottom: `${inset.bottom}%`, width: `${inset.right}%`, ...bar }} />
      )}
      <div
        className="absolute border border-dashed"
        style={{
          top: `${inset.top}%`,
          bottom: `${inset.bottom}%`,
          left: `${inset.left}%`,
          right: `${inset.right}%`,
          borderColor: `rgb(${color} / 0.9)`,
        }}
      >
        <span
          className="absolute left-1 top-0.5 rounded-sm px-1 text-[8px] font-semibold uppercase tracking-wider text-white"
          style={{ backgroundColor: `rgb(${color} / 0.85)` }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

function GridCropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-x-0 border-y-2 border-dashed border-white/80"
        style={{ top: `${GRID_CROP_INSET}%`, bottom: `${GRID_CROP_INSET}%` }}
      >
        <span className="absolute right-1 top-0.5 rounded-sm bg-white/85 px-1 text-[8px] font-semibold uppercase tracking-wider text-black">
          3:4 grid
        </span>
      </div>
      <div className="absolute inset-x-0 top-0 bg-black/50" style={{ height: `${GRID_CROP_INSET}%` }} />
      <div className="absolute inset-x-0 bottom-0 bg-black/50" style={{ height: `${GRID_CROP_INSET}%` }} />
    </div>
  )
}

export function ShortsPreview({ text, cover, onCoverChange, viewport = 'mobile' }) {
  const [activeZones, setActiveZones] = useState({ tiktok: true, reels: false, shorts: false, grid: false })
  const toggleZone = (key) => setActiveZones(prev => ({ ...prev, [key]: !prev[key] }))
  const frameWidth = viewport === 'desktop' ? 300 : 240

  return (
    <div>
      <div
        className="relative mx-auto overflow-hidden rounded-2xl bg-black shadow-lg"
        style={{ aspectRatio: '9 / 16', maxWidth: frameWidth }}
      >
        {cover && <img src={cover} alt="Cover frame" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-4">
          <p className="whitespace-pre-wrap break-words text-sm font-medium leading-snug text-white drop-shadow">
            {text || <span className="text-white/40">Your shorts script will appear here…</span>}
          </p>
          <div className="mt-3 text-[10px] uppercase tracking-widest text-white/50">Shorts · 9:16</div>
        </div>
        {SAFE_ZONES.filter(zone => activeZones[zone.key]).map(zone => (
          <ZoneOverlay key={zone.key} zone={zone} />
        ))}
        {activeZones.grid && <GridCropOverlay />}
      </div>

      <div className="mx-auto mt-3" style={{ maxWidth: Math.max(frameWidth, 300) }}>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {[...SAFE_ZONES.map(({ key, label }) => ({ key, label })), { key: 'grid', label: '3:4 grid' }].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleZone(key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                activeZones[key]
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
          Safe zones are approximations — device UI varies.
        </p>
        <CoverFramePicker onCover={onCoverChange} />
      </div>
    </div>
  )
}
