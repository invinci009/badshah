'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  announceOrderInHindi,
  getVoiceEngineStatus,
  requestNotificationPermission,
  showOrderNotification,
  unlockAudio,
  type VoiceEngineStatus,
} from '@/lib/client/speechAnnouncer'
import { formatPaise } from '@/lib/ordering/rules.mjs'

export interface IncomingOrderInfo {
  id: string
  orderNumber: string
  tableLabel?: string | null
  totalPaise?: number
  fulfilment: string
  createdAt?: string
  items?: Array<{
    itemId?: string
    itemName: string
    quantity: number
  }>
  itemCount?: number
}

interface OrderAnnouncerContextType {
  isVoiceEnabled: boolean
  toggleVoice: (enabled?: boolean) => void
  engineStatus: VoiceEngineStatus
  isAnnouncing: boolean
  lastAnnouncement: string | null
  activeArrival: IncomingOrderInfo | null
  testVoice: (
    tableLabel?: string,
    items?: Array<{ itemName: string; quantity: number } | string>
  ) => Promise<void>
  requestNotifications: () => Promise<void>
  announceOrderDirectly: (order: IncomingOrderInfo) => Promise<void>
  activeOrders: IncomingOrderInfo[]
  refreshActiveOrders: () => Promise<void>
  isSyncing: boolean
}

const OrderAnnouncerContext = createContext<OrderAnnouncerContextType | null>(null)

const STORAGE_KEY = 'rp_voice_announcements_enabled'

function subscribeToVoiceStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener('rp-voice-toggle', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('rp-voice-toggle', callback)
  }
}

function getVoiceSnapshot(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val !== null) return val === 'true'
  } catch {}
  return true
}

function getVoiceServerSnapshot(): boolean {
  return true
}

