'use client'

import React from 'react'
import { MapPin, X, CheckCircle2 } from 'lucide-react'
import { formatTableDisplay } from '@/lib/ordering/rules.mjs'
import type { ActiveSession } from '@/lib/ordering/cart'

export interface TableSelectModalProps {
  isOpen: boolean
  onClose: () => void
  tableLabel: string | null
  availableTables: Array<{ id: string; label: string; state?: string }>
  activeSession: ActiveSession | null
  onSelectTable: (label: string, state?: string) => void
}

export function TableSelectModal({
  isOpen,
  onClose,
  tableLabel,
  availableTables,
  activeSession,
  onSelectTable,
}: TableSelectModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-stone-900">Select Your Table</h3>
              <p className="text-[11px] text-stone-500">
                {tableLabel ? `Currently: ${formatTableDisplay(tableLabel)}` : 'Food will be served directly to this table'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
            aria-label="Close table selector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-600">
          Select where you are seated. Booked or sanitizing tables are marked accordingly:
        </p>

        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto py-1">
          {availableTables.map((t) => {
            const isSelected = tableLabel === t.label
            const isOwnActive = activeSession?.tableLabel === t.label
            const isOccupied = t.state === 'occupied' && !isOwnActive
            const isCleaning = t.state === 'cleaning'

            if (isOccupied) {
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled
                  title={`${formatTableDisplay(t.label)} is currently booked by another guest.`}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-60 flex items-center gap-1.5"
                >
                  <span>{formatTableDisplay(t.label)}</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
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
                  title={`${formatTableDisplay(t.label)} is currently being cleaned.`}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-60 flex items-center gap-1.5"
                >
                  <span>{formatTableDisplay(t.label)}</span>
                  <span className="text-[10px] font-bold text-stone-500 bg-stone-200 px-1.5 py-0.5 rounded">
                    Cleaning
                  </span>
                </button>
              )
            }

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTable(t.label, t.state)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
                    : isOwnActive
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                    : 'bg-stone-50 text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/60'
                }`}
              >
                <span>{formatTableDisplay(t.label)}</span>
                {isOwnActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => onSelectTable('Counter')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              tableLabel === 'Counter'
                ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
                : 'bg-stone-50 text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/60'
            }`}
          >
            <span>Counter / Takeaway</span>
            {tableLabel === 'Counter' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-stone-900 text-white font-bold text-xs cursor-pointer hover:bg-stone-800 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
