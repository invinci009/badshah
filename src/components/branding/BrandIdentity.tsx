'use client'

import React from 'react'

interface BrandIdentityProps {
  variant?: 'compact' | 'standard' | 'large' | 'hero'
  showTagline?: boolean
  showLogo?: boolean
  theme?: 'dark' | 'light'
  className?: string
}

export function BrandIdentity({
  variant = 'standard',
  showTagline = true,
  showLogo = true,
  theme = 'light',
  className = '',
}: BrandIdentityProps) {
  const isDark = theme === 'dark'

  const logoSizes = {
    compact: 'w-7 h-7 rounded-lg',
    standard: 'w-9 h-9 rounded-xl',
    large: 'w-12 h-12 rounded-2xl',
    hero: 'w-20 h-20 rounded-3xl',
  }

  const titleSizes = {
    compact: 'text-sm',
    standard: 'text-base sm:text-lg',
    large: 'text-xl sm:text-2xl',
    hero: 'text-2xl sm:text-4xl',
  }

  const taglineSizes = {
    compact: 'text-[9px]',
    standard: 'text-[11px] sm:text-xs',
    large: 'text-xs sm:text-sm',
    hero: 'text-sm sm:text-base',
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {showLogo && (
        <div
          className={`${logoSizes[variant]} overflow-hidden border ${
            isDark ? 'border-emerald-500/30 bg-slate-900' : 'border-emerald-500/40 bg-white'
          } shadow-sm shrink-0 flex items-center justify-center p-0.5`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Biryani Badshah"
            className="w-full h-full object-contain"
          />
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <span
          className={`font-onstage font-bruce font-black tracking-wider uppercase leading-none ${
            titleSizes[variant]
          } ${isDark ? 'text-white' : 'text-stone-900'}`}
        >
          BIRYANI BADSHAH
        </span>
        {showTagline && (
          <span
            className={`font-script font-normal tracking-wide mt-0.5 leading-none ${
              taglineSizes[variant]
            } ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
          >
            A Family Restaurant
          </span>
        )}
      </div>
    </div>
  )
}

export default BrandIdentity

