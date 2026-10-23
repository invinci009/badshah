'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  UtensilsCrossed,
  Star,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  Crown,
} from 'lucide-react'
import { formatTableDisplay } from '@/lib/ordering/rules.mjs'
import { getActiveOrderSession, type ActiveSession } from '@/lib/ordering/cart'

interface MainPortalSelectorProps {
  slug: string
  initialTable: string | null
  token?: string | null
  tables: Array<{ id: string; label: string; state?: string }>
  restaurantName: string
  reviewSlug: string
}

export default function MainPortalSelector({
  slug,
  initialTable,
  token,
  tables,
  restaurantName,
  reviewSlug,
}: MainPortalSelectorProps) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)

  const [selectedTable, setSelectedTable] = useState<string | null>(() => {
    if (initialTable) return initialTable
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem(`rp_table_${slug}`) || null
      } catch {
        return null
      }
    }
    return null
  })

  useEffect(() => {
    const session = getActiveOrderSession(slug)
    if (session) {
      setActiveSession(session)
      // If no table was explicitly picked, align with active table
      if (!selectedTable && !initialTable) {
        setSelectedTable(session.tableLabel)
      }
    } else {
      setActiveSession(null)
    }
  }, [slug, initialTable, selectedTable])

  const handleSelectTable = (label: string, state?: string) => {
    // Cannot select an occupied or cleaning table unless it's the customer's own active table
    const isOwnActive = activeSession?.tableLabel === label
    if (state === 'occupied' && !isOwnActive) {
      return
    }
    if (state === 'cleaning' && !isOwnActive) {
      return
    }

    setSelectedTable(label)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`rp_table_${slug}`, label)
      } catch {
        // ignore
      }
    }
  }

  const effectiveTable = selectedTable || initialTable
  const currentTableObj = tables.find((t) => t.label === effectiveTable)
  const isCurrentTableOccupiedByOther =
    currentTableObj?.state === 'occupied' && activeSession?.tableLabel !== effectiveTable

  const menuParams = new URLSearchParams()
  if (effectiveTable) menuParams.set('table', effectiveTable)
  if (token) menuParams.set('token', token)
  const menuHref = `/order/${slug}/menu${menuParams.toString() ? `?${menuParams.toString()}` : ''}`

  const reviewParams = new URLSearchParams()
  if (effectiveTable) reviewParams.set('table', effectiveTable)
  if (token) reviewParams.set('token', token)
  const reviewHref = `/r/${reviewSlug}${reviewParams.toString() ? `?${reviewParams.toString()}` : ''}`

  return (
    <div className="space-y-4">
      {/* Active Dining Session Banner if customer already ordered */}
      {activeSession && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 border border-emerald-300 text-left space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{formatTableDisplay(activeSession.tableLabel)} • Active Dine-in</span>
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wide bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
              Booked for you
            </span>
          </div>
          <p className="text-[11px] text-emerald-900/80 leading-relaxed">
            Your table is booked and order is active. You can track your kitchen status or easily add more dishes.
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <Link
              href={`/order/${slug}/confirmation/${activeSession.orderId}?accessToken=${encodeURIComponent(
                activeSession.accessToken || ''
              )}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Track Order</span>
            </Link>
            <Link
              href={`/order/${slug}/menu?table=${encodeURIComponent(activeSession.tableLabel)}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 text-xs font-bold transition-colors"
            >
              <span>+ Add More Dishes</span>
            </Link>
          </div>
        </div>
      )}

      {/* Seated Table Status & Main QR Table Picker */}
      {token ? (
        // Specific physical Table QR with cryptographic token
        <div className="pt-1 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Seated at <strong className="font-extrabold text-emerald-950 underline underline-offset-2">{formatTableDisplay(effectiveTable)}</strong>
            </span>
          </div>
        </div>
      ) : (
        // MAIN QR: User can choose their table number with real-time occupancy locking
        <div className="pt-1 space-y-2.5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300/80 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>Select Your Table</span>
              </span>
              {effectiveTable && !isCurrentTableOccupiedByOther && (
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {formatTableDisplay(effectiveTable)} Selected
                </span>
              )}
            </div>

            {isCurrentTableOccupiedByOther ? (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-1.5">
                <span>{formatTableDisplay(effectiveTable)} is currently booked by another guest. Please tap an open table below:</span>
              </div>
            ) : (
              <p className="text-[11px] text-amber-900/80">
                Tap your seated table below to book it for your party. Booked tables are locked for others:
              </p>
            )}

            {/* Table Selection Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {tables.map((t) => {
                const isSelected = effectiveTable === t.label
                const isOwnActive = activeSession?.tableLabel === t.label
                const isOccupied = t.state === 'occupied' && !isOwnActive
                const isCleaning = t.state === 'cleaning' && !isOwnActive

                if (isOccupied) {
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled
                      title={`${formatTableDisplay(t.label)} is currently occupied/booked by another guest.`}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed flex items-center gap-1.5 opacity-60"
                    >
                      <span>{formatTableDisplay(t.label)}</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.2 rounded">
                        Booked
                      </span>
                    </button>
                  )
                }

                if (isCleaning) {
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled
                      title={`${formatTableDisplay(t.label)} is being cleaned.`}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed flex items-center gap-1.5 opacity-60"
                    >
                      <span>{formatTableDisplay(t.label)}</span>
                      <span className="text-[10px] font-bold text-stone-600 bg-stone-200 px-1.5 py-0.2 rounded">
                        Cleaning
                      </span>
                    </button>
                  )
                }

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTable(t.label, t.state)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400'
                        : isOwnActive
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-white text-stone-800 border border-amber-200 hover:border-amber-400 hover:bg-amber-50/60'
                    }`}
                  >
                    <span>{formatTableDisplay(t.label)}</span>
                    {isOwnActive && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => handleSelectTable('Counter')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  effectiveTable === 'Counter'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400'
                    : 'bg-white text-stone-800 border border-amber-200 hover:border-amber-400 hover:bg-amber-50/60'
                }`}
              >
                <span>Counter / Takeaway</span>
                {effectiveTable === 'Counter' && <CheckCircle2 className="w-3 h-3 text-white" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Core Action: All-in-One Order Portal with Integrated Rewards */}
      <div className="space-y-3 pt-1 text-left">
        <Link
          href={menuHref}
          className="group relative block p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-amber-600 text-white shadow-xl shadow-amber-600/25 border border-amber-400/40 hover:shadow-2xl hover:shadow-amber-600/35 transition-all duration-200 active:scale-[0.98]"
        >
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <UtensilsCrossed className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-100 bg-black/15 px-2 py-0.5 rounded-full inline-block">
                  {effectiveTable ? `${formatTableDisplay(effectiveTable)} • Dine-in` : 'Dine-in Order'}
                </span>
                <span className="text-[10px] font-black text-amber-950 bg-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <Crown className="w-3 h-3 text-amber-800 fill-amber-700" />
                  VIP Rewards Integrated
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1 leading-tight flex items-center gap-1.5">
                {effectiveTable ? `Order for ${formatTableDisplay(effectiveTable)}` : 'Start Your Order'}
              </h2>
              <p className="text-xs text-amber-50 mt-1 leading-relaxed">
                {effectiveTable
                  ? `Browse live menu, customize dishes, earn loyalty points & redeem member rewards directly for ${formatTableDisplay(effectiveTable)}.`
                  : 'Browse live menu with photos, earn loyalty points & redeem member rewards delivered right to your table.'}
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-white bg-black/20 hover:bg-black/30 w-fit px-3.5 py-1.5 rounded-xl transition-colors shadow-xs">
                <span>{effectiveTable ? `Open ${formatTableDisplay(effectiveTable)} Menu & Rewards` : 'Open Menu & Order'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>

        {/* Secondary: Guest Review & Ratings */}
        <Link
          href={reviewHref}
          className="group relative block p-3.5 sm:p-4 rounded-2xl bg-white/90 hover:bg-white border border-amber-200/90 hover:border-amber-300 text-stone-900 shadow-xs hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300/40 flex items-center justify-center shrink-0 text-amber-600">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900">Already Dined? Leave a Review</span>
                  <div className="hidden sm:flex items-center gap-0.5 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-2.5 h-2.5 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-stone-500 truncate">Rate your experience in 30 seconds &amp; get a Google review draft</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 group-hover:text-amber-600 transition-all shrink-0" />
          </div>
        </Link>
      </div>
    </div>
  )
}
