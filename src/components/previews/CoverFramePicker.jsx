import { useCallback, useEffect, useRef, useState } from 'react'
import { Film, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FILMSTRIP_FRAMES = 8
const THUMB_CAPTURE_WIDTH = 240
const COVER_CAPTURE_WIDTH = 1280

function seekTo(video, time) {
  return new Promise(resolve => {
    const done = () => {
      // Prefer waiting for the seeked frame to be presented, but with a timeout:
      // requestVideoFrameCallback never fires for a hidden video element, and the
      // seeked event already guarantees the frame is drawable per spec.
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(finish)
      }
      setTimeout(finish, 150)
    }
    video.addEventListener('seeked', done, { once: true })
    video.currentTime = time
  })
}

// Chrome reports duration: Infinity for MediaRecorder-produced webms (screen
// recordings) until you seek past the end, which forces it to become finite.
async function resolveDuration(video) {
  if (Number.isFinite(video.duration)) return video.duration
  await seekTo(video, Number.MAX_SAFE_INTEGER)
  return Number.isFinite(video.duration) ? video.duration : 0
}

function captureFrame(video, maxWidth) {
  const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.85)
  )
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

export function CoverFramePicker({ onCover }) {
  const videoRef = useRef(null)
  const inputRef = useRef(null)
  const urlsRef = useRef([]) // filmstrip + video object URLs owned by this picker
  const [frames, setFrames] = useState([])
  const [duration, setDuration] = useState(0)
  const [scrubTime, setScrubTime] = useState(0)
  const [selectedTime, setSelectedTime] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [hasVideo, setHasVideo] = useState(false)

  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url))
    urlsRef.current = []
  }, [])

  // The cover URL itself is owned by the parent (it outlives this picker),
  // so only the video + filmstrip URLs are revoked on unmount.
  useEffect(() => releaseUrls, [releaseUrls])

  const handleFile = useCallback(async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const video = videoRef.current
    releaseUrls()
    setFrames([])
    setSelectedTime(null)
    setError(null)
    setBusy(true)
    try {
      const url = URL.createObjectURL(file)
      urlsRef.current.push(url)
      video.src = url
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve
        video.onerror = () => reject(new Error('Could not decode this video file.'))
      })
      const dur = await resolveDuration(video)
      if (!dur) throw new Error('Could not read the video duration.')
      setDuration(dur)
      setScrubTime(dur / 2)
      setHasVideo(true)
      const list = []
      for (let i = 0; i < FILMSTRIP_FRAMES; i++) {
        const time = dur * ((i + 0.5) / FILMSTRIP_FRAMES)
        await seekTo(video, time)
        const thumb = await captureFrame(video, THUMB_CAPTURE_WIDTH)
        if (thumb) {
          urlsRef.current.push(thumb)
          list.push({ time, url: thumb })
          setFrames([...list])
        }
      }
    } catch (err) {
      setError(err.message)
      setHasVideo(false)
    } finally {
      setBusy(false)
    }
  }, [releaseUrls])

  const pickFrame = useCallback(async (time) => {
    const video = videoRef.current
    if (!video?.src) return
    setBusy(true)
    try {
      await seekTo(video, time)
      const cover = await captureFrame(video, COVER_CAPTURE_WIDTH)
      if (cover) {
        setSelectedTime(time)
        onCover?.(cover)
      }
    } finally {
      setBusy(false)
    }
  }, [onCover])

  const handleClear = useCallback(() => {
    setSelectedTime(null)
    onCover?.(null)
  }, [onCover])

  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-3">
      <video ref={videoRef} muted playsInline preload="metadata" className="hidden" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          <Film className="h-3 w-3" /> Cover frame
        </span>
        <div className="flex items-center gap-1.5">
          {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
          >
            {hasVideo ? 'Change video…' : 'Choose video…'}
          </button>
          {selectedTime != null && (
            <button
              type="button"
              onClick={handleClear}
              title="Remove cover"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {frames.length > 0 && (
        <>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {frames.map(frame => (
              <button
                key={frame.time}
                type="button"
                onClick={() => pickFrame(frame.time)}
                title={`Use frame at ${formatTime(frame.time)}`}
                className={cn(
                  'shrink-0 overflow-hidden rounded border-2',
                  selectedTime === frame.time ? 'border-violet-500' : 'border-transparent hover:border-border'
                )}
              >
                <img src={frame.url} alt={`Frame at ${formatTime(frame.time)}`} className="h-12 w-auto" />
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={scrubTime}
              onChange={e => setScrubTime(Number(e.target.value))}
              className="h-1 flex-1 accent-violet-500"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => pickFrame(scrubTime)}
              className="shrink-0 rounded-md border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              Use {formatTime(scrubTime)}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
