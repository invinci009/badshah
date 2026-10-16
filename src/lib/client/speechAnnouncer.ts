/**
 * Client-Side Speech Synthesis and Audio Chime Engine for Order Announcements.
 *
 * Utilizes the standard Web Speech API (speechSynthesis) and Web Audio API (AudioContext)
 * with robust auto-unlock, Indian/Hindi voice detection, fallback handling, and native
 * Browser Notifications.
 */

import { getHindiTableAnnouncement } from '../ordering/hindiAnnouncement.mjs'

export interface VoiceEngineStatus {
  supported: boolean
  hasHindiVoice: boolean
  activeVoiceName: string | null
  activeVoiceLang: string | null
  isFallback: boolean
  audioUnlocked: boolean
  notificationPermission: NotificationPermission | 'unsupported'
}

let sharedAudioCtx: AudioContext | null = null
let isAudioUnlocked = false

/**
 * Lazily initialize and resume the Web Audio Context.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!sharedAudioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AC) {
        sharedAudioCtx = new AC()
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
  } catch {
    return null
  }
}

/**
 * Unlock AudioContext & SpeechSynthesis on initial user interaction.
 */
export function unlockAudio(): void {
  if (isAudioUnlocked || typeof window === 'undefined') return
  try {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume()
    }
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
    isAudioUnlocked = true
  } catch {
    // ignore gesture unlock failures
  }
}

// Auto-register touch/click unlocker once in browser
if (typeof window !== 'undefined') {
  const unlockEvents = ['pointerdown', 'keydown', 'touchstart']
  const handleUnlock = () => {
    unlockAudio()
    unlockEvents.forEach((evt) => window.removeEventListener(evt, handleUnlock))
  }
  unlockEvents.forEach((evt) => window.addEventListener(evt, handleUnlock, { once: true, passive: true }))
}

/**
 * Play a crisp dual-tone restaurant chime before the voice announcement.
 */
export function playRestaurantChime(volume = 0.2): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext()
      if (!ctx) {
        resolve()
        return
      }
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime

      // First Tone: F#5 (739.99 Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(739.99, now)
      gain1.gain.setValueAtTime(volume, now)
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.3)

      // Second Tone: A5 (880 Hz) - higher bell chime
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880, now + 0.12)
      gain2.gain.setValueAtTime(volume * 1.1, now + 0.12)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.12)
      osc2.stop(now + 0.55)

      setTimeout(resolve, 380)
    } catch {
      resolve()
    }
  })
}

let cachedVoiceResult: { voice: SpeechSynthesisVoice | null; isHindi: boolean } | null = null

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoiceResult = null
  })
}

/**
 * Invalidate cached voice detection.
 */
export function invalidateVoiceCache(): void {
  cachedVoiceResult = null
}

/**
 * Find the optimal voice for Hindi announcements.
 * Prioritizes native Hindi (hi-IN) -> Indian English (en-IN) -> System default.
 * Cached in memory to prevent scanning dozens of system voices on every call.
 */
export function findBestVoice(): { voice: SpeechSynthesisVoice | null; isHindi: boolean } {
  if (cachedVoiceResult) {
    return cachedVoiceResult
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { voice: null, isHindi: false }
  }

  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) {
    return { voice: null, isHindi: false }
  }

  // 1. Exact or prefix match for Hindi (hi-IN, hi_IN, or lang starting with "hi")
  const hindiVoice = voices.find((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-')
    return (
      lang === 'hi-in' ||
      lang.startsWith('hi-') ||
      lang === 'hi' ||
      v.name.toLowerCase().includes('hindi') ||
      v.name.includes('हिन्दी')
    )
  })

  if (hindiVoice) {
    cachedVoiceResult = { voice: hindiVoice, isHindi: true }
    return cachedVoiceResult
  }

  // 2. High quality Indian English fallback (e.g. en-IN), which pronounces Indian terms well
  const indianEnVoice = voices.find((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-')
    return lang === 'en-in' || v.name.toLowerCase().includes('india')
  })

  if (indianEnVoice) {
    cachedVoiceResult = { voice: indianEnVoice, isHindi: false }
    return cachedVoiceResult
  }

  // 3. System default or first available voice
  const defaultVoice = voices.find((v) => v.default) || voices[0] || null
  cachedVoiceResult = { voice: defaultVoice, isHindi: false }
  return cachedVoiceResult
}

/**
 * Retrieve current Voice Engine & Browser Notification status.
 */
export function getVoiceEngineStatus(): VoiceEngineStatus {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      hasHindiVoice: false,
      activeVoiceName: null,
      activeVoiceLang: null,
      isFallback: false,
      audioUnlocked: false,
      notificationPermission: 'unsupported',
    }
  }

  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const { voice, isHindi } = findBestVoice()

  let notificationPermission: NotificationPermission | 'unsupported' = 'unsupported'
  if ('Notification' in window) {
    notificationPermission = Notification.permission
  }

  return {
    supported,
    hasHindiVoice: isHindi,
    activeVoiceName: voice ? voice.name : null,
    activeVoiceLang: voice ? voice.lang : null,
    isFallback: !isHindi,
    audioUnlocked: isAudioUnlocked,
    notificationPermission,
  }
}

