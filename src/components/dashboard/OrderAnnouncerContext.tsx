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
  announceServiceRequestInHindi,
  getVoiceEngineStatus,
  requestNotificationPermission,
  showOrderNotification,
  showServiceNotification,
  unlockAudio,
  getIsAudioUnlocked,
  playRestaurantChime,
  type VoiceEngineStatus,
} from '@/lib/client/speechAnnouncer'
import { formatPaise } from '@/lib/ordering/rules.mjs'
import {
  getHindiTableAnnouncement,
  getHindiServiceAnnouncement,
  SERVICE_REQUEST_ENGLISH_LABELS,
} from '@/lib/ordering/hindiAnnouncement.mjs'
import { Volume2, Bell } from 'lucide-react'

export interface IncomingOrderInfo {
  id: string
  orderNumber: string
  tableId?: string | null
  tableLabel?: string | null
  customerName?: string
  customerPhone?: string
  notes?: string
  totalPaise?: number
  paidPaise?: number
  refundedPaise?: number
  paymentStatus?: string
  fulfilment: string
  createdAt?: string
  items?: Array<{
    itemId?: string
    itemName: string
    quantity: number
    options?: Array<{ optionName: string }>
  }>
  itemCount?: number
}

export interface IncomingServiceRequestInfo {
  id: string
  tableId: string
  tableLabel: string
  type: string
  note?: string
  status: string
  createdAt?: string
}

export type AnnouncementQueueItem =
  | { kind: 'order'; payload: IncomingOrderInfo }
  | { kind: 'service'; payload: IncomingServiceRequestInfo }

interface OrderAnnouncerContextType {
  isVoiceEnabled: boolean
  toggleVoice: (enabled?: boolean) => void
  engineStatus: VoiceEngineStatus
  isAnnouncing: boolean
  lastAnnouncement: string | null
  activeArrival: IncomingOrderInfo | null
  activeServiceCall: IncomingServiceRequestInfo | null
  dismissServiceCall: () => void
  testVoice: (
    tableLabel?: string,
    items?: Array<{ itemName: string; quantity: number } | string>
  ) => Promise<void>
  requestNotifications: () => Promise<void>
  announceOrderDirectly: (order: IncomingOrderInfo) => Promise<void>
  announceServiceDirectly: (service: IncomingServiceRequestInfo) => Promise<void>
  activeOrders: IncomingOrderInfo[]
  refreshActiveOrders: () => Promise<void>
  isSyncing: boolean
  audioUnlocked: boolean
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

