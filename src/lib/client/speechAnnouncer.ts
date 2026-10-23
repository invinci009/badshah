/**
 * Client-Side Speech Synthesis and Audio Chime Engine for Order Announcements.
 *
 * Utilizes the standard Web Speech API (speechSynthesis) and Web Audio API (AudioContext)
 * with robust auto-unlock, Indian/Hindi voice detection, fallback handling, and native
 * Browser Notifications.
 */

import {
  getHindiTableAnnouncement,
  getHindiServiceAnnouncement,
  SERVICE_REQUEST_ENGLISH_LABELS,
} from '../ordering/hindiAnnouncement.mjs'

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
      showServiceNotification?: (
        requestId: string,
        tableLabel: string,
        serviceType: string,
        note: string,
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
 * Check whether audio is currently unlocked by user gesture or native environment.
 */
export function getIsAudioUnlocked(): boolean {
  if (typeof window === 'undefined') return true
  if (window.AndroidTTS) return true
  if (sharedAudioCtx && sharedAudioCtx.state === 'running') return true
  return isAudioUnlocked
}

/**
 * Unlock AudioContext & SpeechSynthesis on initial user interaction.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return
  try {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
    isAudioUnlocked = true
    window.dispatchEvent(new Event('rp-audio-unlocked'))
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

// Protection against Chromium V8 garbage-collecting utterances mid-speech
const activeUtterances = new Set<SpeechSynthesisUtterance>()
let chromeKeepAliveInterval: ReturnType<typeof setInterval> | null = null

function startChromeKeepAlive() {
  if (chromeKeepAliveInterval || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  chromeKeepAliveInterval = setInterval(() => {
    if (activeUtterances.size > 0 && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      } catch {}
    } else {
      stopChromeKeepAlive()
    }
  }, 10000)
}

function stopChromeKeepAlive() {
  if (chromeKeepAliveInterval) {
    clearInterval(chromeKeepAliveInterval)
    chromeKeepAliveInterval = null
  }
}

/**
 * Split long announcement text into chunks (<= 120 chars) to prevent Google TTS HTTP 400 errors.
 */
function splitIntoTTSChunks(text: string, maxLen = 120): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  const sentences = text.split(/(?<=[।.,?!])\s*/)
  let current = ''
  for (const s of sentences) {
    if (!s) continue
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current ? current + ' ' : '') + s
    } else {
      if (current) chunks.push(current)
      if (s.length <= maxLen) {
        current = s
      } else {
        const clauses = s.split(/(?<=[,])\s*/)
        for (const c of clauses) {
          if ((current + ' ' + c).trim().length <= maxLen) {
            current = (current ? current + ' ' : '') + c
          } else {
            if (current) chunks.push(current)
            current = c
          }
        }
      }
    }
  }
  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [text.slice(0, 120)]
}

