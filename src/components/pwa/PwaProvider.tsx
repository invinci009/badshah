'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface PwaContextValue {
  isInstallable: boolean
  isInstalled: boolean
  isIOS: boolean
  isOnline: boolean
  promptInstall: () => Promise<boolean>
  showInstallModal: boolean
  setShowInstallModal: (show: boolean) => void
  dismissInstallPrompt: () => void
}

const PwaContext = createContext<PwaContextValue | null>(null)

const DISMISS_KEY = 'rp_pwa_prompt_dismissed_until'

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  )
  const [isIOS, setIsIOS] = useState(
    () =>
      typeof window !== 'undefined' &&
      /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) &&
      !(window as unknown as { MSStream?: unknown }).MSStream
  )
  const [isOnline, setIsOnline] = useState(true)

  // Sync real online status after hydration to avoid SSR mismatch.
  // Server always renders online (true); client corrects in effect.
  const [showInstallModal, setShowInstallModal] = useState(false)

  // 1. Register Service Worker & check standalone mode
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Sync initial online status post-hydration
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream

    // Check if running in standalone display mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://')

    // Unregister any existing service worker to prevent it from
    // intercepting navigation requests and serving stale offline pages.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister()
        }
      }).catch(() => {})
    }

    // Capture Android/Desktop beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setIsInstallable(true)

      // Auto-display prompt after a short delay if not dismissed recently
      const dismissedUntil = localStorage.getItem(DISMISS_KEY)
      const now = Date.now()
      if (!dismissedUntil || now > parseInt(dismissedUntil, 10)) {
        setTimeout(() => {
          setShowInstallModal(true)
        }, 3500)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Detect when app is successfully installed
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setShowInstallModal(false)
      setDeferredPrompt(null)
      console.log('[PWA] App successfully installed')
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // For iOS users who haven't installed yet, offer install instructions
    if (isIosDevice && !isStandalone) {
      const dismissedUntil = localStorage.getItem(DISMISS_KEY)
      const now = Date.now()
      if (!dismissedUntil || now > parseInt(dismissedUntil, 10)) {
        setTimeout(() => {
          setShowInstallModal(true)
        }, 5000)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Trigger installation prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      if (isIOS) {
        setShowInstallModal(true)
        return false
      }
      return false
    }

    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        setIsInstallable(false)
        setShowInstallModal(false)
        setDeferredPrompt(null)
        return true
      }
    } catch (err) {
      console.error('[PWA] Install prompt error:', err)
    }
    return false
  }, [deferredPrompt, isIOS])

  const dismissInstallPrompt = useCallback(() => {
    setShowInstallModal(false)
    // Don't show again for 5 days
    const fiveDaysFromNow = Date.now() + 5 * 24 * 60 * 60 * 1000
    try {
      localStorage.setItem(DISMISS_KEY, fiveDaysFromNow.toString())
    } catch {}
  }, [])

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isIOS,
        isOnline,
        promptInstall,
        showInstallModal,
        setShowInstallModal,
        dismissInstallPrompt,
      }}
    >
      {children}
    </PwaContext.Provider>
  )
}

export function usePwa() {
  const context = useContext(PwaContext)
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider')
  }
  return context
}
