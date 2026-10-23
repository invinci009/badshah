'use client'

import React from 'react'
import { X } from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'

export interface MenuOption {
  id: string
  name: string
  pricePaise: number
}

export interface OptionGroup {
  id: string
  name: string
  type: 'single' | 'multi'
  required: boolean
  min: number
  max: number
  choices: MenuOption[]
}

export interface MenuItem {
  id: string
  categoryId: string | null
  name: string
  description?: string | null
  imageUrl?: string | null
  pricePaise: number
  available: boolean
  veg: 'veg' | 'nonveg' | 'egg' | 'none' | string
  featured: boolean
  position: number
  options: OptionGroup[]
}

export interface CartSelection {
  groupId: string
  optionId: string
}

export interface ItemDetailModalProps {
  item: MenuItem | null
  onClose: () => void
  pendingSelections: CartSelection[]
  onTogglePending: (group: OptionGroup, optionId: string) => void
  isValid: boolean
  currentTotalPaise: number
  onAddToCart: (itemId: string, selections: CartSelection[]) => void
}

export function ItemDetailModal({
  item,
  onClose,
  pendingSelections,
  onTogglePending,
  isValid,
  currentTotalPaise,
  onAddToCart,
}: ItemDetailModalProps) {
  if (!item) return null

  return (
    <div
      className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <h2 className="font-black text-lg text-stone-900">{item.name}</h2>
            <p className="text-xs text-amber-700 font-bold">{formatPaise(item.pricePaise)} starting</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-100 cursor-pointer transition-colors text-stone-400 hover:text-stone-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {item.options.map((g) => (
          <div key={g.id} className="space-y-2">
            <p className="text-xs font-black text-stone-800 flex items-center gap-1.5">
              <span>{g.name}</span>
              {g.required && <span className="text-rose-500 text-[10px]">*Required</span>}
              <span className="text-stone-400 font-normal text-[11px]">
                ({g.type === 'single' ? 'Pick 1' : `Pick ${g.min}–${g.max}`})
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const active = pendingSelections.some((s) => s.groupId === g.id && s.optionId === c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onTogglePending(g, c.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-all active:scale-95 ${
                      active
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-amber-400'
                    }`}
                  >
                    {c.name}
                    {c.pricePaise > 0 ? ` (+${formatPaise(c.pricePaise)})` : ''}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={!isValid}
          onClick={() => {
            onAddToCart(item.id, pendingSelections)
            onClose()
          }}
          className="w-full h-13 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between px-5 shadow-lg shadow-amber-600/20"
        >
          <span>Add to Tray</span>
          <span className="font-black text-sm">{formatPaise(currentTotalPaise)}</span>
        </button>
      </div>
    </div>
  )
}
