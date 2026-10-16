'use client'

import React, { useState, useSyncExternalStore } from 'react'
import {
  Volume2,
  VolumeX,
  Play,
  Bell,
  BellCheck,
  Sparkles,
  Info,
  ChevronRight,
  Radio,
  Smartphone,
  CheckCircle2,
} from 'lucide-react'
import { useOrderAnnouncer } from './OrderAnnouncerContext'
import { formatPaise } from '@/lib/ordering/rules.mjs'

interface OrderAnnouncerBarProps {
  onNavigateToOrders?: () => void
}

const noopSubscribe = () => () => {}

const TEST_PRESETS = [
  {
    id: '5',
    name: 'Table 5 (2 बटर नान, 1 पनीर)',
    table: '5',
    items: [
      { itemName: 'बटर नान', quantity: 2 },
      { itemName: 'पनीर टिक्का', quantity: 1 },
    ],
  },
  {
    id: '12',
    name: 'Table 12 (1 दाल मखनी, 4 रोटी)',
    table: '12',
    items: [
      { itemName: 'दाल मखनी', quantity: 1 },
      { itemName: 'तंदूरी रोटी', quantity: 4 },
    ],
  },
  {
    id: '1',
    name: 'Table 1 (1 चाय, 2 समोसा)',
    table: '1',
    items: [
      { itemName: 'मसाला चाय', quantity: 1 },
      { itemName: 'समोसा', quantity: 2 },
    ],
  },
  {
    id: '25',
    name: 'Table 25 (3 वेज बिरयानी)',
    table: '25',
    items: [{ itemName: 'वेज बिरयानी', quantity: 3 }],
  },
  {
    id: 'VIP',
    name: 'VIP Table (फुल कॉम्बो)',
    table: 'VIP',
    items: [
      { itemName: 'शाही पनीर', quantity: 1 },
      { itemName: 'दाल मखनी', quantity: 1 },
      { itemName: 'गार्लिक नान', quantity: 4 },
    ],
  },
  {
    id: 'Counter',
    name: 'Counter (1 कोल्ड कॉफ़ी)',
    table: 'Counter',
    items: [{ itemName: 'कोल्ड कॉफ़ी', quantity: 1 }],
  },
]