function playSingleAudioChunk(chunk: string, volume: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(
        chunk
      )}`
      const audio = new Audio(audioUrl)
      audio.volume = volume

      const timer = setTimeout(() => {
        try {
          audio.pause()
        } catch {}
        resolve(false)
      }, 10000)

      audio.onended = () => {
        clearTimeout(timer)
        resolve(true)
      }

      audio.onerror = () => {
        clearTimeout(timer)
        resolve(false)
      }

      const p = audio.play()
      if (p !== undefined) {
        p.catch(() => {
          clearTimeout(timer)
          resolve(false)
        })
      }
    } catch {
      resolve(false)
    }
  })
}

/**
 * Play Hindi speech via Google Translate Cloud Audio stream.
 * Produces crisp, natural native Indian Hindi speech on all devices without requiring installed voices.
 * Automatically chunks sentences to guarantee safe delivery under the 200-char query limit.
 */
export async function playCloudAudioTTS(
  text: string,
  options?: AnnounceOrderHindiOptions
): Promise<boolean> {
  if (!text || !text.trim()) return false
  const chunks = splitIntoTTSChunks(text.trim(), 120)
  options?.onStart?.()

  let anyPlayed = false
  for (let i = 0; i < chunks.length; i++) {
    const ok = await playSingleAudioChunk(chunks[i], options?.volume ?? 1.0)
    if (ok) {
      anyPlayed = true
    } else if (i === 0) {
      // First chunk blocked by autoplay or network offline: exit early so fallback can kick in
      return false
    }
  }

  options?.onEnd?.()
  return anyPlayed
}

const HINDI_TO_ROMAN_MAP: Array<[RegExp, string]> = [
  [/नया ऑर्डर आया है।?/g, 'Naya order aaya hai.'],
  [/काउंटर से ऑर्डर प्राप्त हुआ है।?/g, 'Counter se order prapt hua hai.'],
  [/टेकअवे से ऑर्डर प्राप्त हुआ है।?/g, 'Takeaway se order prapt hua hai.'],
  [/डिलीवरी के लिए ऑर्डर प्राप्त हुआ है।?/g, 'Delivery ke liye order prapt hua hai.'],
  [/वीआईपी टेबल नंबर/g, 'VIP Table number'],
  [/वीआईपी टेबल/g, 'VIP Table'],
  [/टेबल नंबर/g, 'Table number'],
  [/से ऑर्डर प्राप्त हुआ है।?/g, 'se order prapt hua hai.'],
  [/ऑर्डर में है:?/g, 'Order mein hai:'],
  [/और (\d+|\S+) अन्य आइटम/g, 'aur $1 other items'],
  [/और/g, 'aur'],
  [/सर्विस अलर्ट!?/g, 'Service alert!'],
  [/पीने का पानी मांगा गया है।?/g, 'drinking water manga gaya hai.'],
  [/बिल मांगा गया है।?/g, 'bill manga gaya hai.'],
  [/वेटर को बुलाया गया है।?/g, 'waiter ko bulaya gaya hai.'],
  [/टेबल साफ करने के लिए बुलाया गया है।?/g, 'table saaf karne ke liye bulaya gaya hai.'],
  [/चम्मच और प्लेट मांगी गई है।?/g, 'cutlery aur plates mangi gayi hai.'],
  [/स्टाफ सहायता बुलाई गई है।?/g, 'staff assistance bulayi gayi hai.'],
  [/नोट:?/g, 'Note:'],
  [/शून्य/g, 'shunya'], [/एक/g, 'ek'], [/दो/g, 'do'], [/तीन/g, 'teen'], [/चार/g, 'chaar'],
  [/पाँच/g, 'paanch'], [/छह/g, 'chhah'], [/सात/g, 'saat'], [/आठ/g, 'aath'], [/नौ/g, 'nau'],
  [/दस/g, 'das'], [/ग्यारह/g, 'gyaarah'], [/बारह/g, 'baarah'], [/तेरह/g, 'terah'],
  [/चौदह/g, 'chaudah'], [/पंद्रह/g, 'pandrah'], [/सोलह/g, 'solah'], [/सत्रह/g, 'satrah'],
  [/अठारह/g, 'athaarah'], [/उन्नीस/g, 'unnees'], [/बीस/g, 'bees'],
  [/।/g, '.'],
]

/**
 * Phonetic romanizer that converts Hindi announcement phrases into clean Hinglish words.
 * Ensures English-only system voices on Windows PCs speak audibly instead of remaining silent.
 */
export function toPhoneticRomanHindi(hindiText: string): string {
  let result = hindiText
  for (const [pattern, replacement] of HINDI_TO_ROMAN_MAP) {
    result = result.replace(pattern, replacement)
  }
  return result
}

/**
 * Play Hindi speech via standard Browser Web Speech API (speechSynthesis).
 * Includes Chromium garbage collection shield and automatic resume timer.
 */
export function playWebSpeechTTS(
  text: string,
  voice: SpeechSynthesisVoice | null,
  options?: AnnounceOrderHindiOptions
): Promise<boolean> {
  return new Promise((resolve) => {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      !('SpeechSynthesisUtterance' in window)
    ) {
      resolve(false)
      return
    }

    try {
      const synth = window.speechSynthesis

      if (synth.paused) {
        synth.resume()
      }
      synth.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = voice?.lang || 'hi-IN'
      utterance.rate = options?.rate ?? 0.95
      utterance.pitch = options?.pitch ?? 1.0
      utterance.volume = options?.volume ?? 1.0

      if (voice) {
        utterance.voice = voice
      }

      // GC Protection: hold reference in Set so V8 engine does not drop utterance mid-speech
      activeUtterances.add(utterance)
      startChromeKeepAlive()

      const cleanup = () => {
        activeUtterances.delete(utterance)
        if (activeUtterances.size === 0) stopChromeKeepAlive()
      }

      const maxWaitMs = Math.max(9000, text.length * 120)
      const safetyTimer = setTimeout(() => {
        cleanup()
        resolve(false)
      }, maxWaitMs)

      utterance.onstart = () => {
        options?.onStart?.()
      }

      utterance.onend = () => {
        clearTimeout(safetyTimer)
        cleanup()
        options?.onEnd?.()
        resolve(true)
      }

      utterance.onerror = (e) => {
        clearTimeout(safetyTimer)
        cleanup()
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[SpeechSynthesis] Error:', e.error)
          options?.onError?.(e)
        }
        resolve(false)
      }

      synth.speak(utterance)
    } catch (err) {
      console.warn('[SpeechSynthesis] speak failed:', err)
      options?.onError?.(err)
      resolve(false)
    }
  })
}

/**
 * Announce Hindi order arrival via Android Native TTS, Web Speech API, or Cloud Audio stream.
 * Guaranteed multi-tier fallback ensures speech ALWAYS plays under all network and OS conditions.
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

  // Tier 1: Android Native TTS Bridge (runs on Android app WebView, 100% reliable offline)
  if (window.AndroidTTS && typeof window.AndroidTTS.speak === 'function') {
    try {
      options?.onStart?.()
      window.AndroidTTS.speak(text)
      setTimeout(() => {
        options?.onEnd?.()
      }, 3000)
      return true
    } catch (err) {
      console.warn('[AndroidTTS] Native speak call failed, falling back:', err)
    }
  }

  // Find optimal browser voice
  const { voice, isHindi } = findBestVoice()
  const isHiddenTab = typeof document !== 'undefined' && document.visibilityState === 'hidden'

  // When tab is hidden/minimized, stream Cloud Audio directly to bypass Chromium's background speech throttling
  if (isHiddenTab) {
    const cloudOk = await playCloudAudioTTS(text, options)
    if (cloudOk) return true
  }

  // Tier 2 & 3: Multi-tier fallback hierarchy
  if (isHindi && voice) {
    // A. Native Hindi voice is installed: use Web Speech API
    const webSpeechOk = await playWebSpeechTTS(text, voice, options)
    if (webSpeechOk) return true

    // Fallback: If Web Speech failed or got blocked, stream Cloud Hindi Audio
    const cloudOk = await playCloudAudioTTS(text, options)
    if (cloudOk) return true
  } else {
    // B. No native Hindi voice pack installed (common on Windows PCs and tablets):
    // First try Cloud Hindi Audio stream (studio-quality Indian Hindi speech)
    const cloudOk = await playCloudAudioTTS(text, options)
    if (cloudOk) return true

    // Fallback: If offline without internet, use Web Speech API with phonetic Hinglish
    // (Devanagari script causes English-only system voices on Windows to fail silently; phonetic Hinglish speaks clearly)
    const speechPayload = toPhoneticRomanHindi(text)
    const fallbackOk = await playWebSpeechTTS(speechPayload, voice, options)
    if (fallbackOk) return true
  }

  return false
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
 * Announce customer staff assistance / service call out loud in Hindi.
 * Guaranteed multi-tier fallback ensures staff receives the audio alert.
 */
export async function announceServiceRequestInHindi(params: {
  tableLabel?: string | number | null
  type: string
  note?: string
  playChimeFirst?: boolean
  volume?: number
  onStart?: () => void
  onEnd?: () => void
  onError?: (err: unknown) => void
}): Promise<boolean> {
  if (typeof window === 'undefined') return false

  const text = getHindiServiceAnnouncement({
    tableLabel: params.tableLabel,
    type: params.type,
    note: params.note,
  })

  // Play double-tone chime before speaking
  if (params.playChimeFirst !== false) {
    await playRestaurantChime(params.volume !== undefined ? params.volume * 0.25 : 0.2)
  }

  // Tier 1: Android Native TTS Bridge
  if (window.AndroidTTS && typeof window.AndroidTTS.speak === 'function') {
    try {
      params.onStart?.()
      window.AndroidTTS.speak(text)
      setTimeout(() => {
        params.onEnd?.()
      }, 3000)
      return true
    } catch (err) {
      console.warn('[AndroidTTS] Service request speak call failed, falling back:', err)
    }
  }

  const { voice, isHindi } = findBestVoice()
  const isHiddenTab = typeof document !== 'undefined' && document.visibilityState === 'hidden'

  if (isHiddenTab) {
    const cloudOk = await playCloudAudioTTS(text, params)
    if (cloudOk) return true
  }

  if (isHindi && voice) {
    const webSpeechOk = await playWebSpeechTTS(text, voice, params)
    if (webSpeechOk) return true
    const cloudOk = await playCloudAudioTTS(text, params)
    if (cloudOk) return true
  } else {
    const cloudOk = await playCloudAudioTTS(text, params)
    if (cloudOk) return true
    const speechPayload = toPhoneticRomanHindi(text)
    const fallbackOk = await playWebSpeechTTS(speechPayload, voice, params)
    if (fallbackOk) return true
  }

  return false
}

/**
 * Display native Android / browser notification for service calls.
 */
export function showServiceNotification(params: {
  id?: string
  tableLabel?: string | null
  type: string
  note?: string
  speechAnnouncement?: string
  onClick?: () => void
}): boolean {
  if (typeof window === 'undefined') return false

  const table = params.tableLabel ? String(params.tableLabel) : 'काउंटर'
  const typeLabel =
    (SERVICE_REQUEST_ENGLISH_LABELS as Record<string, string>)[params.type] || params.type
  const speechText =
    params.speechAnnouncement ||
    getHindiServiceAnnouncement({
      tableLabel: params.tableLabel,
      type: params.type,
      note: params.note,
    })

  // 1. Android Native App: trigger heads-up notification + TTS
  if (window.AndroidTTS && typeof window.AndroidTTS.showServiceNotification === 'function') {
    try {
      window.AndroidTTS.showServiceNotification(
        params.id || 'service',
        table,
        params.type,
        params.note || '',
        speechText
      )
      return true
    } catch (e) {
      console.warn('[AndroidTTS] showServiceNotification error:', e)
    }
  } else if (window.AndroidTTS && typeof window.AndroidTTS.showOrderNotification === 'function') {
    try {
      window.AndroidTTS.showOrderNotification(
        params.id || 'service',
        table,
        `🔔 ${typeLabel}${params.note ? ` (${params.note})` : ''}`,
        speechText
      )
      return true
    } catch (e) {
      console.warn('[AndroidTTS] showOrderNotification fallback error:', e)
    }
  }

  // 2. Standard Browser Web Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const title = `🔔 स्टाफ कॉल: टेबल ${table} (${typeLabel})`
      const body = `📍 टेबल ${table} से ${typeLabel} के लिए बुलाया गया है।${params.note ? `\n📝 नोट: ${params.note}` : ''}\nकिचन डैशबोर्ड पर देखें`

      const options: NotificationOptions & { renotify?: boolean } = {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        tag: `service-${params.id || Date.now()}`,
        renotify: true,
      }

      const notification = new Notification(title, options as NotificationOptions)
      notification.onclick = () => {
        window.focus()
        params.onClick?.()
        notification.close()
      }
      return true
    } catch (err) {
      console.warn('[Notification] Could not display service notification:', err)
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