export function OrderAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const isVoiceEnabled = useSyncExternalStore(
    subscribeToVoiceStorage,
    getVoiceSnapshot,
    getVoiceServerSnapshot
  )

  const [activeOrders, setActiveOrders] = useState<IncomingOrderInfo[]>([])
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const etagRef = useRef<string | null>(null)

  const [engineStatus, setEngineStatus] = useState<VoiceEngineStatus>(() => getVoiceEngineStatus())
  const [isAnnouncing, setIsAnnouncing] = useState(false)
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null)
  const [activeArrival, setActiveArrival] = useState<IncomingOrderInfo | null>(null)

  const knownOrderIds = useRef<Set<string>>(new Set())
  const announcedOrderIds = useRef<Set<string>>(new Set())
  const isInitialFetch = useRef<boolean>(true)
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Listen for speech synthesis voices and Android native TTS bridge
  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateEngine = () => {
      setEngineStatus(getVoiceEngineStatus())
    }

    updateEngine()

    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', updateEngine)
    }

    // Re-check after 500ms to catch Android JavascriptInterface injection
    const timer = setTimeout(updateEngine, 500)

    return () => {
      clearTimeout(timer)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.removeEventListener('voiceschanged', updateEngine)
      }
    }
  }, [])

  const toggleVoice = useCallback((forced?: boolean) => {
    unlockAudio()
    const current = getVoiceSnapshot()
    const next = forced !== undefined ? forced : !current
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      /* storage full or private mode */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('rp-voice-toggle'))
    }
  }, [])

  const requestNotifications = useCallback(async () => {
    unlockAudio()
    const result = await requestNotificationPermission()
    setEngineStatus((prev) => ({ ...prev, notificationPermission: result }))
  }, [])

  // Core trigger to announce an order with Chime + Hindi Speech + Browser Notification
  const announceOrderDirectly = useCallback(
    async (order: IncomingOrderInfo) => {
      if (announcedOrderIds.current.has(order.id)) return
      announcedOrderIds.current.add(order.id)
      knownOrderIds.current.add(order.id)

      unlockAudio()
      setActiveArrival(order)

      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current)
      }
      dismissTimeoutRef.current = setTimeout(() => {
        setActiveArrival(null)
      }, 7000)

      // 1. Browser Notification (independent of sound mute state)
      showOrderNotification({
        orderNumber: order.orderNumber,
        tableLabel: order.tableLabel,
        totalFormatted: order.totalPaise !== undefined ? formatPaise(order.totalPaise) : undefined,
        items: order.items,
        onClick: () => {
          if (typeof window !== 'undefined') {
            window.location.hash = 'orders'
          }
        },
      })

      // 2. Hindi Audio Voice Announcement (if voice alert enabled)
      if (!isVoiceEnabled) return

      setIsAnnouncing(true)
      try {
        await announceOrderInHindi({
          tableLabel: order.tableLabel,
          items: order.items,
          playChimeFirst: true,
          rate: 0.95,
          onStart: () => {
            setIsAnnouncing(true)
          },
          onEnd: () => {
            setIsAnnouncing(false)
          },
        })
      } catch {
        setIsAnnouncing(false)
      }
    },
    [isVoiceEnabled]
  )

  // Test button action
  const testVoice = useCallback(
    async (
      tableLabel = '5',
      items?: Array<{ itemName: string; quantity: number } | string>
    ) => {
      unlockAudio()
      setIsAnnouncing(true)
      setLastAnnouncement(`टेबल नंबर ${tableLabel}`)
      try {
        await announceOrderInHindi({
          tableLabel,
          items,
          playChimeFirst: true,
          rate: 0.95,
          onStart: () => setIsAnnouncing(true),
          onEnd: () => setIsAnnouncing(false),
        })
      } finally {
        setIsAnnouncing(false)
      }
    },
    []
  )

  // Real-time Background Order Poller with ETag 304 (runs in foreground & background)
  const pollActiveOrders = useCallback(async (bypassEtag = false) => {
    try {
      setIsSyncing(true)
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' }
      if (etagRef.current && !bypassEtag) {
        headers['If-None-Match'] = etagRef.current
      }

      const res = await fetch('/api/business/orders?status=active&limit=30', { headers })

      // 304 Not Modified: zero changes, zero memory churn, instant exit!
      if (res.status === 304) {
        setIsSyncing(false)
        return
      }

      if (!res.ok) {
        setIsSyncing(false)
        return
      }

      const newEtag = res.headers.get('ETag')
      if (newEtag) etagRef.current = newEtag

      const data = await res.json()
      if (!Array.isArray(data)) {
        setIsSyncing(false)
        return
      }

      setActiveOrders(data)

      const currentIds = new Set<string>(data.map((o) => o.id))

      // On first run, seed knownOrderIds to prevent announcing stale historical orders
      if (isInitialFetch.current) {
        knownOrderIds.current = currentIds
        currentIds.forEach((id) => announcedOrderIds.current.add(id))
        isInitialFetch.current = false
        setIsSyncing(false)
        return
      }

      // Identify newly arrived RECEIVED orders
      const freshOrders: IncomingOrderInfo[] = data.filter(
        (o) => !knownOrderIds.current.has(o.id) && o.fulfilment === 'RECEIVED'
      )

      // Update known IDs
      currentIds.forEach((id) => knownOrderIds.current.add(id))

      // Announce each fresh order sequentially
      if (freshOrders.length > 0) {
        for (const fresh of freshOrders) {
          await announceOrderDirectly({
            id: fresh.id,
            orderNumber: fresh.orderNumber,
            tableLabel: fresh.tableLabel,
            totalPaise: fresh.totalPaise,
            fulfilment: fresh.fulfilment,
            items: fresh.items,
            itemCount: fresh.itemCount,
          })
        }
      }
    } catch {
      // network glitch, retries on next tick
    } finally {
      setIsSyncing(false)
    }
  }, [announceOrderDirectly])

  const refreshActiveOrders = useCallback(async () => {
    await pollActiveOrders(true)
  }, [pollActiveOrders])

  useEffect(() => {
    pollActiveOrders(true)

    // Poll every 10 seconds for real-time order arrival (foreground & background)
    const interval = setInterval(() => {
      pollActiveOrders()
    }, 10000)

    // Immediate sync when tab gains visibility or window focus
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pollActiveOrders()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [pollActiveOrders])

  return (
    <OrderAnnouncerContext.Provider
      value={{
        isVoiceEnabled,
        toggleVoice,
        engineStatus,
        isAnnouncing,
        lastAnnouncement,
        activeArrival,
        testVoice,
        requestNotifications,
        announceOrderDirectly,
        activeOrders,
        refreshActiveOrders,
        isSyncing,
      }}
    >
      {children}
    </OrderAnnouncerContext.Provider>
  )
}

export function useOrderAnnouncer() {
  const context = useContext(OrderAnnouncerContext)
  if (!context) {
    throw new Error('useOrderAnnouncer must be used within an OrderAnnouncerProvider')
  }
  return context
}
