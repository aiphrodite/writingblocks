import { useEffect, useState, useCallback, useRef } from 'react'
import { loadIdeas, saveIdeas, createIdea } from '@/lib/storage'
import {
  deleteRemoteIdea,
  fetchRemoteIdeas,
  saveRemoteIdea,
  saveRemoteIdeas,
} from '@/lib/ideasRepository'

function mergeIdeas(localIdeas, remoteIdeas, userId) {
  const byId = new Map()
  for (const idea of remoteIdeas) byId.set(idea.id, idea)
  for (const idea of localIdeas) {
    if (idea.userId && idea.userId !== userId) continue
    const ownedIdea = { ...idea, userId }
    const existing = byId.get(idea.id)
    if (!existing || (ownedIdea.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      byId.set(idea.id, ownedIdea)
    }
  }
  return [...byId.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export function useIdeas({ user, authReady = true, remoteEnabled = false } = {}) {
  const [ideas, setIdeas] = useState(() => loadIdeas())
  const [syncState, setSyncState] = useState({ status: 'local', error: null })
  const saveTimer = useRef(null)
  const remoteSaveTimers = useRef({})
  const userId = user?.id ?? null
  const shouldSync = Boolean(remoteEnabled && authReady && userId)

  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveIdeas(next), 350)
  }, [])

  useEffect(() => {
    if (!remoteEnabled) {
      queueMicrotask(() => setSyncState({ status: 'local', error: null }))
      return
    }

    if (!authReady) {
      queueMicrotask(() => setSyncState({ status: 'loading', error: null }))
      return
    }

    if (!userId) {
      queueMicrotask(() => {
        setIdeas(loadIdeas())
        setSyncState({ status: 'signed-out', error: null })
      })
      return
    }

    let cancelled = false

    async function hydrateRemoteIdeas() {
      setSyncState({ status: 'syncing', error: null })
      try {
        const localIdeas = loadIdeas()
        const localForUser = localIdeas
          .filter(idea => !idea.userId || idea.userId === userId)
          .map(idea => ({ ...idea, userId }))
        const remoteIdeas = await fetchRemoteIdeas(userId)
        const merged = mergeIdeas(localForUser, remoteIdeas, userId)
        await saveRemoteIdeas(merged, userId)
        const refreshed = await fetchRemoteIdeas(userId)
        if (cancelled) return
        setIdeas(refreshed)
        saveIdeas(refreshed)
        setSyncState({ status: 'synced', error: null })
      } catch (err) {
        if (cancelled) return
        setSyncState({ status: 'error', error: err.message })
      }
    }

    hydrateRemoteIdeas()

    return () => {
      cancelled = true
    }
  }, [remoteEnabled, authReady, userId])

  const addIdea = useCallback((overrides = {}) => {
    const idea = createIdea({ ...overrides, userId: overrides.userId ?? userId })
    setIdeas(prev => {
      const next = [idea, ...prev]
      persist(next)
      return next
    })
    if (shouldSync) {
      saveRemoteIdea(idea, userId)
        .then(() => setSyncState({ status: 'synced', error: null }))
        .catch(err => setSyncState({ status: 'error', error: err.message }))
    }
    return idea.id
  }, [persist, shouldSync, userId])

  const updateIdea = useCallback((id, patch) => {
    let updatedIdea = null
    setIdeas(prev => {
      const next = prev.map(i => {
        if (i.id !== id) return i
        updatedIdea = { ...i, ...patch, userId: i.userId ?? userId, updatedAt: Date.now() }
        return updatedIdea
      })
      persist(next)
      return next
    })
    if (shouldSync) {
      queueMicrotask(() => {
        if (!updatedIdea) return
        clearTimeout(remoteSaveTimers.current[id])
        remoteSaveTimers.current[id] = setTimeout(() => {
          saveRemoteIdea(updatedIdea, userId)
            .then(() => setSyncState({ status: 'synced', error: null }))
            .catch(err => setSyncState({ status: 'error', error: err.message }))
        }, 500)
      })
    }
  }, [persist, shouldSync, userId])

  const deleteIdea = useCallback((id) => {
    setIdeas(prev => {
      const next = prev
        .filter(i => i.id !== id)
        .map(i => Array.isArray(i.sourceBlockIds)
          ? { ...i, sourceBlockIds: i.sourceBlockIds.filter(sourceId => sourceId !== id) }
          : i
        )
      saveIdeas(next)
      return next
    })
    if (shouldSync) {
      clearTimeout(remoteSaveTimers.current[id])
      deleteRemoteIdea(id, userId)
        .then(() => setSyncState({ status: 'synced', error: null }))
        .catch(err => setSyncState({ status: 'error', error: err.message }))
    }
  }, [shouldSync, userId])

  return { ideas, addIdea, updateIdea, deleteIdea, syncState }
}
