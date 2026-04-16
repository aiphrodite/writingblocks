import { useState, useEffect, useCallback } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/Sidebar'
import { Editor } from '@/components/Editor'
import { useIdeas } from '@/hooks/useIdeas'
import { saveIdeas } from '@/lib/storage'

export default function App() {
  const { ideas, addIdea, updateIdea, deleteIdea } = useIdeas()
  const [activeId, setActiveId] = useState(() => {
    return sessionStorage.getItem('writingblocks_activeId') || null
  })

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

  const handleAdd = useCallback(() => {
    const id = addIdea()
    setActiveId(id)
  }, [addIdea])

  const handleDelete = useCallback(() => {
    const idx = ideas.findIndex(i => i.id === activeId)
    deleteIdea(activeId)
    const remaining = ideas.filter(i => i.id !== activeId)
    setActiveId(remaining.length > 0 ? remaining[Math.min(idx, remaining.length - 1)].id : null)
  }, [ideas, activeId, deleteIdea])

  const handleChange = useCallback((patch) => {
    if (activeId) updateIdea(activeId, patch)
  }, [activeId, updateIdea])

  // Cmd/Ctrl+N → new idea
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleAdd()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleAdd])

  const handleRestore = useCallback((restoredIdeas) => {
    saveIdeas(restoredIdeas)
    window.location.reload()
  }, [])

  const activeIdea = ideas.find(i => i.id === activeId) ?? null

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          ideas={ideas}
          activeId={activeId}
          onSelect={setActiveId}
          onAdd={handleAdd}
          onRestore={handleRestore}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Editor
            idea={activeIdea}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        </main>
      </div>
    </TooltipProvider>
  )
}