export interface SpeechOrderItem {
  itemName?: string
  name?: string
  quantity?: number
  qty?: number
}

export interface AnnounceOrderHindiOptions {
  tableLabel?: string | number | null
  items?: Array<SpeechOrderItem | string>
  playChimeFirst?: boolean
  rate?: number
  pitch?: number
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (err: unknown) => void
}

/**
 * Announce Hindi order arrival via Web Speech API with dual-tone chime and specific items.
 */
export async function announceOrderInHindi(
  tableLabelOrConfig?: string | number | null | AnnounceOrderHindiOptions,
  legacyOptions?: AnnounceOrderHindiOptions
): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false
  }

  let tableLabel: string | number | null | undefined
  let items: Array<SpeechOrderItem | string> | undefined
  let options: AnnounceOrderHindiOptions | undefined

  if (tableLabelOrConfig && typeof tableLabelOrConfig === 'object') {
    tableLabel = tableLabelOrConfig.tableLabel
    items = tableLabelOrConfig.items
    options = { ...tableLabelOrConfig, ...legacyOptions }
  } else {
    tableLabel = tableLabelOrConfig
    items = legacyOptions?.items
    options = legacyOptions
  }

  const text = getHindiTableAnnouncement({ tableLabel, items })

  if (options?.playChimeFirst !== false) {
    await playRestaurantChime(options?.volume !== undefined ? options.volume * 0.25 : 0.2)
  }

  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis

      // Chrome bug workaround: resume synth if it became paused
      if (synth.paused) {
        synth.resume()
      }
      // Cancel previous queued speech to keep real-time freshness
      synth.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'hi-IN'
      utterance.rate = options?.rate ?? 0.95 // clear speaking rate for restaurant
      utterance.pitch = options?.pitch ?? 1.0
      utterance.volume = options?.volume ?? 1.0

      const { voice } = findBestVoice()
      if (voice) {
        utterance.voice = voice
      }

      utterance.onstart = () => {
        options?.onStart?.()
      }

      utterance.onend = () => {
        options?.onEnd?.()
        resolve(true)
      }

      utterance.onerror = (e) => {
        // 'interrupted' is common when cancelled, not a critical failure
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[SpeechSynthesis] Announcement error:', e.error)
          options?.onError?.(e)
        }
        resolve(false)
      }

      // Safety timeout in case speech engine hangs (browser edge cases)
      const safetyTimer = setTimeout(() => {
        resolve(false)
      }, 9000)

      utterance.addEventListener(
        'end',
        () => {
          clearTimeout(safetyTimer)
        },
        { once: true }
      )

      synth.speak(utterance)
    } catch (err) {
      console.warn('[SpeechSynthesis] Failed to speak:', err)
      options?.onError?.(err)
      resolve(false)
    }
  })
}

/**
 * Display native browser notification for new orders.
 */
export function showOrderNotification(params: {
  orderNumber: string
  tableLabel?: string | null
  totalFormatted?: string
  items?: Array<SpeechOrderItem | string>
  onClick?: () => void
}): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false

  if (Notification.permission !== 'granted') return false

  try {
    const tableText = params.tableLabel ? `टेबल: ${params.tableLabel}` : 'नया ऑर्डर'
    const title = `🔔 नया ऑर्डर प्राप्त हुआ! (${params.orderNumber})`

    let itemsLine = ''
    if (params.items && params.items.length > 0) {
      const itemNames = params.items.slice(0, 3).map((it) => {
        if (typeof it === 'string') return it
        const qty = it.quantity || it.qty || 1
        return `${qty}x ${it.itemName || it.name}`
      })
      itemsLine = `\nऑर्डर: ${itemNames.join(', ')}${params.items.length > 3 ? ` +${params.items.length - 3} more` : ''}`
    }

    const body = `${tableText}${params.totalFormatted ? ` • कुल: ${params.totalFormatted}` : ''}${itemsLine}\nकिचन डैशबोर्ड पर देखें`

    const options: NotificationOptions & { renotify?: boolean } = {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon-32x32.png',
      tag: `order-${params.orderNumber}`,
      renotify: true,
      requireInteraction: false,
    }

    const notification = new Notification(title, options as NotificationOptions)

    notification.onclick = () => {
      window.focus()
      params.onClick?.()
      notification.close()
    }

    return true
  } catch (err) {
    console.warn('[Notification] Could not display browser notification:', err)
    return false
  }
}

/**
 * Request browser permission for system notifications.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return Notification.permission || 'unsupported'
  }
}
