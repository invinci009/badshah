'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, ArrowLeft, Utensils, Sparkles, Phone } from 'lucide-react'
import Link from 'next/link'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine
  )
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-reload when connection comes back
      window.location.reload()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleRetry = () => {
    setIsRetrying(true)
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 selection:bg-amber-500 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="fixed -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-24 right-1/4 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-md w-full mx-auto pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-amber-600/20">
            <Utensils className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">ReviewPulse</span>
        </div>

        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Offline Mode
        </span>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-amber-400 shadow-lg">
              <WifiOff className="w-9 h-9" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md font-bold text-xs">
              !
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-white">
              No Internet Connection
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
              You are currently offline. Any feedback you entered will sync automatically when you reconnect to Wi-Fi or mobile data.
            </p>
          </div>

          {/* Restaurant Quick Info Pill */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Sparkles className="w-3.5 h-3.5" />
                Biryani Badshah, Patna
              </div>
              <a
                href="tel:7763949496"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition-colors"
              >
                <Phone className="w-3 h-3 text-amber-400" />
                <span>Call: 77639 49496</span>
              </a>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Phulwari Rd, Near Shaheed Bhagat Singh Chowk, Birla Colony, Phulwari Sharif, Patna, Bihar 801505
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-amber-600/25 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Checking Network...' : 'Retry Connection'}
            </button>

            <Link
              href="/"
              className="w-full h-11 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/50 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Home
            </Link>
          </div>

          {isOnline && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in">
              Connection restored! Reloading...
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-3 text-xs text-slate-500">
        ReviewPulse PWA • Offline Resilience Engine
      </footer>
    </div>
  )
}
