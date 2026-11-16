'use client'

import { useState, useCallback } from 'react'
import {
  Crown,
  ChefHat,
  UtensilsCrossed,
  Phone,
  QrCode,
  Share2,
  Users,
  Sparkles,
  ExternalLink,
  MessageCircle,
  X,
  Check,
  Copy,
  Plus,
  Minus,
} from 'lucide-react'
import {
  loadCart,
  saveCart,
  cartLineKey,
  type CartLine,
} from '@/lib/ordering/cart'

export interface SpecialPartyItem {
  id: string
  name: string
  price: string
  pricePaise: number
  unit: string
  veg: boolean
  highlight: string
}

export const partyPackItems: SpecialPartyItem[] = [
  { id: 'special-motter-pulao', name: 'Motter Pulao', price: '₹500', pricePaise: 50000, unit: '1 kg.', veg: true, highlight: 'Aromatic basmati peas pulao' },
  { id: 'special-meetha-zarda', name: 'Meetha Zarda', price: '₹800', pricePaise: 80000, unit: '1 kg.', veg: true, highlight: 'Royal sweet saffron rice with dry fruits' },
  { id: 'special-chicken-korma', name: 'Chicken Korma', price: '₹600', pricePaise: 60000, unit: '1 kg.', veg: false, highlight: 'Rich Mughlai gravy with tender chicken' },
  { id: 'special-mutton-korma', name: 'Mutton Korma', price: '₹1,200', pricePaise: 120000, unit: '1 kg.', veg: false, highlight: 'Slow-cooked royal mutton gravy' },
  { id: 'special-chicken-stick-kabab', name: 'Chicken Stick Kabab (Boneless)', price: '₹1,200', pricePaise: 120000, unit: '1 kg.', veg: false, highlight: 'Juicy spiced skewered boneless bites' },
  { id: 'special-murg-mussallam', name: 'Murg Mussallam', price: '₹650', pricePaise: 65000, unit: 'pcs.', veg: false, highlight: 'Whole stuffed chicken in royal gravy' },
  { id: 'special-mutton-raan-e-arabian', name: 'Mutton Rane-E-Arabian', price: '₹2,500', pricePaise: 250000, unit: 'pcs.', veg: false, highlight: 'Grand slow-roasted Arabian leg of mutton' },
  { id: 'special-baby-naan', name: 'Baby Naan', price: '₹450', pricePaise: 45000, unit: '1 kg.', veg: true, highlight: 'Soft tandoori baby naans' },
]

export const shanEBiryaniHandis = [
  {
    category: 'CHICKEN BIRYANI HANDI',
    veg: false,
    options: [
      { id: 'special-chicken-biryani-handi-45', serves: '40-45 Person', price: '₹7,500', pricePaise: 750000, perPerson: '~₹165/person' },
      { id: 'special-chicken-biryani-handi-80', serves: '75-80 Person', price: '₹14,000', pricePaise: 1400000, perPerson: '~₹175/person' },
    ],
  },
  {
    category: 'MUTTON BIRYANI HANDI',
    veg: false,
    options: [
      { id: 'special-mutton-biryani-handi-45', serves: '40-45 Person', price: '₹12,500', pricePaise: 1250000, perPerson: '~₹275/person' },
      { id: 'special-mutton-biryani-handi-80', serves: '75-80 Person', price: '₹21,500', pricePaise: 2150000, perPerson: '~₹268/person' },
    ],
  },
]

interface SpecialMenuSectionProps {
  slug: string
  phone?: string | null
  showQrModalDirectly?: boolean
  cart?: CartLine[]
  onAddToCart?: (itemId: string, itemName: string) => void
  onIncrement?: (itemId: string) => void
  onDecrement?: (itemId: string) => void
}

