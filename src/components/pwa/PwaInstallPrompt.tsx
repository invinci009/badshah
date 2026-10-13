'use client'

import { usePwa } from './PwaProvider'
import { Download, Share, PlusSquare, X, Sparkles, Check, Smartphone } from 'lucide-react'
import Image from 'next/image'

export default function PwaInstallPrompt() {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    showInstallModal,
    setShowInstallModal,
    promptInstall,
    dismissInstallPrompt,
  } = usePwa()

  // If already running inside standalone PWA, don't show prompt
  if (isInstalled) return null

  // If not prompted to show, don't render the modal
  if (!showInstallModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-[0_25px_60px_-15px_rgba(245,158,11,0.25)] text-slate-100 relative space-y-4 animate-in slide-in-from-bottom-6 duration-300 pb-safe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={dismissInstallPrompt}
          aria-label="Dismiss installation prompt"
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with App Icon */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 p-0.5 shadow-lg shadow-amber-600/30 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192x192.png"
              alt="ReviewPulse"
              className="w-full h-full rounded-2xl object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-950 border border-amber-400 flex items-center justify-center text-amber-400">
              <Sparkles className="w-3 h-3" />
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                PWA Application
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h2 id="pwa-install-title" className="text-lg font-bold tracking-tight text-white leading-tight">
              Install ReviewPulse
            </h2>
            <p className="text-xs text-slate-400">
              Biryani Badshah Feedback &amp; Portal
            </p>
          </div>
        </div>

        {/* Benefits List */}
        <div className="grid grid-cols-2 gap-2 text-xs py-1">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3" />
            </div>
            <span className="text-slate-300 font-medium">1-Tap Fast Launch</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3" />
            </div>
            <span className="text-slate-300 font-medium">Offline Resilience</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3" />
            </div>
            <span className="text-slate-300 font-medium">No App Store Needed</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3" />
            </div>
            <span className="text-slate-300 font-medium">Full Screen Native UI</span>
          </div>
        </div>

        {/* iOS vs Android / Desktop Instructions */}
        {isIOS ? (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              How to install on iOS Safari:
            </div>
            <ol className="space-y-1.5 text-slate-300 pl-1">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-slate-800 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white">Share</strong> button{' '}
                  <Share className="inline w-3.5 h-3.5 text-sky-400 mx-0.5" /> in Safari menu
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-slate-800 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <span>
                  Scroll down &amp; tap <strong className="text-white">Add to Home Screen</strong>{' '}
                  <PlusSquare className="inline w-3.5 h-3.5 text-emerald-400 mx-0.5" />
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-slate-800 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <span>
                  Tap <strong className="text-white">Add</strong> in top-right to finish
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={promptInstall}
              className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer active:scale-95 text-sm"
            >
              <Download className="w-4 h-4" />
              Install to Home Screen
            </button>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={dismissInstallPrompt}
            className="text-slate-400 hover:text-slate-200 py-1 transition-colors cursor-pointer"
          >
            Maybe later
          </button>
          <span className="text-[11px] text-slate-500">
            Takes less than 1MB space
          </span>
        </div>
      </div>
    </div>
  )
}