  const [engineStatus, setEngineStatus] = useState<VoiceEngineStatus>(() => getVoiceEngineStatus())
  const [isAnnouncing, setIsAnnouncing] = useState(false)
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null)
  const [activeArrival, setActiveArrival] = useState<IncomingOrderInfo | null>(null)
  const [activeServiceCall, setActiveServiceCall] = useState<IncomingServiceRequestInfo | null>(null)
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => getIsAudioUnlocked())

  const knownOrderIds = useRef<Set<string>>(new Set())
  const announcedOrderIds = useRef<Set<string>>(new Set())
  const isInitialFetch = useRef<boolean>(true)
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dismissServiceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const etagRef = useRef<string | null>(null)

  const knownServiceIds = useRef<Set<string>>(new Set())
  const announcedServiceIds = useRef<Set<string>>(new Set())
  const isInitialServiceFetch = useRef<boolean>(true)
  const serviceEtagRef = useRef<string | null>(null)

  // Sequential Announcement Queue to prevent speech collisions between orders and service calls
  const queueRef = useRef<AnnouncementQueueItem[]>([])
  const isDrainingRef = useRef<boolean>(false)
  const pendingBlockedAnnouncementRef = useRef<AnnouncementQueueItem | null>(null)

  const dismissServiceCall = useCallback(() => {
    if (dismissServiceTimeoutRef.current) {
      clearTimeout(dismissServiceTimeoutRef.current)
    }
    setActiveServiceCall(null)
  }, [])

  // Process announcements sequentially through the FIFO queue
  const drainAnnouncementQueue = useCallback(async () => {
    if (isDrainingRef.current) return
    isDrainingRef.current = true

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()
      if (!item) break

      unlockAudio()
      setAudioUnlocked(true)

      if (item.kind === 'order') {
        const order = item.payload
        setActiveArrival(order)

        if (dismissTimeoutRef.current) {
          clearTimeout(dismissTimeoutRef.current)
        }
        dismissTimeoutRef.current = setTimeout(() => {
          setActiveArrival(null)
        }, 7000)

        const speechText = getHindiTableAnnouncement({
          tableLabel: order.tableLabel,
          items: order.items,
        })

        // 1. Android / Browser Notification with Item Dictation
        showOrderNotification({
          orderNumber: order.orderNumber,
          tableLabel: order.tableLabel,
          totalFormatted: order.totalPaise !== undefined ? formatPaise(order.totalPaise) : undefined,
          items: order.items,
          speechAnnouncement: speechText,
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.location.hash = 'orders'
            }
          },
        })

        // 2. Play Hindi voice announcement
        if (isVoiceEnabled && !(typeof window !== 'undefined' && window.AndroidTTS)) {
          setIsAnnouncing(true)
          setLastAnnouncement(order.tableLabel ? `टेबल ${order.tableLabel}` : 'काउंटर')
          try {
            const played = await announceOrderInHindi({
              tableLabel: order.tableLabel,
              items: order.items,
              playChimeFirst: true,
              rate: 0.95,
              onStart: () => setIsAnnouncing(true),
              onEnd: () => setIsAnnouncing(false),
            })

            if (!played) {
              pendingBlockedAnnouncementRef.current = item
              announcedOrderIds.current.delete(order.id)
            } else {
              if (
                pendingBlockedAnnouncementRef.current?.kind === 'order' &&
                pendingBlockedAnnouncementRef.current.payload.id === order.id
              ) {
                pendingBlockedAnnouncementRef.current = null
              }
            }
          } catch {
            pendingBlockedAnnouncementRef.current = item
            announcedOrderIds.current.delete(order.id)
            setIsAnnouncing(false)
          }
          await new Promise((r) => setTimeout(r, 400))
        }
      } else {
        // Service Call / Waiter Assistance
        const service = item.payload
        setActiveServiceCall(service)

        if (dismissServiceTimeoutRef.current) {
          clearTimeout(dismissServiceTimeoutRef.current)
        }
        dismissServiceTimeoutRef.current = setTimeout(() => {
          setActiveServiceCall(null)
        }, 8000)

        const speechText = getHindiServiceAnnouncement({
          tableLabel: service.tableLabel,
          type: service.type,
          note: service.note,
        })

        // 1. Android / Browser Notification
        showServiceNotification({
          id: service.id,
          tableLabel: service.tableLabel,
          type: service.type,
          note: service.note,
          speechAnnouncement: speechText,
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.location.hash = 'kitchen'
            }
          },
        })

        // 2. Play Hindi voice announcement for staff
        if (isVoiceEnabled && !(typeof window !== 'undefined' && window.AndroidTTS)) {
          setIsAnnouncing(true)
          setLastAnnouncement(`स्टाफ कॉल: टेबल ${service.tableLabel}`)
          try {
            const played = await announceServiceRequestInHindi({
              tableLabel: service.tableLabel,
              type: service.type,
              note: service.note,
              playChimeFirst: true,
              onStart: () => setIsAnnouncing(true),
              onEnd: () => setIsAnnouncing(false),
            })

            if (!played) {
              pendingBlockedAnnouncementRef.current = item
              announcedServiceIds.current.delete(service.id)
            } else {
              if (
                pendingBlockedAnnouncementRef.current?.kind === 'service' &&
                pendingBlockedAnnouncementRef.current.payload.id === service.id
              ) {
                pendingBlockedAnnouncementRef.current = null
              }
            }
          } catch {
            pendingBlockedAnnouncementRef.current = item
            announcedServiceIds.current.delete(service.id)
            setIsAnnouncing(false)
          }
          await new Promise((r) => setTimeout(r, 400))
        }
      }
    }

    isDrainingRef.current = false
    setIsAnnouncing(false)
  }, [isVoiceEnabled])

  // Core trigger to announce an order
  const announceOrderDirectly = useCallback(
    async (order: IncomingOrderInfo) => {
      if (announcedOrderIds.current.has(order.id)) return
      announcedOrderIds.current.add(order.id)
      knownOrderIds.current.add(order.id)

      queueRef.current.push({ kind: 'order', payload: order })
      drainAnnouncementQueue()
    },
    [drainAnnouncementQueue]
  )

  // Core trigger to announce a service request / waiter call
  const announceServiceDirectly = useCallback(
    async (service: IncomingServiceRequestInfo) => {
      if (announcedServiceIds.current.has(service.id)) return
      announcedServiceIds.current.add(service.id)
      knownServiceIds.current.add(service.id)

      queueRef.current.push({ kind: 'service', payload: service })
      drainAnnouncementQueue()
    },
    [drainAnnouncementQueue]
  )

  // Track and react to AudioContext / browser autoplay policy unlock
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUnlock = () => {
      unlockAudio()
      setAudioUnlocked(true)
      if (pendingBlockedAnnouncementRef.current) {
        const blocked = pendingBlockedAnnouncementRef.current
        pendingBlockedAnnouncementRef.current = null
        if (blocked.kind === 'order') {
          announceOrderDirectly(blocked.payload)
        } else {
          announceServiceDirectly(blocked.payload)
        }
      }
    }

    window.addEventListener('rp-audio-unlocked', handleUnlock)
    window.addEventListener('pointerdown', handleUnlock, { passive: true })
    window.addEventListener('keydown', handleUnlock, { passive: true })
    window.addEventListener('touchstart', handleUnlock, { passive: true })

    return () => {
      window.removeEventListener('rp-audio-unlocked', handleUnlock)
      window.removeEventListener('pointerdown', handleUnlock)
      window.removeEventListener('keydown', handleUnlock)
      window.removeEventListener('touchstart', handleUnlock)
    }
  }, [announceOrderDirectly, announceServiceDirectly])

  // Keep-alive heartbeat: ping /api/auth/session every 15 minutes to keep restaurant session active indefinitely
  useEffect(() => {
    if (typeof window === 'undefined') return
    const pingSession = async () => {
      try {
        await fetch('/api/auth/session', { cache: 'no-store' })
        if (window.AndroidTTS && typeof window.AndroidTTS.syncCookies === 'function') {
          window.AndroidTTS.syncCookies()
        }
      } catch {}
    }
    pingSession()
    const timer = setInterval(pingSession, 15 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  // Listen for speech synthesis voices and Android native TTS bridge
  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateEngine = () => {
      setEngineStatus(getVoiceEngineStatus())
      setAudioUnlocked(getIsAudioUnlocked())
    }

    updateEngine()

    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', updateEngine)
    }

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
    setAudioUnlocked(true)
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
    setAudioUnlocked(true)
    const result = await requestNotificationPermission()
    setEngineStatus((prev) => ({ ...prev, notificationPermission: result }))
  }, [])

  // Test button action
  const testVoice = useCallback(
    async (
      tableLabel = '5',
      items?: Array<{ itemName: string; quantity: number } | string>
    ) => {
      unlockAudio()
      setAudioUnlocked(true)
      setIsAnnouncing(true)
      setLastAnnouncement(`टेबल नंबर ${tableLabel}`)

      const testOrderNum = String(Math.floor(100 + Math.random() * 900))
      const speechText = getHindiTableAnnouncement({ tableLabel, items })

      showOrderNotification({
        orderNumber: testOrderNum,
        tableLabel,
        items,
        speechAnnouncement: speechText,
      })

      if (typeof window !== 'undefined' && window.AndroidTTS) {
        setTimeout(() => setIsAnnouncing(false), 3000)
        return
      }

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

  // Real-time Background Order Poller (ETag 304, zero Firestore reads)
  const pollActiveOrders = useCallback(async () => {
    try {
      setIsSyncing(true)
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' }
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current
      }

      const res = await fetch(`/api/business/orders?status=active&limit=30`, {
        headers,
      })

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

      if (isInitialFetch.current) {
        knownOrderIds.current = currentIds
        currentIds.forEach((id) => announcedOrderIds.current.add(id))
        isInitialFetch.current = false
        setIsSyncing(false)
        return
      }

      const freshOrders: IncomingOrderInfo[] = data.filter(
        (o) => !knownOrderIds.current.has(o.id) && o.fulfilment === 'RECEIVED'
      )

      currentIds.forEach((id) => knownOrderIds.current.add(id))

      if (freshOrders.length > 0) {
        for (const fresh of freshOrders) {
          announceOrderDirectly({
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
      // network retry on next tick
    } finally {
      setIsSyncing(false)
    }
  }, [announceOrderDirectly])

  // Real-time Service Requests Poller (Waiter Calls, Drinking Water, Bill)
  const pollServiceRequests = useCallback(async () => {
    try {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' }
      if (serviceEtagRef.current) {
        headers['If-None-Match'] = serviceEtagRef.current
      }

      const res = await fetch(`/api/business/service-requests?status=OPEN`, {
        headers,
      })

      if (res.status === 304 || !res.ok) return

      const newEtag = res.headers.get('ETag')
      if (newEtag) serviceEtagRef.current = newEtag

      const data = await res.json()
      if (!Array.isArray(data)) return

      const currentIds = new Set<string>(data.map((r) => r.id))

      if (isInitialServiceFetch.current) {
        knownServiceIds.current = currentIds
        currentIds.forEach((id) => announcedServiceIds.current.add(id))
        isInitialServiceFetch.current = false
        return
      }

      const freshRequests: IncomingServiceRequestInfo[] = data.filter(
        (r) => !knownServiceIds.current.has(r.id) && r.status === 'OPEN'
      )

      currentIds.forEach((id) => knownServiceIds.current.add(id))

      if (freshRequests.length > 0) {
        for (const fresh of freshRequests) {
          announceServiceDirectly(fresh)
        }
      }
    } catch {
      // network retry on next tick
    }
  }, [announceServiceDirectly])

  const refreshActiveOrders = useCallback(async () => {
    await Promise.allSettled([pollActiveOrders(), pollServiceRequests()])
  }, [pollActiveOrders, pollServiceRequests])

  useEffect(() => {
    pollActiveOrders()
    pollServiceRequests()

    let timer: NodeJS.Timeout
    let active = true

    const scheduleNext = () => {
      if (!active) return
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      const delayMs = isHidden ? 8000 : 5000
      timer = setTimeout(async () => {
        await Promise.allSettled([pollActiveOrders(), pollServiceRequests()])
        scheduleNext()
      }, delayMs)
    }

    scheduleNext()

    const onVisible = () => {
      pollActiveOrders()
      pollServiceRequests()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)

    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [pollActiveOrders, pollServiceRequests])

  const hasAndroid = typeof window !== 'undefined' && !!window.AndroidTTS

  return (
    <OrderAnnouncerContext.Provider
      value={{
        isVoiceEnabled,
        toggleVoice,
        engineStatus,
        isAnnouncing,
        lastAnnouncement,
        activeArrival,
        activeServiceCall,
        dismissServiceCall,
        testVoice,
        requestNotifications,
        announceOrderDirectly,
        announceServiceDirectly,
        activeOrders,
        refreshActiveOrders,
        isSyncing,
        audioUnlocked,
      }}
    >
      {/* Floating Audio Unlock Banner: Dismisses immediately on click or anywhere-tap */}
      {!audioUnlocked && !hasAndroid && isVoiceEnabled && (
        <div
          onClick={() => {
            unlockAudio()
            setAudioUnlocked(true)
            playRestaurantChime(0.2)
            if (pendingBlockedAnnouncementRef.current) {
              const blocked = pendingBlockedAnnouncementRef.current
              pendingBlockedAnnouncementRef.current = null
              if (blocked.kind === 'order') {
                announceOrderDirectly(blocked.payload)
              } else {
                announceServiceDirectly(blocked.payload)
              }
            }
          }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-amber-950/95 border border-amber-500/50 shadow-2xl shadow-black/80 rounded-2xl p-3 text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-300 cursor-pointer backdrop-blur"
          role="alert"
          title="Click to enable voice alerts"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 animate-pulse">
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-100 truncate">Audio is paused by browser</p>
              <p className="text-[10px] text-amber-300/80">Tap anywhere to enable live Hindi voice alerts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              unlockAudio()
              setAudioUnlocked(true)
              playRestaurantChime(0.2)
              if (pendingBlockedAnnouncementRef.current) {
                const blocked = pendingBlockedAnnouncementRef.current
                pendingBlockedAnnouncementRef.current = null
                if (blocked.kind === 'order') {
                  announceOrderDirectly(blocked.payload)
                } else {
                  announceServiceDirectly(blocked.payload)
                }
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md"
          >
            Enable Sound
          </button>
        </div>
      )}

      {/* Floating Active Service Call Heads-Up Alert on Admin Dashboard */}
      {activeServiceCall && (
        <div
          onClick={dismissServiceCall}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-2 border-amber-300 shadow-2xl shadow-black/80 rounded-2xl p-3.5 text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 cursor-pointer backdrop-blur ring-4 ring-amber-500/30"
          role="alert"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 animate-bounce">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
                <span>🔔 स्टाफ सहायता कॉल</span>
                <span className="bg-white/30 px-1.5 py-0.5 rounded text-[10px]">
                  टेबल {activeServiceCall.tableLabel}
                </span>
              </p>
              <p className="text-sm font-bold truncate">
                {activeServiceCall.type === 'water'
                  ? '💧 Drinking Water (पीने का पानी)'
                  : activeServiceCall.type === 'bill'
                  ? '🧾 Request Bill (बिल)'
                  : activeServiceCall.type === 'assistance'
                  ? '🙋 Waiter Call (वेटर)'
                  : activeServiceCall.type === 'cleaning'
                  ? '🧹 Clean Table (सफाई)'
                  : (SERVICE_REQUEST_ENGLISH_LABELS as Record<string, string>)[activeServiceCall.type] ||
                    '🍴 Cutlery / Plates'}
              </p>
              {activeServiceCall.note && (
                <p className="text-xs text-amber-100/90 italic truncate">
                  &ldquo;{activeServiceCall.note}&rdquo;
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              dismissServiceCall()
            }}
            className="px-2.5 py-1 rounded-xl bg-white text-stone-900 text-xs font-black shrink-0 hover:bg-amber-100 cursor-pointer"
          >
            Acknowledge
          </button>
        </div>
      )}

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
