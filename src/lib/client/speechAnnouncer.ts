/**
 * Client-Side Speech Synthesis and Audio Chime Engine for Order Announcements.
 *
 * Utilizes the standard Web Speech API (speechSynthesis) and Web Audio API (AudioContext)
 * with robust auto-unlock, Indian/Hindi voice detection, fallback handling, and native
 * Browser Notifications.
 */

import { getHindiTableAnnouncement } from '../ordering/hindiAnnouncement.mjs'

declare global {
  interface Window {
    AndroidTTS?: {
      speak: (text: string) => void
      showOrderNotification?: (
        orderNumber: string,
        tableLabel: string,
        itemsSummary: string,
        speechAnnouncement: string
      ) => void
      isAvailable: () => boolean
      stop: () => void
    }
  }
}

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

  // 1. Check for Android Native Bridge
  const hasAndroidTTS = !!(window.AndroidTTS && typeof window.AndroidTTS.speak === 'function')
  let notificationPermission: NotificationPermission | 'unsupported' = 'unsupported'
  if ('Notification' in window) {
    notificationPermission = Notification.permission
  }

  if (hasAndroidTTS) {
    return {
      supported: true,
      hasHindiVoice: true,
      activeVoiceName: 'Android Google TTS (Hindi)',
      activeVoiceLang: 'hi-IN',
      isFallback: false,
      audioUnlocked: true,
      notificationPermission,
    }
  }

  // 2. Standard Web Speech API
  const hasSpeechSynthesis = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const { voice, isHindi } = findBestVoice()

  return {
    supported: hasSpeechSynthesis || true, // Audio fallback always available
    hasHindiVoice: isHindi || hasAndroidTTS,
    activeVoiceName: voice ? voice.name : hasAndroidTTS ? 'Android Google TTS' : 'Audio TTS',
    activeVoiceLang: voice ? voice.lang : 'hi-IN',
    isFallback: !isHindi && !hasAndroidTTS,
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
 * Announce Hindi order arrival via Android Native TTS, Web Speech API, or HTML5 Audio stream.
 */
export async function announceOrderInHindi(
  tableLabelOrConfig?: string | number | null | AnnounceOrderHindiOptions,
  legacyOptions?: AnnounceOrderHindiOptions
): Promise<boolean> {
  if (typeof window === 'undefined') {
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

  // Play double-tone restaurant chime before speaking
  if (options?.playChimeFirst !== false) {
    await playRestaurantChime(options?.volume !== undefined ? options.volume * 0.25 : 0.2)
  }

  // 1. Android Native TTS Bridge (runs on Android app WebView)
  if (window.AndroidTTS && typeof window.AndroidTTS.speak === 'function') {
    try {
      options?.onStart?.()
      window.AndroidTTS.speak(text)
      // Native speech handles audio output on device speaker directly
      setTimeout(() => {
        options?.onEnd?.()
      }, 3000)
      return true
    } catch (err) {
      console.warn('[AndroidTTS] Native speak call failed, falling back:', err)
    }
  }

  // 2. Standard Browser Web Speech API (Chrome, Safari, Edge)
  if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
    return new Promise((resolve) => {
      try {
        const synth = window.speechSynthesis

        if (synth.paused) {
          synth.resume()
        }
        synth.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'hi-IN'
        utterance.rate = options?.rate ?? 0.95
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
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            console.warn('[SpeechSynthesis] Announcement error:', e.error)
            options?.onError?.(e)
          }
          resolve(false)
        }

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

  // 3. Fallback: Online Hindi Audio TTS stream via HTML5 Audio element
  try {
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(text)}`
    const audio = new Audio(audioUrl)
    audio.volume = options?.volume ?? 1.0
    options?.onStart?.()
    await audio.play()
    options?.onEnd?.()
    return true
  } catch (audioErr) {
    console.warn('[AudioFallback] Cloud TTS failed:', audioErr)
    return false
  }
}

/**
 * Display native Android / browser notification for new orders and dictate items.
 */
export function showOrderNotification(params: {
  orderNumber: string
  tableLabel?: string | null
  totalFormatted?: string
  items?: Array<SpeechOrderItem | string>
  speechAnnouncement?: string
  onClick?: () => void
}): boolean {
  if (typeof window === 'undefined') return false

  let itemsSummary = ''
  if (params.items && params.items.length > 0) {
    const itemNames = params.items.slice(0, 5).map((it) => {
      if (typeof it === 'string') return it
      const qty = it.quantity || it.qty || 1
      return `${qty}x ${it.itemName || it.name}`
    })
    itemsSummary = itemNames.join(', ')
    if (params.items.length > 5) {
      itemsSummary += ` (+${params.items.length - 5} अन्य)`
    }
  }

  const table = params.tableLabel ? String(params.tableLabel) : 'काउंटर'
  const speechText =
    params.speechAnnouncement ||
    getHindiTableAnnouncement({ tableLabel: params.tableLabel, items: params.items })

  // 1. Native Android App: Trigger native Android Heads-Up notification + item dictation
  if (window.AndroidTTS && typeof window.AndroidTTS.showOrderNotification === 'function') {
    try {
      window.AndroidTTS.showOrderNotification(
        params.orderNumber,
        table,
        itemsSummary,
        speechText
      )
      return true
    } catch (e) {
      console.warn('[AndroidTTS] showOrderNotification error:', e)
    }
  }

  // 2. Standard Browser Web Notification API (Desktop / Chrome)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const title = `🔔 नया ऑर्डर: टेबल ${table} (#${params.orderNumber})`
      const body = `🍽️ टेबल: ${table}${params.totalFormatted ? ` • ${params.totalFormatted}` : ''}${itemsSummary ? `\n📋 ${itemsSummary}` : ''}\nकिचन डैशबोर्ड पर देखें`

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

  return false
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
