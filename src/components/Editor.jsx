import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Trash2, Sparkles, Loader2, Check, X, Smartphone, Monitor, GitBranch, Plus } from 'lucide-react'
import { HistoryPanel } from '@/components/HistoryPanel'
import { XPreview } from '@/components/previews/XPreview'
import { LinkedInPreview } from '@/components/previews/LinkedInPreview'
import { ShortsPreview } from '@/components/previews/ShortsPreview'
import { VodPreview } from '@/components/previews/VodPreview'
import { parseDraftTweet, TWEET_WEIGHTED_MAX } from '@/lib/draftToTweet'

function YoutubeIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43A2.5 2.5 0 0 0 21.6 16.8 26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3-5.2 3z" />
    </svg>
  )
}
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'
import { generateWithAi, AI_PROVIDERS } from '@/lib/aiApi'
import { commit as commitSnapshot } from '@/lib/versioning'
import { FLOW_NODES, FLOW_EDGES } from '@/lib/flowGraph'

const LINKEDIN_MAX = 3000

const PROMPT_KEY_BY_PLATFORM = {
  tweet:    'aiPromptTweet',
  linkedin: 'aiPromptLinkedin',
  substack: 'aiPromptSubstack',
  shorts:   'aiPromptShorts',
  vod:      'aiPromptVod',
}

// Field and label for each upstream platform.
const UPSTREAM_INFO = {
  tweet:    { field: 'tweet',    label: 'Existing Tweet' },
  linkedin: { field: 'linkedin', label: 'Existing LinkedIn post' },
  shorts:   { field: 'shorts',   label: 'Existing short-form script' },
}

// Default upstream sources for each platform when the user hits the platform's
// own "generate" button. Edge buttons in the flow tree override this with a
// single specific source.
const DEFAULT_UPSTREAM = {
  tweet:    [],
  linkedin: ['tweet'],
  substack: ['linkedin'],
  shorts:   ['tweet'],
  vod:      ['linkedin', 'shorts'],
}

const DIRECT_INPUT_TARGETS = ['tweet', 'linkedin', 'shorts']
const ADD_INPUT_NODE_ID = 'add-input'
const GRAPH_LAYOUTS = {
  flow: 'flow',
  blocks: 'blocks',
}
const POST_NODE_POSITIONS = {
  tweet:    { x: 260, y: 26 },
  linkedin: { x: 500, y: 26 },
  shorts:   { x: 500, y: 154 },
  substack: { x: 740, y: 26 },
  vod:      { x: 740, y: 154 },
}
const BLOCK_POST_NODE_POSITIONS = {
  tweet:    { x: 210, y: 148 },
  linkedin: { x: 390, y: 148 },
  shorts:   { x: 570, y: 148 },
  substack: { x: 300, y: 34 },
  vod:      { x: 480, y: 34 },
}

function getConnectedBlocks(idea, ideas = []) {
  const ids = Array.isArray(idea?.sourceBlockIds) ? idea.sourceBlockIds : []
  const byId = new Map(ideas.map(item => [item.id, item]))
  return ids
    .map(id => byId.get(id))
    .filter(item => item && item.type !== 'build')
}

function formatConnectedBlocks(blocks) {
  return blocks
    .map((block, index) => {
      const title = block.title?.trim() || `Block ${index + 1}`
      const notes = block.context?.trim() || '(No notes yet.)'
      return `Input Block ${index + 1}: ${title}\n${notes}`
    })
    .join('\n\n')
}

function buildFlowUserContent(idea, platform, sources, connectedBlocks = [], inputBlockIds = null) {
  const upstream = sources ?? DEFAULT_UPSTREAM[platform] ?? []
  const inputBlocks = Array.isArray(inputBlockIds)
    ? connectedBlocks.filter(block => inputBlockIds.includes(block.id))
    : connectedBlocks
  const parts = []
  if (idea.title)   parts.push(`Title: ${idea.title}`)
  if (inputBlocks.length) parts.push(`Connected Input Blocks:\n${formatConnectedBlocks(inputBlocks)}`)
  if (idea.context) parts.push(`Context / Notes:\n${idea.context}`)
  for (const key of upstream) {
    const info = UPSTREAM_INFO[key]
    if (!info) continue
    const val = idea[info.field]
    if (val && val.trim()) parts.push(`${info.label}:\n${val}`)
  }
  return parts.join('\n\n') || 'No content provided.'
}

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

