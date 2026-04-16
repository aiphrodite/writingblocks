import { useEffect, useRef, useState, useCallback } from 'react'
import { Trash2, Lightbulb, PenLine, CheckCircle2, Sparkles, Loader2, ArrowRight, Check, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'
import { generateWithClaude, buildUserContent } from '@/lib/claudeApi'
import { saveGitSnapshot } from '@/lib/gitApi'

const TWEET_MAX = 280
const LINKEDIN_MAX = 3000

const STATUS_OPTIONS = [
  { value: 'idea',      label: 'Idea',      icon: Lightbulb,    color: 'text-amber-500'   },
  { value: 'drafting',  label: 'Drafting',  icon: PenLine,      color: 'text-blue-500'    },
  { value: 'published', label: 'Published', icon: CheckCircle2, color: 'text-emerald-500' },
]

const NEXT_STATUS = { idea: 'drafting', drafting: 'published' }
const NEXT_LABEL  = { idea: 'Start Drafting', drafting: 'Mark Published' }

function CharCounter({ current, max, isWords = false }) {
  const pct = max ? current / max : 0
  return (
    <span className={cn(
      'font-mono text-xs tabular-nums shrink-0',
      pct >= 1    ? 'text-destructive font-semibold' :
      pct >= 0.85 ? 'text-amber-500' :
                    'text-muted-foreground'
    )}>
      {isWords ? `${current} words` : `${current} / ${max}`}
    </span>
  )
}

function wordCount(str) {
  return str.trim() ? str.trim().split(/\s+/).length : 0
}

function PlatformTip({ children }) {
  return (
    <p className="shrink-0 border-t border-border pt-2 pb-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Tip: </span>{children}
    </p>
  )
}

function StatusPicker({ value, onChange }) {
  const current = STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0]
  const Icon = current.icon
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none h-7 rounded-full border border-border bg-background pl-7 pr-6 text-xs font-medium text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Icon className={cn('pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5', current.color)} />
      <svg className="pointer-events-none absolute right-1.5 top-2 h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

export function Editor({ idea, onChange, onDelete, ideas }) {
  const titleRef = useRef(null)
  const [activeTab, setActiveTab] = useState('tweet')
  const [generating, setGenerating] = useState({ tweet: false, linkedin: false, substack: false })
  // { platform, text } when we have a pending AI result awaiting approval
  const [pendingResult, setPendingResult] = useState(null)
  const [genError, setGenError] = useState(null)
  const { settings } = useSettings()

  useEffect(() => {
    if (idea && !idea.title) titleRef.current?.focus()
  }, [idea?.id])

  // Cancel generation / clear pending result when switching tabs via write side
  const handleWriteClick = useCallback((platform) => {
    setGenerating(g => ({ ...g, [platform]: false }))
    setPendingResult(prev => prev?.platform === platform ? null : prev)
    setGenError(null)
  }, [])

  // Trigger AI generation for a platform
  const handleGenerate = useCallback(async (platform) => {
    if (!idea) return
    setActiveTab(platform)
    setGenerating(g => ({ ...g, [platform]: true }))
    setPendingResult(null)
    setGenError(null)

    // 1. Save current state to version history before generating
    try {
      if (ideas && ideas.length > 0) {
        await saveGitSnapshot(ideas, `Before AI generation — ${idea.title || 'Untitled'} (${platform})`)
      }
    } catch {
      // Non-blocking: if git snapshot fails (e.g. in production), continue anyway
    }

    // 2. Call Claude
    try {
      const promptKey = platform === 'tweet'
        ? 'aiPromptTweet'
        : platform === 'linkedin'
          ? 'aiPromptLinkedin'
          : 'aiPromptSubstack'

      const text = await generateWithClaude({
        apiKey: settings.aiApiKey,
        model: settings.aiModel || 'claude-sonnet-4-5',
        systemPrompt: settings[promptKey],
        userContent: buildUserContent(idea),
      })

      setGenerating(g => ({ ...g, [platform]: false }))
      setPendingResult({ platform, text })
    } catch (err) {
      setGenerating(g => ({ ...g, [platform]: false }))
      setGenError({ platform, message: err.message })
    }
  }, [idea, ideas, settings])

  // Approve: apply AI result to the idea field + save to history
  const handleApprove = useCallback(async (platform, text) => {
    setPendingResult(null)
    if (platform === 'substack') {
      // Parse "Title: ..." from first line if present
      const lines = text.split('\n')
      const titleLine = lines[0]?.match(/^Title:\s*(.+)/i)
      if (titleLine) {
        onChange({ substackTitle: titleLine[1].trim(), substackBody: lines.slice(1).join('\n').trim() })
      } else {
        onChange({ substackBody: text })
      }
    } else if (platform === 'tweet') {
      onChange({ tweet: text })
    } else if (platform === 'linkedin') {
      onChange({ linkedin: text })
    }

    // Save post-approval snapshot
    try {
      if (ideas && ideas.length > 0) {
        // Build updated ideas list for the snapshot
        const updatedIdea = platform === 'substack'
          ? (() => {
              const lines = text.split('\n')
              const titleLine = lines[0]?.match(/^Title:\s*(.+)/i)
              return titleLine
                ? { ...idea, substackTitle: titleLine[1].trim(), substackBody: lines.slice(1).join('\n').trim() }
                : { ...idea, substackBody: text }
            })()
          : { ...idea, [platform]: text }
        const updatedIdeas = ideas.map(i => i.id === idea.id ? updatedIdea : i)
        await saveGitSnapshot(updatedIdeas, `AI generated ${platform} — ${idea.title || 'Untitled'}`)
      }
    } catch {
      // Non-blocking
    }
  }, [idea, ideas, onChange])

  // Reject: just dismiss the pending result
  const handleReject = useCallback(() => {
    setPendingResult(null)
    setGenError(null)
  }, [])

  if (!idea) return <EmptyState />

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 pt-5 pb-4">
        <input
          ref={titleRef}
          value={idea.title}
          onChange={e => onChange({ title: e.target.value })}
          placeholder="What do you want to write about?"
          maxLength={200}
          className="w-full bg-transparent text-xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/30 outline-none"
        />
        <div className="mt-3 flex items-center gap-3">
          <StatusPicker value={idea.status} onChange={val => onChange({ status: val })} />

          {NEXT_STATUS[idea.status] && (
            <button
              onClick={() => onChange({ status: NEXT_STATUS[idea.status] })}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {NEXT_LABEL[idea.status]}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}

          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete idea?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{idea.title || 'Untitled idea'}&quot; and all its drafts will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Context notes */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Context &amp; Notes</span>
          <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground/60">Your raw material — messy is fine.</span>
        </div>
        <Textarea
          value={idea.context}
          onChange={e => onChange({ context: e.target.value })}
          placeholder="What's the story? What's the key insight? Who's the audience? Jot it all down…"
          className="min-h-[88px] resize-none text-sm leading-relaxed"
        />
      </div>

      {/* Platform tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => { setActiveTab(val); handleWriteClick(val) }}
        className="flex flex-1 flex-col overflow-hidden gap-0"
      >
        <div className="shrink-0 border-b border-border bg-background px-4">
          <TabsList variant="line" className="h-auto w-auto rounded-none bg-transparent p-0 gap-1">
            <PlatformTab
              value="tweet"
              label="Tweet"
              glyph="𝕏"
              isActive={activeTab === 'tweet'}
              isGenerating={generating.tweet}
              onWriteClick={() => handleWriteClick('tweet')}
              onGenerate={() => handleGenerate('tweet')}
            />
            <PlatformTab
              value="linkedin"
              label="LinkedIn"
              glyph="in"
              isActive={activeTab === 'linkedin'}
              isGenerating={generating.linkedin}
              onWriteClick={() => handleWriteClick('linkedin')}
              onGenerate={() => handleGenerate('linkedin')}
            />
            <PlatformTab
              value="substack"
              label="Substack"
              glyph="S"
              isActive={activeTab === 'substack'}
              isGenerating={generating.substack}
              onWriteClick={() => handleWriteClick('substack')}
              onGenerate={() => handleGenerate('substack')}
            />
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Tweet */}
          <TabsContent value="tweet" className="m-0 flex flex-col px-6 pt-4">
            {pendingResult?.platform === 'tweet' ? (
              <AiResultPanel
                text={pendingResult.text}
                platform="tweet"
                onApprove={() => handleApprove('tweet', pendingResult.text)}
                onReject={handleReject}
              />
            ) : genError?.platform === 'tweet' ? (
              <AiErrorPanel message={genError.message} onDismiss={handleReject} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 pb-2">
                  <p className="text-xs italic text-muted-foreground">Short, punchy, skimmable. Hook in the first line.</p>
                  <CharCounter current={idea.tweet.length} max={TWEET_MAX} />
                </div>
                <Textarea
                  value={idea.tweet}
                  onChange={e => onChange({ tweet: e.target.value })}
                  placeholder="Write your tweet here…"
                  maxLength={TWEET_MAX}
                  className="min-h-[180px] resize-none text-sm leading-relaxed"
                />
                <PlatformTip>Lead with the insight, not the setup. Use line breaks for breathing room. One clear CTA or question at the end.</PlatformTip>
              </>
            )}
          </TabsContent>

          {/* LinkedIn */}
          <TabsContent value="linkedin" className="m-0 flex flex-col px-6 pt-4">
            {pendingResult?.platform === 'linkedin' ? (
              <AiResultPanel
                text={pendingResult.text}
                platform="linkedin"
                onApprove={() => handleApprove('linkedin', pendingResult.text)}
                onReject={handleReject}
              />
            ) : genError?.platform === 'linkedin' ? (
              <AiErrorPanel message={genError.message} onDismiss={handleReject} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 pb-2">
                  <p className="text-xs italic text-muted-foreground">Professional tone, personal story. Hook before "see more" (first 2–3 lines).</p>
                  <CharCounter current={idea.linkedin.length} max={LINKEDIN_MAX} />
                </div>
                <Textarea
                  value={idea.linkedin}
                  onChange={e => onChange({ linkedin: e.target.value })}
                  placeholder="Write your LinkedIn post here…"
                  maxLength={LINKEDIN_MAX}
                  className="min-h-[260px] resize-none text-sm leading-relaxed"
                />
                <PlatformTip>Open bold or counterintuitive. Short paragraphs. End with a question to drive comments.</PlatformTip>
              </>
            )}
          </TabsContent>

          {/* Substack */}
          <TabsContent value="substack" className="m-0 flex flex-col gap-3 px-6 pt-4">
            {pendingResult?.platform === 'substack' ? (
              <AiResultPanel
                text={pendingResult.text}
                platform="substack"
                onApprove={() => handleApprove('substack', pendingResult.text)}
                onReject={handleReject}
              />
            ) : genError?.platform === 'substack' ? (
              <AiErrorPanel message={genError.message} onDismiss={handleReject} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs italic text-muted-foreground">Long-form essay or newsletter. Room for nuance, stories, and depth.</p>
                  <CharCounter current={wordCount(idea.substackBody)} isWords />
                </div>
                <Input
                  value={idea.substackTitle}
                  onChange={e => onChange({ substackTitle: e.target.value })}
                  placeholder="Post title…"
                  className="text-sm font-semibold"
                />
                <Textarea
                  value={idea.substackBody}
                  onChange={e => onChange({ substackBody: e.target.value })}
                  placeholder="Write your Substack post here…"
                  className="min-h-[300px] resize-none text-sm leading-relaxed"
                />
                <PlatformTip>Start with why this matters. Use a narrative arc. Include concrete examples or data. End with reflection or a CTA.</PlatformTip>
              </>
            )}
          </TabsContent>

        </div>
      </Tabs>
    </div>
  )
}

function PlatformTab({ value, label, glyph, isActive, isGenerating, onWriteClick, onGenerate }) {
  return (
    <TabsTrigger
      value={value}
      onClick={onWriteClick}
      className="relative rounded-none border-b-2 border-transparent p-0 py-2 data-active:border-foreground data-active:shadow-none data-active:bg-transparent transition-colors"
    >
      {/* Pill toggle */}
      <div className={cn(
        'flex items-center rounded-full border p-0.5 transition-all duration-200',
        isActive ? 'border-border bg-muted/50' : 'border-transparent'
      )}>

        {/* Left: write mode */}
        <span className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 select-none',
          isActive && !isGenerating
            ? 'bg-background text-foreground shadow-sm dark:bg-muted/80'
            : 'text-muted-foreground'
        )}>
          <span className="font-black text-[11px]">{glyph}</span>
          {label}
        </span>

        {/* Right: AI mode */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onGenerate() }}
          title={`Generate ${label} with AI`}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200',
            isGenerating
              ? 'bg-violet-500 text-white shadow-sm'
              : isActive
                ? 'text-muted-foreground/50 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/50'
                : 'text-muted-foreground/25 hover:text-muted-foreground/50'
          )}
        >
          {isGenerating
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Sparkles className="h-3 w-3" />
          }
        </button>

      </div>
    </TabsTrigger>
  )
}