export function SpecialMenuSection({
  slug,
  phone = '77639 49496',
  cart: externalCart,
  onAddToCart: externalAddToCart,
  onIncrement: externalIncrement,
  onDecrement: externalDecrement,
}: SpecialMenuSectionProps) {
  const [internalCart, setInternalCart] = useState<CartLine[]>(() => loadCart(slug))
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeCart = externalCart || internalCart

  const getItemQty = useCallback(
    (itemId: string) => {
      return activeCart.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.quantity, 0)
    },
    [activeCart]
  )

  const handleAdd = (itemId: string, itemName: string) => {
    if (externalAddToCart) {
      externalAddToCart(itemId, itemName)
    } else {
      const key = cartLineKey(itemId, [])
      const found = internalCart.find((l) => l.key === key)
      let next: CartLine[]
      if (found) {
        next = internalCart.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l))
      } else {
        next = [...internalCart, { key, itemId, quantity: 1, selections: [] }]
      }
      setInternalCart(next)
      saveCart(slug, next)
    }
  }

  const handleInc = (itemId: string) => {
    if (externalIncrement) {
      externalIncrement(itemId)
    } else {
      const key = cartLineKey(itemId, [])
      const next = internalCart.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l))
      setInternalCart(next)
      saveCart(slug, next)
    }
  }

  const handleDec = (itemId: string) => {
    if (externalDecrement) {
      externalDecrement(itemId)
    } else {
      const key = cartLineKey(itemId, [])
      const next = internalCart
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
      setInternalCart(next)
      saveCart(slug, next)
    }
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/order/${slug}/special-menu`
    : `https://biryanibadshah.com/order/${slug}/special-menu`

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Biryani Badshah — Mehman Nawazi & Shan-E-Biryani',
        text: 'Check out the Party Packs and Grand Handi Biryani from Biryani Badshah!',
        url: shareUrl,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(shareUrl).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const cleanPhone = (phone || '7763949496').replace(/\D/g, '')

  return (
    <section className="space-y-4 animate-in fade-in duration-300">
      {/* Royal Banner Header */}
      <div className="relative p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white overflow-hidden shadow-lg border border-emerald-700/50">
        <div className="absolute right-0 top-0 bottom-0 w-44 bg-[url('/logo.png')] bg-contain bg-no-repeat bg-right opacity-10 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-xs">
              <Crown className="w-6 h-6 text-yellow-300 fill-yellow-400/30" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-black text-lg sm:text-xl tracking-wider uppercase text-white">
                  MEHMAN NAWAZI
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-stone-950 shadow-xs uppercase">
                  Party Pack
                </span>
              </div>
              <p className="font-script text-xs sm:text-sm text-emerald-200">
                A Family Restaurant • Grand Royal Feasts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Open Special Menu QR Code"
            >
              <QrCode className="w-4 h-4 text-amber-300" />
              <span>Special Menu QR</span>
            </button>
            <a
              href={`tel:${cleanPhone}`}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call to Order</span>
            </a>
          </div>
        </div>

        <p className="relative z-10 text-[11px] sm:text-xs text-emerald-100/90 mt-2 leading-relaxed">
          Hosting a party, wedding, or family reunion? Order our royal bulk dishes by the kilogram and full Handi Biryanis for 40 to 80+ guests!
        </p>
      </div>

      {/* Grid: 1. Mehman Nawazi Party Pack Items */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-black text-sm text-stone-900 flex items-center gap-1.5 uppercase tracking-wide">
            <ChefHat className="w-4 h-4 text-emerald-700" />
            <span>Mehman Nawazi Party Pack</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Order by Kg / Piece
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {partyPackItems.map((item) => {
            const qty = getItemQty(item.id)

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl bg-white border transition-all shadow-xs flex items-center justify-between gap-3 ${
                  qty > 0
                    ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
                    : 'border-stone-200/90 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-3.5 h-3.5 rounded-xs border-2 flex items-center justify-center shrink-0 ${
                      item.veg ? 'border-emerald-600' : 'border-rose-600'
                    }`}
                    title={item.veg ? 'Pure Veg' : 'Non-Veg'}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.veg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm text-stone-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-stone-500 font-medium">
                      {item.unit} • {item.highlight}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-heading font-black text-sm text-emerald-800">
                    {item.price}
                  </span>

                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleAdd(item.id, item.name)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center rounded-xl border border-emerald-300 bg-white p-0.5 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleDec(item.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer active:scale-95"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-heading font-black text-xs text-stone-900">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInc(item.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer active:scale-95"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grid: 2. Shan-E-Biryani Handi Section */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-black text-sm text-stone-900 flex items-center gap-1.5 uppercase tracking-wide">
            <UtensilsCrossed className="w-4 h-4 text-rose-600" />
            <span>Shan-E-Biryani (Bulk Handis)</span>
          </h3>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            For 40 - 80 Persons
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shanEBiryaniHandis.map((handi, hIdx) => (
            <div
              key={hIdx}
              className="p-4 rounded-2xl bg-gradient-to-br from-white to-stone-50 border border-stone-200/90 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <span className="font-heading font-black text-xs sm:text-sm text-stone-900 tracking-wide">
                  {handi.category}
                </span>
                <span className="w-3.5 h-3.5 rounded-xs border-2 border-rose-600 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                </span>
              </div>

              <div className="space-y-2">
                {handi.options.map((opt, oIdx) => {
                  const optQty = getItemQty(opt.id)

                  return (
                    <div
                      key={oIdx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        optQty > 0
                          ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
                          : 'border-stone-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-xs text-stone-800">{opt.serves}</p>
                          <p className="text-[10px] text-stone-400 font-medium">{opt.perPerson}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-heading font-black text-sm text-emerald-800">
                          {opt.price}
                        </span>

                        {optQty === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleAdd(opt.id, `${handi.category} (${opt.serves})`)}
                            className="px-2.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center rounded-xl border border-emerald-300 bg-white p-0.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => handleDec(opt.id)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer active:scale-95"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-heading font-black text-xs text-stone-900">
                              {optQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleInc(opt.id)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer active:scale-95"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inquiry & Action Bar */}
      <div className="p-3.5 rounded-2xl bg-white border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
          <p className="text-xs text-stone-600">
            Advance booking recommended for bulk Handi orders &amp; party packs.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
              'Hello Biryani Badshah! I would like to inquire about your Mehman Nawazi Party Pack and Shan-E-Biryani Handi.'
            )}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp Inquiry</span>
          </a>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
            title="Share Special Menu"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Dedicated Special Menu QR Modal */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setQrModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-stone-200 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500 fill-amber-400" />
                <h3 className="font-heading font-black text-base text-stone-900 uppercase tracking-wide">
                  Special Menu QR
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-emerald-200 flex flex-col items-center mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/business/qr?slug=${encodeURIComponent(slug)}&type=special&format=png`}
                alt="Special Menu QR"
                className="w-48 h-48 object-contain"
              />
              <p className="font-onstage font-bruce font-black text-xs text-stone-700 mt-2">
                BIRYANI BADSHAH
              </p>
              <p className="font-script text-[11px] text-emerald-700">
                A Family Restaurant
              </p>
            </div>

            <p className="text-xs text-stone-500">
              Scan with any phone camera or Google Lens to view Party Packs &amp; Handi Biryanis.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share QR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SpecialMenuSection
