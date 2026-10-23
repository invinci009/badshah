'use client'

import React from 'react'
import { Leaf, Drumstick, Egg, Plus, Minus, Check } from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'
import { normalizeImageUrl } from '@/lib/ordering/validation'
import type { MenuItem } from './ItemDetailModal'

export interface ItemCardProps {
  item: MenuItem
  onAdd: () => void
  justAdded: boolean
  qtyInCart?: number
  onIncrement?: () => void
  onDecrement?: () => void
}

export function ItemCard({
  item,
  onAdd,
  justAdded,
  qtyInCart = 0,
  onIncrement,
  onDecrement,
}: ItemCardProps) {
  const hasOptions = item.options && item.options.length > 0

  return (
    <div
      className={`p-3.5 rounded-2xl bg-white border flex gap-3 transition-all duration-200 ${
        justAdded
          ? 'border-emerald-400 shadow-md shadow-emerald-500/10'
          : qtyInCart > 0
          ? 'border-amber-300 shadow-sm ring-1 ring-amber-400/30'
          : 'border-stone-200 hover:border-amber-300 hover:shadow-md'
      } ${!item.available ? 'opacity-70' : ''}`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          {/* FSSAI Standard Veg / Non-veg / Egg indicator */}
          {item.veg === 'veg' && (
            <span
              title="Vegetarian"
              className="w-3.5 h-3.5 rounded-xs border-2 border-emerald-600 flex items-center justify-center shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            </span>
          )}
          {item.veg === 'nonveg' && (
            <span
              title="Non-Vegetarian"
              className="w-3.5 h-3.5 rounded-xs border-2 border-rose-700 flex items-center justify-center shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-700" />
            </span>
          )}
          {item.veg === 'egg' && (
            <span
              title="Contains Egg"
              className="w-3.5 h-3.5 rounded-xs border-2 border-amber-600 flex items-center justify-center shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            </span>
          )}
          <h3 className="text-sm font-bold truncate text-stone-900">{item.name}</h3>
        </div>

        {item.description && (
          <p className="text-[11px] text-stone-500 line-clamp-2 leading-snug">{item.description}</p>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          <p className="text-sm font-extrabold text-stone-900">{formatPaise(item.pricePaise)}</p>
          {hasOptions && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              Portions available
            </span>
          )}
        </div>

        {!item.available && (
          <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 shrink-0">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={normalizeImageUrl(item.imageUrl) || item.imageUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-xl object-cover bg-stone-100"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className={`w-20 h-20 rounded-xl border items-center justify-center ${
            item.imageUrl ? 'hidden' : 'flex'
          } ${
            item.veg === 'veg'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-600'
              : item.veg === 'egg'
              ? 'bg-amber-50/70 border-amber-200 text-amber-600'
              : 'bg-rose-50/70 border-rose-200 text-rose-700'
          }`}
        >
          {item.veg === 'veg' ? (
            <Leaf className="w-7 h-7" />
          ) : item.veg === 'egg' ? (
            <Egg className="w-7 h-7" />
          ) : (
            <Drumstick className="w-7 h-7" />
          )}
        </div>

        {!item.available ? (
          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-stone-100 text-stone-400 border border-stone-200">
            Unavailable
          </span>
        ) : qtyInCart > 0 ? (
          <div className="flex items-center rounded-xl bg-amber-600 text-white shadow-sm overflow-hidden p-0.5">
            <button
              type="button"
              onClick={onDecrement}
              className="w-7 h-7 flex items-center justify-center hover:bg-amber-700 active:scale-90 transition-all font-bold text-white text-xs cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center text-xs font-black text-white">{qtyInCart}</span>
            <button
              type="button"
              onClick={hasOptions ? onAdd : onIncrement}
              className="w-7 h-7 flex items-center justify-center hover:bg-amber-700 active:scale-90 transition-all font-bold text-white text-xs cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all active:scale-95 shadow-xs flex items-center gap-1 ${
              justAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" /> Added
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> Add
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