export function Editor({ idea, onChange, onDelete, ideas, onRestore }) {
  const titleRef = useRef(null)
  const [activeTab, setActiveTab] = useState('tweet')
  // { platform, text } when we have a pending AI result awaiting approval
  const [pendingResult, setPendingResult] = useState(null)
  const [genError, setGenError] = useState(null)
  // Session-local cover-frame object URLs per video platform (not persisted)
  const [covers, setCovers] = useState({})
  const { settings } = useSettings()

  const handleCoverChange = useCallback((platform, url) => {
    setCovers(prev => {
      if (prev[platform] && prev[platform] !== url) URL.revokeObjectURL(prev[platform])
      return { ...prev, [platform]: url }
    })
  }, [])

  useEffect(() => {
    if (idea && !idea.title) titleRef.current?.focus()
  }, [idea?.id])

  // Cancel generation / clear pending result when switching tabs via write side
  const handleWriteClick = useCallback((platform) => {
    setPendingResult(prev => prev?.platform === platform ? null : prev)
    setGenError(null)
  }, [])

  // Trigger AI generation for a platform
  const handleGenerate = useCallback(async (platform, options = {}) => {
    if (!idea) return
    setActiveTab(platform)
    setPendingResult(null)
    setGenError(null)

    // 1. Save current state to version history before generating
    try {
      if (ideas && ideas.length > 0) {
        commitSnapshot(ideas, `Before AI generation — ${idea.title || 'Untitled'} (${platform})`)
      }
    } catch {
      // Non-blocking: if git snapshot fails (e.g. in production), continue anyway
    }

    // 2. Call the configured AI provider with upstream draft context
    try {
      const promptKey = PROMPT_KEY_BY_PLATFORM[platform]
      const provider = settings.aiProvider || 'anthropic'
      const providerConfig = AI_PROVIDERS[provider]
      const apiKey = provider === 'openai' ? settings.aiOpenaiKey : settings.aiAnthropicKey
      const model  = (provider === 'openai' ? settings.aiOpenaiModel : settings.aiAnthropicModel) || providerConfig.defaultModel

      const text = await generateWithAi({
        provider,
        apiKey,
        model,
        systemPrompt: settings[promptKey],
        userContent: buildFlowUserContent(
          idea,
          platform,
          options.sources,
          getConnectedBlocks(idea, ideas),
          options.inputBlockIds
        ),
      })

      setPendingResult({ platform, text })
    } catch (err) {
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
    } else {
      onChange({ [platform]: text })
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
        commitSnapshot(updatedIdeas, `AI generated ${platform} — ${idea.title || 'Untitled'}`)
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
  if (idea.type === 'block') {
    return <BlockEditor idea={idea} onChange={onChange} onDelete={onDelete} ideas={ideas} onRestore={onRestore} />
  }

  const availableBlocks = (ideas ?? []).filter(item => item.type !== 'build' && item.id !== idea.id)
  const connectedBlockIds = Array.isArray(idea.sourceBlockIds) ? idea.sourceBlockIds : []
  const connectedBlocks = getConnectedBlocks(idea, ideas)
  const handleToggleSourceBlock = (blockId) => {
    const nextIds = connectedBlockIds.includes(blockId)
      ? connectedBlockIds.filter(id => id !== blockId)
      : [...connectedBlockIds, blockId]
    onChange({ sourceBlockIds: nextIds })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <input
            ref={titleRef}
            value={idea.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="What do you want to write about?"
            maxLength={200}
            className="flex-1 bg-transparent text-xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/30 outline-none"
          />
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete block?</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{idea.title || 'Untitled block'}&quot; and all its drafts will be permanently deleted.
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

      {/* Flow tree */}
      <div className="shrink-0 border-b border-border bg-muted/20 px-6 py-3">
        <BuildFlowCanvas
          idea={idea}
          blocks={availableBlocks}
          connectedBlocks={connectedBlocks}
          connectedBlockIds={connectedBlockIds}
          platform={activeTab}
          onGenerate={handleGenerate}
          onChange={onChange}
          onToggleSourceBlock={handleToggleSourceBlock}
          onSelectPlatform={(val) => { setActiveTab(val); handleWriteClick(val) }}
        />
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
        <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto border-r border-border">

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
                  <span title="Weighted length — URLs count as 23, CJK and emoji count double">
                    <CharCounter current={parseDraftTweet(idea.tweet).weightedLength} max={TWEET_WEIGHTED_MAX} />
                  </span>
                </div>
                <Textarea
                  value={idea.tweet}
                  onChange={e => onChange({ tweet: e.target.value })}
                  placeholder="Write your tweet here…"
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

          {/* Shorts */}
          <TabsContent value="shorts" className="m-0 flex flex-col px-6 pt-4">
{pendingResult?.platform === 'shorts' ? (
              <AiResultPanel
                text={pendingResult.text}
                platform="shorts"
                onApprove={() => handleApprove('shorts', pendingResult.text)}
                onReject={handleReject}
              />
            ) : genError?.platform === 'shorts' ? (
              <AiErrorPanel message={genError.message} onDismiss={handleReject} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 pb-2">
                  <p className="text-xs italic text-muted-foreground">Short-form video script. Hook in the first 3 seconds.</p>
                  <CharCounter current={wordCount(idea.shorts)} isWords />
                </div>
                <Textarea
                  value={idea.shorts}
                  onChange={e => onChange({ shorts: e.target.value })}
                  placeholder="Write your shorts/Reels script here…"
                  className="min-h-[220px] resize-none text-sm leading-relaxed"
                />
                <PlatformTip>One idea per line. Direct, conversational, spoken-friendly. End on a clear payoff or loop.</PlatformTip>
              </>
            )}
          </TabsContent>

          {/* VOD */}
          <TabsContent value="vod" className="m-0 flex flex-col px-6 pt-4">
{pendingResult?.platform === 'vod' ? (
              <AiResultPanel
                text={pendingResult.text}
                platform="vod"
                onApprove={() => handleApprove('vod', pendingResult.text)}
                onReject={handleReject}
              />
            ) : genError?.platform === 'vod' ? (
              <AiErrorPanel message={genError.message} onDismiss={handleReject} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-4 pb-2">
                  <p className="text-xs italic text-muted-foreground">Long-form video script. Room to expand the short into a full piece.</p>
                  <CharCounter current={wordCount(idea.vod)} isWords />
                </div>
                <Textarea
                  value={idea.vod}
                  onChange={e => onChange({ vod: e.target.value })}
                  placeholder="Write your VOD script here…"
                  className="min-h-[300px] resize-none text-sm leading-relaxed"
                />
                <PlatformTip>Open with a hook, structure the body into sections, close with a CTA. Build on the short if you have one.</PlatformTip>
              </>
            )}
          </TabsContent>

        </div>
        <PreviewPane idea={idea} platform={activeTab} covers={covers} onCoverChange={handleCoverChange} />
        </div>
      </Tabs>
    </div>
  )
}

const VIEWPORTS = [
  { value: 'mobile',  label: 'Mobile',  icon: Smartphone, width: 360 },
  { value: 'desktop', label: 'Desktop', icon: Monitor,    width: 720 },
]

function PreviewPane({ idea, platform, covers, onCoverChange }) {
  const [viewport, setViewport] = useState('mobile')
  const vp = VIEWPORTS.find(v => v.value === viewport) ?? VIEWPORTS[0]

  return (
    <div className="hidden w-1/2 shrink-0 flex-col bg-muted/30 md:flex">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Preview</span>
        <PillToggle items={VIEWPORTS} value={viewport} onChange={setViewport} />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto" style={{ width: '100%', maxWidth: vp.width }}>
          {platform === 'tweet'    && <XPreview        text={idea.tweet} />}
          {platform === 'linkedin' && <LinkedInPreview text={idea.linkedin} viewport={viewport} />}
          {platform === 'substack' && <SubstackPreview title={idea.substackTitle} body={idea.substackBody} />}
          {platform === 'shorts'   && (
            <ShortsPreview
              text={idea.shorts}
              viewport={viewport}
              cover={covers.shorts}
              onCoverChange={url => onCoverChange('shorts', url)}
            />
          )}
          {platform === 'vod' && (
            <VodPreview
              title={idea.title}
              text={idea.vod}
              cover={covers.vod}
              onCoverChange={url => onCoverChange('vod', url)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function PillToggle({ items, value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
      {items.map(item => {
        const Icon = item.icon
        const active = value === item.value
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200',
              active
                ? 'bg-background text-foreground shadow-sm dark:bg-muted/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function EmptyHint({ children }) {
  return <span className="text-muted-foreground/40">{children}</span>
}

function SubstackPreview({ title, body }) {
  return (
    <article className="rounded-lg border border-border bg-background p-6 shadow-sm">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        {title || <EmptyHint>Untitled post</EmptyHint>}
      </h1>
      <div className="mt-1 text-[11px] text-muted-foreground">You · Newsletter · Just now</div>
      <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {body || <EmptyHint>Your Substack post will appear here…</EmptyHint>}
      </div>
    </article>
  )
}

function truncateFlowLabel(value, max = 18) {
  const text = value?.trim() || 'Untitled block'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function getDraftCount(idea, key) {
  if (key === 'substack') return idea.substackBody ? 1 : 0
  return idea[key] ? 1 : 0
}

function getGraphLayoutMode(idea) {
  return idea.flowGraph?.layoutMode === GRAPH_LAYOUTS.blocks ? GRAPH_LAYOUTS.blocks : GRAPH_LAYOUTS.flow
}

function getSavedNodePosition(saved, layoutMode) {
  if (!saved) return null
  if (saved.positions?.[layoutMode]) return saved.positions[layoutMode]
  return layoutMode === GRAPH_LAYOUTS.flow ? saved.position : null
}

function getInputNodePosition(index, connectedBlocks, layoutMode) {
  if (layoutMode === GRAPH_LAYOUTS.blocks) {
    const startX = Math.max(40, 390 - ((connectedBlocks.length - 1) * 160) / 2)
    return { x: startX + index * 160, y: 248 }
  }
  return { x: 24, y: 38 + index * 82 }
}

function getAddInputNodePosition(connectedBlocks, layoutMode) {
  if (layoutMode === GRAPH_LAYOUTS.blocks) {
    const startX = Math.max(40, 390 - ((connectedBlocks.length - 1) * 160) / 2)
    return { x: startX + connectedBlocks.length * 160, y: 248 }
  }
  return { x: 24, y: 38 + connectedBlocks.length * 82 }
}

function getGraphNodes(idea, connectedBlocks, layoutMode = GRAPH_LAYOUTS.flow) {
  const savedNodes = new Map((idea.flowGraph?.nodes ?? []).map(node => [node.id, node]))
  const inputNodes = connectedBlocks.map((block, index) => {
    const id = `input:${block.id}`
    const saved = savedNodes.get(id)
    return {
      id,
      type: 'inputBlock',
      position: getSavedNodePosition(saved, layoutMode) ?? getInputNodePosition(index, connectedBlocks, layoutMode),
      data: {
        blockId: block.id,
        label: truncateFlowLabel(block.title),
        title: block.title || 'Untitled block',
        layoutMode,
      },
    }
  })

  const platformNodes = FLOW_NODES.map(node => {
    const id = `post:${node.key}`
    const saved = savedNodes.get(id)
    return {
      id,
      type: 'postType',
      position: getSavedNodePosition(saved, layoutMode) ?? (
        layoutMode === GRAPH_LAYOUTS.blocks ? BLOCK_POST_NODE_POSITIONS[node.key] : POST_NODE_POSITIONS[node.key]
      ),
      data: {
        key: node.key,
        label: node.label,
        glyph: node.glyph,
        active: idea.activePlatform === node.key,
        draftCount: getDraftCount(idea, node.key),
        layoutMode,
      },
    }
  })

  const addInputNode = {
    id: ADD_INPUT_NODE_ID,
    type: 'addInput',
    position: getAddInputNodePosition(connectedBlocks, layoutMode),
    data: { layoutMode },
  }

  return [...inputNodes, addInputNode, ...platformNodes]
}

function makeEdgeId(source, target) {
  return `${source}->${target}`
}

function getInitialEdges(idea, connectedBlocks) {
  const hasSavedGraph = Array.isArray(idea.flowGraph?.edges)
  const savedNodeIds = new Set((idea.flowGraph?.nodes ?? []).map(node => node.id))
  const currentNodeIds = new Set([
    ...connectedBlocks.map(block => `input:${block.id}`),
    ...FLOW_NODES.map(node => `post:${node.key}`),
  ])
  const savedEdges = (idea.flowGraph?.edges ?? [])
    .filter(edge => currentNodeIds.has(edge.source) && currentNodeIds.has(edge.target))
    .map(edge => ({ ...edge, type: 'smoothstep', animated: false }))

  const savedEdgeIds = new Set(savedEdges.map(edge => edge.id))
  const defaults = []

  for (const block of connectedBlocks) {
    const source = `input:${block.id}`
    if (hasSavedGraph && savedNodeIds.has(source)) continue
    for (const target of DIRECT_INPUT_TARGETS) {
      const postTarget = `post:${target}`
      const id = makeEdgeId(source, postTarget)
      if (!savedEdgeIds.has(id)) {
        defaults.push({ id, source, target: postTarget, sourceHandle: 'out', targetHandle: 'in', type: 'smoothstep' })
      }
    }
  }

  if (!hasSavedGraph) {
    for (const [from, to] of FLOW_EDGES) {
      const source = `post:${from}`
      const target = `post:${to}`
      const id = makeEdgeId(source, target)
      if (!savedEdgeIds.has(id)) {
        defaults.push({ id, source, target, sourceHandle: 'out', targetHandle: 'in', type: 'smoothstep' })
      }
    }
  }

  return [...savedEdges, ...defaults]
}

function serializeGraph(nodes, edges, layoutMode, previousGraph = null) {
  const previousNodes = new Map((previousGraph?.nodes ?? []).map(node => [node.id, node]))
  return {
    layoutMode,
    nodes: nodes
      .filter(node => node.id !== ADD_INPUT_NODE_ID)
      .map(node => {
        const previous = previousNodes.get(node.id)
        const positions = {
          ...(previous?.position ? { [GRAPH_LAYOUTS.flow]: previous.position } : {}),
          ...(previous?.positions ?? {}),
          [layoutMode]: node.position,
        }
        return {
          id: node.id,
          position: positions[GRAPH_LAYOUTS.flow] ?? node.position,
          positions,
        }
      }),
    edges: edges
      .filter(edge => edge.source !== ADD_INPUT_NODE_ID && edge.target !== ADD_INPUT_NODE_ID)
      .map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        type: edge.type ?? 'smoothstep',
      })),
  }
}

function InputBlockNode({ data }) {
  const isBlocks = data.layoutMode === GRAPH_LAYOUTS.blocks
  return (
    <div className={cn(
      'nodrag relative min-w-32 border bg-background px-3 py-2 text-xs shadow-sm',
      isBlocks
        ? 'rounded-md border-2 border-emerald-700 bg-emerald-500 text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)]'
        : 'rounded-lg border-border'
    )}>
      {isBlocks && <BrickStuds />}
      <div className={cn('text-[10px] font-semibold uppercase tracking-wider', isBlocks ? 'text-white/80' : 'text-muted-foreground')}>Input block</div>
      <div className={cn('mt-1 max-w-36 truncate font-medium', isBlocks ? 'text-white' : 'text-foreground')} title={data.title}>
        {data.label}
      </div>
      <Handle
        id="out"
        type="source"
        position={isBlocks ? Position.Top : Position.Right}
        className="!h-3 !w-3 !border-background !bg-violet-500"
      />
    </div>
  )
}

function PostTypeNode({ data }) {
  const isBlocks = data.layoutMode === GRAPH_LAYOUTS.blocks
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={data.onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          data.onSelect()
        }
      }}
      className={cn(
        'nodrag relative min-w-32 border px-3 py-2 text-left text-xs shadow-sm transition-colors',
        isBlocks
          ? data.active
            ? 'rounded-md border-2 border-slate-950 bg-amber-400 text-slate-950 shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)]'
            : 'rounded-md border-2 border-sky-800 bg-sky-500 text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)] hover:bg-sky-400'
          : data.active
            ? 'rounded-lg border-foreground bg-foreground text-background'
            : 'rounded-lg border-border bg-background text-foreground hover:bg-accent'
      )}
    >
      {isBlocks && <BrickStuds />}
      <Handle
        id="in"
        type="target"
        position={isBlocks ? Position.Bottom : Position.Left}
        className="!h-3 !w-3 !border-background !bg-muted-foreground"
      />
      <Handle
        id="out"
        type="source"
        position={isBlocks ? Position.Top : Position.Right}
        className="!h-3 !w-3 !border-background !bg-violet-500"
      />
      <div className="flex items-center gap-2">
        <span className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold',
          isBlocks
            ? 'bg-white/25 text-current'
            : data.active ? 'bg-background text-foreground' : 'bg-muted text-foreground'
        )}>
          {data.glyph}
        </span>
        <span className="font-medium">{data.label}</span>
      </div>
      <div className={cn(
        'mt-1 text-[10px]',
        isBlocks ? 'text-current opacity-80' : data.active ? 'text-background/70' : 'text-muted-foreground'
      )}>
        {data.draftCount ? `${data.draftCount} draft` : 'No draft'}
      </div>
      <button
        type="button"
        title={`Generate ${data.label} from connected inputs`}
        onClick={(event) => {
          event.stopPropagation()
          data.onGenerate()
        }}
        className={cn(
          'absolute left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border shadow-sm transition-colors',
          isBlocks ? '-top-2' : '-bottom-2',
          data.active ? 'border-background bg-background text-violet-600' : 'border-border bg-background text-violet-500 hover:bg-violet-50'
        )}
      >
        <Sparkles className="h-3 w-3" />
      </button>
    </div>
  )
}

function BrickStuds() {
  return (
    <div className="pointer-events-none absolute -top-2 left-3 right-3 flex justify-around">
      {[0, 1, 2].map(stud => (
        <span key={stud} className="h-3 w-5 rounded-t-md border border-black/20 bg-white/25 shadow-sm" />
      ))}
    </div>
  )
}

function AddInputNode({ data }) {
  const blocks = data.blocks ?? []
  const connectedBlockIds = data.connectedBlockIds ?? []
  const hasBlocks = blocks.length > 0
  const isBlocks = data.layoutMode === GRAPH_LAYOUTS.blocks

  const handleOpen = () => {
    if (hasBlocks) data.onTogglePicker?.()
  }

  return (
    <div
      role="button"
      tabIndex={hasBlocks ? 0 : -1}
      aria-disabled={!hasBlocks}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        handleOpen()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleOpen()
        }
      }}
      className={cn(
        'nodrag nopan relative w-36 border bg-background px-3 py-2 text-xs shadow-sm transition-colors',
        isBlocks ? 'rounded-md border-2 border-dashed border-fuchsia-800 bg-fuchsia-500 text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)]' : 'rounded-lg border-dashed border-border',
        hasBlocks ? (isBlocks ? 'cursor-pointer hover:bg-fuchsia-400' : 'cursor-pointer hover:bg-accent') : 'cursor-not-allowed opacity-60'
      )}
    >
      {isBlocks && <BrickStuds />}
      <div
        className="flex w-full items-center gap-2 text-left"
      >
        <span className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          isBlocks ? 'bg-white/25 text-white' : 'bg-muted text-foreground'
        )}>
          <Plus className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className={cn('block font-medium', isBlocks ? 'text-white' : 'text-foreground')}>{data.open ? 'Choose input' : 'Add input'}</span>
          <span className={cn('block truncate text-[10px]', isBlocks ? 'text-white/80' : 'text-muted-foreground')}>
            {hasBlocks ? `${connectedBlockIds.length} connected` : 'Create a block first'}
          </span>
        </span>
      </div>

      {data.open && hasBlocks && (
        <div
          className="nodrag nopan absolute left-0 top-[calc(100%+8px)] z-20 w-64 rounded-lg border border-border bg-background p-1 shadow-lg"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="max-h-44 overflow-y-auto">
            {blocks.map(block => {
              const checked = connectedBlockIds.includes(block.id)
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    data.onToggleSourceBlock?.(block.id)
                  }}
                  className={cn(
                    'flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                    checked ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <span className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-foreground bg-foreground text-background' : 'border-border bg-background'
                  )}>
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block truncate font-medium', !block.title && 'italic')}>
                      {block.title || 'Untitled block'}
                    </span>
                    {block.context && (
                      <span className="mt-0.5 block truncate text-muted-foreground/70">{block.context}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const FLOW_NODE_TYPES = {
  inputBlock: memo(InputBlockNode),
  postType: memo(PostTypeNode),
  addInput: memo(AddInputNode),
}

function BuildFlowCanvas({
  idea,
  blocks = [],
  connectedBlocks = [],
  connectedBlockIds = [],
  platform,
  onGenerate,
  onChange,
  onToggleSourceBlock,
  onSelectPlatform,
}) {
  const graphLayoutMode = getGraphLayoutMode(idea)
  const [nodes, setNodes] = useState(() => getGraphNodes({ ...idea, activePlatform: platform }, connectedBlocks, graphLayoutMode))
  const [edges, setEdges] = useState(() => getInitialEdges(idea, connectedBlocks))
  const [inputPickerOpen, setInputPickerOpen] = useState(false)

  useEffect(() => {
    const nextNodes = getGraphNodes({ ...idea, activePlatform: platform }, connectedBlocks, graphLayoutMode)
    const nextEdges = getInitialEdges(idea, connectedBlocks)
    queueMicrotask(() => {
      setNodes(nextNodes)
      setEdges(nextEdges)
    })
  }, [idea, platform, connectedBlocks, graphLayoutMode])

  const persistGraph = useCallback((nextNodes, nextEdges) => {
    onChange({ flowGraph: serializeGraph(nextNodes, nextEdges, graphLayoutMode, idea.flowGraph) })
  }, [graphLayoutMode, idea.flowGraph, onChange])

  const handleLayoutChange = useCallback((nextLayoutMode) => {
    if (nextLayoutMode === graphLayoutMode) return
    onChange({
      flowGraph: {
        ...(idea.flowGraph ?? {}),
        layoutMode: nextLayoutMode,
      },
    })
  }, [graphLayoutMode, idea.flowGraph, onChange])

  const getInputsForPlatform = useCallback((key, graphEdges = edges) => {
    return graphEdges
      .filter(edge => edge.target === `post:${key}` && edge.source.startsWith('input:'))
      .map(edge => edge.source.replace('input:', ''))
  }, [edges])

  const getPostSourcesForPlatform = useCallback((key, graphEdges = edges) => {
    return graphEdges
      .filter(edge => edge.target === `post:${key}` && edge.source.startsWith('post:'))
      .map(edge => edge.source.replace('post:', ''))
  }, [edges])

  const handleGenerateNode = useCallback((key) => {
    onGenerate?.(key, {
      sources: getPostSourcesForPlatform(key),
      inputBlockIds: getInputsForPlatform(key),
    })
  }, [getInputsForPlatform, getPostSourcesForPlatform, onGenerate])

  const decoratedNodes = useMemo(() => nodes.map(node => {
    if (node.type === 'addInput') {
      return {
        ...node,
        data: {
          ...node.data,
          blocks,
          connectedBlockIds,
          layoutMode: graphLayoutMode,
          open: inputPickerOpen,
          onTogglePicker: () => setInputPickerOpen(value => !value),
          onToggleSourceBlock,
        },
      }
    }
    if (node.type !== 'postType') return node
    const key = node.data.key
    return {
      ...node,
      data: {
        ...node.data,
        active: platform === key,
        draftCount: getDraftCount(idea, key),
        layoutMode: graphLayoutMode,
        onSelect: () => onSelectPlatform?.(key),
        onGenerate: () => handleGenerateNode(key),
      },
    }
  }), [blocks, connectedBlockIds, graphLayoutMode, handleGenerateNode, idea, inputPickerOpen, nodes, onSelectPlatform, onToggleSourceBlock, platform])

  const onNodesChange = useCallback((changes) => {
    setNodes(current => {
      const next = applyNodeChanges(changes, current)
      if (changes.some(change => change.type === 'position' && !change.dragging)) {
        persistGraph(next, edges)
      }
      return next
    })
  }, [edges, persistGraph])

  const onEdgesChange = useCallback((changes) => {
    setEdges(current => {
      const next = applyEdgeChanges(changes, current)
      persistGraph(nodes, next)
      return next
    })
  }, [nodes, persistGraph])

  const onConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) return
    setEdges(current => {
      const id = makeEdgeId(connection.source, connection.target)
      const next = addEdge({ ...connection, id, type: 'smoothstep' }, current.filter(edge => edge.id !== id))
      persistGraph(nodes, next)
      return next
    })
  }, [nodes, persistGraph])

  return (
    <div className="mx-auto max-w-[940px]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] text-muted-foreground/70">
          {graphLayoutMode === GRAPH_LAYOUTS.blocks
            ? 'Stack blocks upward. Pull from a top handle into the bottom of the next block.'
            : 'Drag nodes to organize the build. Pull from a right handle into a left handle to decide what feeds each post type.'}
        </p>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
          {[
            { value: GRAPH_LAYOUTS.flow, label: 'Flow' },
            { value: GRAPH_LAYOUTS.blocks, label: 'Blocks' },
          ].map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => handleLayoutChange(item.value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                graphLayoutMode === item.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className={cn(
        'h-[320px] overflow-hidden rounded-lg border bg-background',
        graphLayoutMode === GRAPH_LAYOUTS.blocks ? 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40' : 'border-border'
      )}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={decoratedNodes}
            edges={edges}
            nodeTypes={FLOW_NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.25}
            maxZoom={1.4}
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background gap={graphLayoutMode === GRAPH_LAYOUTS.blocks ? 24 : 18} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  )
}

function AiResultPanel({ text, platform, onApprove, onReject }) {
  const PLATFORM_LABELS = { tweet: 'Tweet', linkedin: 'LinkedIn post', substack: 'Substack post', shorts: 'Shorts script', vod: 'VOD script' }
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
              Open <strong>Settings</strong> (gear icon) and add your provider API key.
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

function BlockEditor({ idea, onChange, onDelete, ideas, onRestore }) {
  const { settings } = useSettings()
  const titleRef = useRef(null)
  const [researching, setResearching] = useState(false)
  const [researchError, setResearchError] = useState(null)
  const [versionsOpen, setVersionsOpen] = useState(false)

  useEffect(() => {
    if (idea && !idea.title) titleRef.current?.focus()
  }, [idea?.id])

  const handleResearch = useCallback(async () => {
    setResearching(true)
    setResearchError(null)
    try {
      const provider = settings.aiProvider || 'anthropic'
      const providerConfig = AI_PROVIDERS[provider]
      const apiKey = provider === 'openai' ? settings.aiOpenaiKey : settings.aiAnthropicKey
      const model  = (provider === 'openai' ? settings.aiOpenaiModel : settings.aiAnthropicModel) || providerConfig.defaultModel

      const parts = []
      if (idea.title)   parts.push(`Title: ${idea.title}`)
      if (idea.context) parts.push(`Notes:\n${idea.context}`)
      const userContent = parts.join('\n\n') || 'No content provided.'

      const text = await generateWithAi({
        provider,
        apiKey,
        model,
        systemPrompt: settings.aiPromptResearch,
        userContent,
      })

      const next = idea.context.trim()
        ? `${idea.context}\n\n— Research —\n\n${text}`
        : text
      onChange({ context: next })
    } catch (err) {
      setResearchError(err.message)
    } finally {
      setResearching(false)
    }
  }, [idea, settings, onChange])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <input
            ref={titleRef}
            value={idea.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="A short idea — what sparked your interest?"
            maxLength={200}
            className="flex-1 bg-transparent text-xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/30 outline-none"
          />
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete block?</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{idea.title || 'Untitled block'}&quot; will be permanently deleted.
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
        <p className="mt-1 text-xs text-muted-foreground">
          Raw idea capture. Use a build for full multi-platform projects.
        </p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden px-6 py-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResearch}
              disabled={researching}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
            >
              {researching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {researching ? 'Researching…' : 'Research with AI'}
            </button>
            <button
              type="button"
              onClick={() => setVersionsOpen(true)}
              title="Version history"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <GitBranch className="h-3 w-3" />
              Versions
            </button>
          </div>
        </div>
        <Textarea
          value={idea.context}
          onChange={e => onChange({ context: e.target.value })}
          placeholder="What's the idea? Jot it down. Click Research to have AI expand on it…"
          className="flex-1 resize-none text-sm leading-relaxed"
        />
        {researchError && (
          <p className="mt-2 text-xs text-destructive">{researchError}</p>
        )}
      </div>

      {versionsOpen && (
        <VersionsModal
          ideas={ideas}
          onRestore={(snap) => { setVersionsOpen(false); onRestore?.(snap) }}
          onClose={() => setVersionsOpen(false)}
        />
      )}
    </div>
  )
}

function VersionsModal({ ideas, onRestore, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Versions</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <HistoryPanel ideas={ideas} onRestore={onRestore} />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-5xl">✍️</div>
      <h2 className="text-lg font-semibold text-foreground">No block selected</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        Pick one from the sidebar, hit{' '}
        <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">⌘N</kbd>{' '}
        for a new block or{' '}
        <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">⇧⌘N</kbd>{' '}
        for a new build.
      </p>
    </div>
  )
}