export default function OrderAnnouncerBar({ onNavigateToOrders }: OrderAnnouncerBarProps) {
  const isMounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )

  const {
    isVoiceEnabled,
    toggleVoice,
    engineStatus,
    isAnnouncing,
    activeArrival,
    testVoice,
    requestNotifications,
  } = useOrderAnnouncer()

  const [showVoiceHelp, setShowVoiceHelp] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [isTestingPhone, setIsTestingPhone] = useState(false)
  const [phoneTestResult, setPhoneTestResult] = useState<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState('5')

  if (!isMounted) {
    return null
  }

  const currentPreset = TEST_PRESETS.find((p) => p.id === selectedPresetId) || TEST_PRESETS[0]

  const handleTestVoice = () => {
    testVoice(currentPreset.table, currentPreset.items)
  }

  const handleTestPhoneAlarm = async () => {
    setIsTestingPhone(true)
    setPhoneTestResult(null)
    try {
      const res = await fetch('/api/business/alerts/test-mobile', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setPhoneTestResult('अलार्म भेजा गया! अपने फ़ोन की घंटी चेक करें।')
      } else {
        setPhoneTestResult(data.error || 'फ़ोन अलार्म भेजने में समस्या आई।')
      }
    } catch {
      setPhoneTestResult('नेटवर्क त्रुटि: कृपया पुनः प्रयास करें।')
    } finally {
      setIsTestingPhone(false)
    }
  }

  return (
    <div className="w-full relative z-30">
      {/* 1. Real-time Live Arrival Alert Banner (Slides down when an order arrives) */}
      {activeArrival && (
        <div className="mb-3 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/40 p-3 sm:p-4 shadow-lg backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30 animate-pulse">
                  <Radio className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/60">
                      नया ऑर्डर आया है
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      #{activeArrival.orderNumber}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-white mt-0.5 flex items-center gap-2">
                    <span>
                      टेबल {activeArrival.tableLabel ? activeArrival.tableLabel : 'काउंटर'}
                    </span>
                    {activeArrival.totalPaise !== undefined && (
                      <span className="text-sm font-normal text-slate-300">
                        • {formatPaise(activeArrival.totalPaise)}
                      </span>
                    )}
                  </div>
                  {activeArrival.items && activeArrival.items.length > 0 && (
                    <div className="text-xs text-amber-200/90 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-amber-400 font-semibold">ऑर्डर में है:</span>
                      <span>
                        {activeArrival.items.slice(0, 3).map((it) => `${it.quantity}x ${it.itemName}`).join(', ')}
                        {activeArrival.items.length > 3 ? ` (+${activeArrival.items.length - 3} अन्य)` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAnnouncing && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-1 bg-amber-400 rounded-full animate-[bounce_0.6s_infinite_100ms] h-3" />
                      <span className="w-1 bg-amber-400 rounded-full animate-[bounce_0.6s_infinite_200ms] h-2" />
                      <span className="w-1 bg-amber-400 rounded-full animate-[bounce_0.6s_infinite_300ms] h-3.5" />
                    </div>
                    <span>Announcing Hindi voice…</span>
                  </div>
                )}

                {onNavigateToOrders && (
                  <button
                    onClick={onNavigateToOrders}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all"
                  >
                    <span>View Orders</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Sleek Control & Status Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md shadow-sm">
        {/* Left: Voice Status & Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleVoice()}
            title={isVoiceEnabled ? 'Click to Mute Hindi Voice Announcements' : 'Click to Enable Hindi Voice Announcements'}
            className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
              isVoiceEnabled
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 shadow-sm shadow-amber-500/10'
                : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {isVoiceEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Hindi Voice ON</span>
                {isAnnouncing && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                )}
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Voice Muted</span>
              </>
            )}
          </button>

          {/* Test Voice Button with Presets */}
          <div className="inline-flex items-center rounded-xl bg-slate-800/80 border border-slate-700/60 p-0.5">
            <button
              onClick={handleTestVoice}
              disabled={isAnnouncing}
              title="Test the Hindi speech announcement with sample table & items"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 hover:text-amber-300 hover:bg-slate-700/60 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Test Voice (आवाज़ टेस्ट)</span>
            </button>
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-slate-300 border-l border-slate-700/60 px-1.5 py-1 focus:outline-none cursor-pointer max-w-[150px] sm:max-w-none truncate"
              title="Select sample order with items for test"
            >
              {TEST_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id} className="bg-slate-900 text-slate-200">
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Engine Badge & Browser Notification Permission */}
        <div className="flex items-center gap-2 text-xs">
          {/* Hindi Voice Capability Indicator */}
          {engineStatus.supported && (
            <div className="relative">
              <button
                onClick={() => setShowVoiceHelp((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                  engineStatus.hasHindiVoice
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/40'
                    : 'bg-amber-950/40 border-amber-800/60 text-amber-400 hover:bg-amber-900/40'
                }`}
                title="Click for TTS voice engine details"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    engineStatus.hasHindiVoice ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="hidden md:inline font-medium">
                  {engineStatus.hasHindiVoice
                    ? `Hindi TTS: ${engineStatus.activeVoiceName || 'hi-IN'}`
                    : 'System Fallback Voice'}
                </span>
                <span className="md:hidden font-medium">
                  {engineStatus.hasHindiVoice ? 'Hindi TTS' : 'TTS Fallback'}
                </span>
                <Info className="w-3 h-3 opacity-60" />
              </button>

              {/* Help Popover for Hindi Voice Setup */}
              {showVoiceHelp && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 p-3.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-200 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Hindi Voice Engine Info
                    </span>
                    <button
                      onClick={() => setShowVoiceHelp(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-slate-300 mb-2 leading-relaxed">
                    Uses the browser&apos;s built-in Web Speech API without external cloud fees or delays.
                  </p>
                  <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/50 mb-2 space-y-1">
                    <div>
                      <span className="text-slate-400">Current Voice: </span>
                      <span className="font-semibold text-amber-300">
                        {engineStatus.activeVoiceName || 'Default Browser Voice'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Language: </span>
                      <span className="text-slate-200 font-mono">
                        {engineStatus.activeVoiceLang || 'hi-IN'}
                      </span>
                    </div>
                  </div>
                  {!engineStatus.hasHindiVoice && (
                    <div className="text-[11px] text-amber-200/90 bg-amber-950/60 border border-amber-800/40 p-2 rounded-lg">
                      💡 To install native Hindi voice: In Windows, go to <i>Settings &gt; Time &amp; Language &gt; Speech &gt; Add Hindi</i>. In Chrome/Android, Hindi TTS is bundled automatically.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Phone Alarm Setup Button (Swiggy / Zomato style loud alarm) */}
          <button
            onClick={() => setShowPhoneModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 active:scale-95 transition-all text-xs font-medium"
            title="फ़ोन पर स्विगी/ज़ोमेटो जैसा लाउड अलार्म सेट करें (जब स्क्रीन बंद हो)"
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Phone Alarm (फ़ोन अलार्म)</span>
            <span className="sm:hidden">Alarm</span>
          </button>

          {/* Browser Notification Button */}
          {engineStatus.notificationPermission === 'granted' ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 text-xs font-medium"
              title="Browser notifications active"
            >
              <BellCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">Notifications Active</span>
            </span>
          ) : engineStatus.notificationPermission !== 'unsupported' ? (
            <button
              onClick={requestNotifications}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 active:scale-95 transition-all text-xs font-medium"
              title="Allow browser notifications to view alerts when tab is in background"
            >
              <Bell className="w-3.5 h-3.5 text-blue-400" />
              <span>Enable Notifications</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Phone Alarm Setup Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg p-5 sm:p-6 rounded-2xl bg-slate-900 border border-indigo-500/30 shadow-2xl text-slate-200 text-xs sm:text-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">फ़ोन अलार्म सेटअप (Phone Alarm)</h3>
                  <p className="text-xs text-slate-400">स्क्रीन लॉक या वेबसाइट बंद होने पर भी ज़ोमेटो/स्विगी जैसा लाउड अलार्म बजेगा</p>
                </div>
              </div>
              <button
                onClick={() => setShowPhoneModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-2">
                <div className="font-semibold text-white flex items-center gap-1.5 text-xs uppercase tracking-wider text-amber-400">
                  <span>चरण 1: अपने फ़ोन में ntfy ऐप डाउनलोड करें</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Google Play Store या Apple App Store से <b>ntfy</b> ऐप इंस्टॉल करें (100% फ्री, कोई अकाउंट नहीं चाहिए)।
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-2">
                <div className="font-semibold text-white flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-400">
                  <span>चरण 2: ऐप में अपना टॉपिक सब्सक्राइब करें</span>
                </div>
                <p className="text-xs text-slate-300">
                  ntfy ऐप खोलें, <b>+</b> (Subscribe) दबाएँ और यह नाम डालें:
                </p>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 font-mono text-amber-300 border border-slate-700 select-all">
                  <span>badshah-restaurant-orders</span>
                  <span className="text-[11px] text-slate-500 font-sans">Topic Name</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  💡 फ़ोन सेटिंग्स में इस टॉपिक का साउंड <b>&quot;Alarm / Siren&quot;</b> चुन लें और <b>&quot;Override Do Not Disturb&quot;</b> चालू करें।
                </p>
              </div>
            </div>

            {phoneTestResult && (
              <div className="mb-4 p-2.5 rounded-xl bg-indigo-950/70 border border-indigo-700/60 text-xs text-indigo-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{phoneTestResult}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                onClick={handleTestPhoneAlarm}
                disabled={isTestingPhone}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-xs shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Smartphone className="w-4 h-4" />
                <span>{isTestingPhone ? 'घंटी बजाई जा रही है…' : '🔔 फ़ोन पर अलार्म टेस्ट करें (Ring My Phone)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
