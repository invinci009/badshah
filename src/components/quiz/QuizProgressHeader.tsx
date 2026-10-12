'use client'

import { ArrowLeft, Utensils, Phone } from 'lucide-react'

interface QuizProgressHeaderProps {
  restaurantName: string
  logoUrl?: string | null
  currentStep: number
  totalSteps: number
  onBack: () => void
  canGoBack: boolean
}

export default function QuizProgressHeader({
  restaurantName,
  logoUrl,
  currentStep,
  totalSteps,
  onBack,
  canGoBack,
}: QuizProgressHeaderProps) {
  const progressPercent = Math.round(((currentStep) / totalSteps) * 100)

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      {/* Top row with restaurant info & back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label="Previous question"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0 shadow-sm border border-amber-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl || '/logo.png'}
                alt={restaurantName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png'
                }}
              />
            </div>
            <div>
              <span className="text-sm font-bold text-stone-900 truncate block max-w-[180px] sm:max-w-xs">
                {restaurantName || 'PM Zaika Restaurant'}
              </span>
              <span className="text-[10px] text-amber-800 font-semibold block">पीएम ज़ायका रेस्टोरेंट</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="tel:7488260572"
            className="flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300 transition-colors shadow-2xs"
            title="Helpline: +91 7488260572"
          >
            <Phone className="w-3 h-3 text-amber-700" />
            <span className="hidden sm:inline">Call:</span>
            <span>7488260572</span>
          </a>
          <div className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
            Step <span className="text-amber-800 font-bold">{currentStep}</span> of {totalSteps}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-stone-200/90 rounded-full overflow-hidden p-0.5">
        <div
          className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 rounded-full transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
