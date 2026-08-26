import { useState, useEffect, useCallback } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/Sidebar'
import { Editor } from '@/components/Editor'
import { AnalyticsPanel } from '@/components/AnalyticsPanel'
import { AuthGate } from '@/components/AuthGate'
import { useIdeas } from '@/hooks/useIdeas'
import { useAuth } from '@/hooks/useAuth'
import { SettingsProvider } from '@/components/SettingsProvider'
import { saveIdeas } from '@/lib/storage'

export default function App() {
  const auth = useAuth()
  const { ideas, addIdea, updateIdea, deleteIdea, syncState } = useIdeas({
    user: auth.user,
    authReady: !auth.loading,
    remoteEnabled: auth.isConfigured,
  })
  const [activeId, setActiveId] = useState(() => {
    return sessionStorage.getItem('writingblocks_activeId') || null
  })
  // Which surface the main area shows: the block editor or the analytics dashboard.
  const [view, setView] = useState('editor')

  // Selecting a block always returns to the editor.
  const handleSelect = useCallback((id) => {
    setActiveId(id)
    setView('editor')
  }, [])

  const handleToggleAnalytics = useCallback(() => {
    setView(v => (v === 'analytics' ? 'editor' : 'analytics'))
  }, [])

  // Persist active selection across page reloads
  useEffect(() => {
    if (activeId) sessionStorage.setItem('writingblocks_activeId', activeId)
    else sessionStorage.removeItem('writingblocks_activeId')
  }, [activeId])

  // If active idea was deleted, fall back to first available
  useEffect(() => {
    if (activeId && !ideas.find(i => i.id === activeId)) {
      setActiveId(ideas[0]?.id ?? null)
    }
  }, [ideas, activeId])

  // Auto-select first idea on mount
  useEffect(() => {
    if (!activeId && ideas.length > 0) {
      setActiveId(ideas[0].id)
    }
  }, []) // eslint-disable-line

  const handleAddBlock = useCallback(() => {
    const id = addIdea({ type: 'block', userId: auth.user?.id ?? null })
    setActiveId(id)
    setView('editor')
  }, [addIdea, auth.user?.id])

  const handleAddBuild = useCallback(() => {
    const id = addIdea({ type: 'build', userId: auth.user?.id ?? null })
    setActiveId(id)
    setView('editor')
  }, [addIdea, auth.user?.id])

  const handleDelete = useCallback(() => {
    const idx = ideas.findIndex(i => i.id === activeId)
    deleteIdea(activeId)
    const remaining = ideas.filter(i => i.id !== activeId)
    setActiveId(remaining.length > 0 ? remaining[Math.min(idx, remaining.length - 1)].id : null)
  }, [ideas, activeId, deleteIdea])

  const handleChange = useCallback((patch) => {
    if (activeId) updateIdea(activeId, patch)
  }, [activeId, updateIdea])

  // Cmd/Ctrl+N → new block (the quick capture). Cmd/Ctrl+Shift+N → new build.
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (auth.isConfigured && !auth.user) return
        if (e.shiftKey) handleAddBuild()
        else handleAddBlock()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [auth.isConfigured, auth.user, handleAddBlock, handleAddBuild])

  const handleRestore = useCallback((restoredIdeas) => {
    saveIdeas(restoredIdeas)
    window.location.reload()
  }, [])

  const activeIdea = ideas.find(i => i.id === activeId) ?? null

  if (auth.isConfigured && (auth.loading || !auth.user)) {
    return <AuthGate auth={auth} />
  }

  return (
    <TooltipProvider>
      <SettingsProvider auth={auth}>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar
            ideas={ideas}
            activeId={activeId}
            auth={auth}
            syncState={syncState}
            onSelect={handleSelect}
            onAddBlock={handleAddBlock}
            onAddBuild={handleAddBuild}
            onRestore={handleRestore}
            onToggleAnalytics={handleToggleAnalytics}
            analyticsActive={view === 'analytics'}
          />
          <main className="flex flex-1 flex-col overflow-hidden">
            {view === 'analytics' ? (
              <AnalyticsPanel />
            ) : (
              <Editor
                idea={activeIdea}
                ideas={ideas}
                onChange={handleChange}
                onDelete={handleDelete}
                onRestore={handleRestore}
              />
            )}
          </main>
        </div>
      </SettingsProvider>
    </TooltipProvider>
  )
}
