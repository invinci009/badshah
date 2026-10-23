'use client'

import React from 'react'
import {
  BellRing,
  X,
  Droplets,
  HandPlatter,
  Brush,
  UtensilsCrossed,
  Receipt,
  Loader2,
} from 'lucide-react'
import { formatTableDisplay } from '@/lib/ordering/rules.mjs'

export interface ServiceCallModalProps {
  isOpen: boolean
  onClose: () => void
  tableLabel: string | null
  serviceType: string
  setServiceType: (type: string) => void
  serviceNote: string
  setServiceNote: (note: string) => void
  serviceSending: boolean
  onSubmit: (e: React.FormEvent) => void
}

const SERVICE_OPTIONS = [
  { id: 'water', label: 'Drinking Water', icon: Droplets },
  { id: 'assistance', label: 'Waiter Call', icon: HandPlatter },
  { id: 'cleaning', label: 'Clean Table', icon: Brush },
  { id: 'other', label: 'Cutlery / Plates', icon: UtensilsCrossed },
  { id: 'bill', label: 'Request Bill', icon: Receipt },
]

export function ServiceCallModal({
  isOpen,
  onClose,
  tableLabel,
  serviceType,
  setServiceType,
  serviceNote,
  setServiceNote,
  serviceSending,
  onSubmit,
}: ServiceCallModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="font-black text-base text-stone-900 flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-amber-600" />
              Call Staff Assistance
            </h2>
            <p className="text-[11px] text-stone-500">
              {tableLabel ? formatTableDisplay(tableLabel) : 'Dine-in assistance'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-xs font-bold text-stone-700">What do you need?</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {SERVICE_OPTIONS.map((req) => {
              const Icon = req.icon
              const selected = serviceType === req.id
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setServiceType(req.id)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-all ${
                    selected
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold shadow-xs'
                      : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-amber-400'
                  }`}
                >
                  <Icon className="w-5 h-5 text-amber-600" />
                  <span>{req.label}</span>
                </button>
              )
            })}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-stone-600">Special Note (optional)</label>
            <input
              value={serviceNote}
              onChange={(e) => setServiceNote(e.target.value)}
              placeholder="e.g. Extra glasses, warm water…"
              className="w-full h-9 px-3 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-amber-500"
              maxLength={150}
            />
          </div>

          <button
            type="submit"
            disabled={serviceSending}
            className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-600/20"
          >
            {serviceSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
            Send Staff Request
          </button>
        </form>
      </div>
    </div>
  )
}
