import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchRemoteSettings, saveRemoteSettings } from '@/lib/settingsRepository'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  migrateSettings,
  saveLocalSettings,
  SettingsContext,
} from '@/hooks/settingsCore'

export function SettingsProvider({ auth, children }) {
  const [settings, setSettings] = useState(loadSettings)
  const [syncState, setSyncState] = useState({ status: 'local', error: null })
  const saveTimer = useRef(null)
  const userId = auth?.user?.id ?? null
  const shouldSync = Boolean(auth?.isConfigured && !auth?.loading && userId)

  useEffect(() => {
    if (!auth?.isConfigured) {
      queueMicrotask(() => setSyncState({ status: 'local', error: null }))
      return
    }

    if (auth.loading) {
      queueMicrotask(() => setSyncState({ status: 'loading', error: null }))
      return
    }

    if (!userId) {
      queueMicrotask(() => {
        setSettings(loadSettings())
        setSyncState({ status: 'signed-out', error: null })
      })
      return
    }

    let cancelled = false

    async function hydrateSettings() {
      setSyncState({ status: 'syncing', error: null })
      try {
        const local = loadSettings()
        const remote = await fetchRemoteSettings(userId)
        const next = remote ? { ...DEFAULT_SETTINGS, ...migrateSettings(remote) } : local
        await saveRemoteSettings(next, userId)
        if (cancelled) return
        setSettings(next)
        saveLocalSettings(next)
        setSyncState({ status: 'synced', error: null })
      } catch (err) {
        if (cancelled) return
        setSyncState({ status: 'error', error: err.message })
      }
    }

    hydrateSettings()

    return () => {
      cancelled = true
    }
  }, [auth?.isConfigured, auth?.loading, userId])

  const update = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveLocalSettings(next)
      if (shouldSync) {
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          saveRemoteSettings(next, userId)
            .then(() => setSyncState({ status: 'synced', error: null }))
            .catch(err => setSyncState({ status: 'error', error: err.message }))
        }, 500)
      }
      return next
    })
  }, [shouldSync, userId])

  const value = useMemo(() => ({
    settings,
    settingsSyncState: syncState,
    update,
  }), [settings, syncState, update])

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}
