import { useState, useCallback, useRef } from 'react'
import { loadIdeas, saveIdeas, createIdea } from '@/lib/storage'

export function useIdeas() {
  const [ideas, setIdeas] = useState(() => loadIdeas())
  const saveTimer = useRef(null)

  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveIdeas(next), 350)
  }, [])

  const addIdea = useCallback(() => {
    const idea = createIdea()
    setIdeas(prev => {
      const next = [idea, ...prev]
      persist(next)
      return next
    })
    return idea.id
  }, [persist])

  const updateIdea = useCallback((id, patch) => {
    setIdeas(prev => {
      const next = prev.map(i => i.id === id ? { ...i, ...patch } : i)
      persist(next)
      return next
    })
  }, [persist])

  const deleteIdea = useCallback((id) => {
    setIdeas(prev => {
      const next = prev.filter(i => i.id !== id)
      saveIdeas(next)
      return next
    })
  }, [])

  return { ideas, addIdea, updateIdea, deleteIdea }
}