function AiResultPanel({ text, platform, onApprove, onReject }) {
  const PLATFORM_LABELS = { tweet: 'Tweet', linkedin: 'LinkedIn post', substack: 'Substack post' }
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-xs font-semibold text-foreground">AI-generated {PLATFORM_LABELS[platform]}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Review before saving</span>
      </div>
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800/40 dark:bg-violet-950/20 px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onApprove}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
        >
          <Check className="h-3.5 w-3.5" />
          Approve &amp; save
        </button>
        <button
          onClick={onReject}
          className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" />
          Discard
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/60">
        Approving will replace your current {PLATFORM_LABELS[platform]} and save a version history snapshot.
      </p>
    </div>
  )
}

function AiErrorPanel({ message, onDismiss }) {
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-destructive">Generation failed</p>
          <p className="text-xs text-muted-foreground">{message}</p>
          {message?.includes('API key') && (
            <p className="text-xs text-muted-foreground">
              Open <strong>Settings</strong> (gear icon) and add your Anthropic API key.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="self-start rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
      >
        Dismiss
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-5xl">✍️</div>
      <h2 className="text-lg font-semibold text-foreground">No idea selected</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        Pick an idea from the sidebar or hit{' '}
        <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">⌘N</kbd>{' '}
        to create one.
      </p>
    </div>
  )
}
