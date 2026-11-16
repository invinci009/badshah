'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Phone,
  Crown,
  Sparkles,
  Star,
  Users,
  PartyPopper,
  UtensilsCrossed,
  ChefHat,
  Share2,
  QrCode,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  X,
  Check,
  CheckCircle2,
  Copy,
  ChevronRight,
  MapPin,
  ChevronDown,
} from 'lucide-react'
import { formatPaise, formatTableDisplay } from '@/lib/ordering/rules.mjs'
import {
  loadCart,
  saveCart,
  cartLineKey,
  getActiveOrderSession,
  type CartLine,
  type CartSelection,
  type ActiveSession,
} from '@/lib/ordering/cart'

// ============================================================================
// Authoritative Special Menu Catalog (Mehman Nawazi & Shan-E-Biryani)
// Matches physical restaurant card and Firestore seed IDs
// ============================================================================
interface SpecialItemDef {
  id: string
  name: string
  pricePaise: number
  priceFormatted: string
  quantity: string
  veg: boolean
  description: string
}

const PARTY_PACK_ITEMS: SpecialItemDef[] = [
  {
    id: 'special-motter-pulao',
    name: 'Motter Pulao',
    pricePaise: 50000,
    priceFormatted: '₹500',
    quantity: '1 Kg',
    veg: true,
    description: 'Aromatic long-grain basmati rice with tender green peas',
  },
  {
    id: 'special-meetha-zarda',
    name: 'Meetha Zarda',
    pricePaise: 80000,
    priceFormatted: '₹800',
    quantity: '1 Kg',
    veg: true,
    description: 'Traditional royal sweet saffron rice with assorted dry fruits',
  },
  {
    id: 'special-chicken-korma',
    name: 'Chicken Korma',
    pricePaise: 60000,
    priceFormatted: '₹600',
    quantity: '1 Kg',
    veg: false,
    description: 'Rich Mughlai chicken gravy slow-cooked with aromatic spices',
  },
  {
    id: 'special-mutton-korma',
    name: 'Mutton Korma',
    pricePaise: 120000,
    priceFormatted: '₹1,200',
    quantity: '1 Kg',
    veg: false,
    description: 'Tender royal mutton pieces simmered in rich velvety gravy',
  },
  {
    id: 'special-chicken-stick-kabab',
    name: 'Chicken Stick Kabab (Boneless)',
    pricePaise: 120000,
    priceFormatted: '₹1,200',
    quantity: '1 Kg',
    veg: false,
    description: 'Juicy skewered boneless chicken kababs grilled to perfection',
  },
  {
    id: 'special-murg-mussallam',
    name: 'Murg Mussallam',
    pricePaise: 65000,
    priceFormatted: '₹650',
    quantity: 'Per Pcs',
    veg: false,
    description: 'Grand whole stuffed chicken prepared in rich royal Mughlai gravy',
  },
  {
    id: 'special-mutton-raan-e-arabian',
    name: 'Mutton Rane-E-Arabian',
    pricePaise: 250000,
    priceFormatted: '₹2,500',
    quantity: 'Per Pcs',
    veg: false,
    description: 'Whole roasted Arabian spiced leg of mutton for royal feasts',
  },
  {
    id: 'special-baby-naan',
    name: 'Baby Naan',
    pricePaise: 45000,
    priceFormatted: '₹450',
    quantity: '1 Kg',
    veg: true,
    description: 'Soft tandoori baby naans, baked fresh in the clay oven',
  },
]

interface HandiOptionDef {
  id: string
  serves: string
  pricePaise: number
  priceFormatted: string
  perPerson: string
}

interface HandiGroupDef {
  category: string
  veg: boolean
  description: string
  items: HandiOptionDef[]
}

const SHAN_E_BIRYANI_GROUPS: HandiGroupDef[] = [
  {
    category: 'Chicken Biryani Handi',
    veg: false,
    description: 'Authentic royal spiced dum chicken biryani in grand copper handi',
    items: [
      {
        id: 'special-chicken-biryani-handi-45',
        serves: '40-45 Person',
        pricePaise: 750000,
        priceFormatted: '₹7,500',
        perPerson: '~₹165 / person',
      },
      {
        id: 'special-chicken-biryani-handi-80',
        serves: '75-80 Person',
        pricePaise: 1400000,
        priceFormatted: '₹14,000',
        perPerson: '~₹175 / person',
      },
    ],
  },
  {
    category: 'Mutton Biryani Handi',
    veg: false,
    description: 'Signature royal mutton dum biryani cooked in giant traditional handi',
    items: [
      {
        id: 'special-mutton-biryani-handi-45',
        serves: '40-45 Person',
        pricePaise: 1250000,
        priceFormatted: '₹12,500',
        perPerson: '~₹275 / person',
      },
      {
        id: 'special-mutton-biryani-handi-80',
        serves: '75-80 Person',
        pricePaise: 2150000,
        priceFormatted: '₹21,500',
        perPerson: '~₹268 / person',
      },
    ],
  },
]

// Map all special items by ID for quick lookups
const ALL_SPECIAL_ITEMS_MAP = new Map<string, { id: string; name: string; pricePaise: number; veg: boolean; quantity?: string }>()
PARTY_PACK_ITEMS.forEach((i) => ALL_SPECIAL_ITEMS_MAP.set(i.id, { id: i.id, name: i.name, pricePaise: i.pricePaise, veg: i.veg, quantity: i.quantity }))
SHAN_E_BIRYANI_GROUPS.forEach((g) => {
  g.items.forEach((opt) => {
    ALL_SPECIAL_ITEMS_MAP.set(opt.id, {
      id: opt.id,
      name: `${g.category} (${opt.serves})`,
      pricePaise: opt.pricePaise,
      veg: g.veg,
      quantity: opt.serves,
    })
  })
})

export default function SpecialMenuPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const slug = params.slug
  const tableParam = searchParams.get('table') || ''
  const token = searchParams.get('token') || ''

  const [tableLabel, setTableLabel] = useState<string | null>(tableParam || null)
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(slug, tableParam || null))
  const [cartOpen, setCartOpen] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [addedKey, setAddedKey] = useState<string | null>(null)

  // Resolve session table
  useEffect(() => {
    if (!tableLabel && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`rp_table_${slug}`)
        if (stored) {
          setTableLabel(stored)
          setCart(loadCart(slug, stored))
        }
      } catch {}
    }
  }, [slug, tableLabel])

  const updateCart = useCallback(
    (next: CartLine[]) => {
      setCart(next)
      saveCart(slug, next, tableLabel)
    },
    [slug, tableLabel]
  )

  const getItemQty = useCallback(
    (itemId: string) => {
      return cart.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.quantity, 0)
    },
    [cart]
  )

  const handleAddItem = (itemId: string, itemName: string) => {
    const key = cartLineKey(itemId, [])
    const found = cart.find((l) => l.key === key)
    if (found) {
      updateCart(cart.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l)))
    } else {
      updateCart([...cart, { key, itemId, quantity: 1, selections: [] }])
    }
    setAddedKey(key)
    setTimeout(() => setAddedKey(null), 1200)

    setToastMsg(`Added "${itemName}" to tray!`)
    setTimeout(() => setToastMsg(null), 2500)
  }

  const handleChangeQty = (itemId: string, delta: number) => {
    const key = cartLineKey(itemId, [])
    updateCart(
      cart
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  const handleRemoveLine = (key: string) => {
    updateCart(cart.filter((l) => l.key !== key))
  }

  // Cart counts & totals
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0)
  const cartEstimate = cart.reduce((sum, l) => {
    const specialDef = ALL_SPECIAL_ITEMS_MAP.get(l.itemId)
    if (specialDef) {
      return sum + specialDef.pricePaise * l.quantity
    }
    // If cart has regular items, fallback estimate
    return sum + 20000 * l.quantity
  }, 0)

  // Navigation Links
  const backParams = new URLSearchParams()
  if (tableLabel) backParams.set('table', tableLabel)
  if (token) backParams.set('token', token)
  const menuHref = `/order/${slug}/menu${backParams.toString() ? `?${backParams.toString()}` : ''}`

  const checkoutParams = new URLSearchParams()
  if (token) checkoutParams.set('token', token)
  if (tableLabel) checkoutParams.set('table', tableLabel)
  const checkoutHref = `/order/${slug}/checkout${checkoutParams.toString() ? `?${checkoutParams.toString()}` : ''}`

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/order/${slug}/special-menu`
      : `/order/${slug}/special-menu`

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={menuHref}
                className="p-2 -ml-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                title="Back to regular menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-400 shadow-xs bg-white shrink-0 p-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Biryani Badshah"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="font-onstage font-bruce font-black text-base text-stone-900 leading-tight uppercase tracking-wider">
                    BIRYANI BADSHAH
                  </h1>
                  <p className="font-script text-[11px] text-emerald-800 leading-none">
                    A Family Restaurant
                  </p>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                    <span>Mehman Nawazi &amp; Shan-E-Biryani</span>
                    {tableLabel && <span>• Table {tableLabel}</span>}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowQR(!showQR)}
                className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                title="Show QR Code"
              >
                <QrCode className="w-4 h-4" />
              </button>
              <a
                href="tel:7763949496"
                className="p-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
                aria-label="Call restaurant"
                title="Helpline: 77639 49496"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-bold shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* QR Code Section (Collapsible) */}
      {showQR && (
        <div className="max-w-2xl mx-auto px-4 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-lg text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <QrCode className="w-7 h-7 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-stone-900 uppercase tracking-wide">
                Special Menu QR Code
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Scan or share this QR to view and order Mehman Nawazi Party Packs &amp; Handis
              </p>
            </div>
            <div className="mx-auto w-44 h-44 bg-white rounded-2xl border border-emerald-300 shadow-sm flex items-center justify-center p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/business/qr?slug=${slug}&type=special&format=png`}
                alt="Special Menu QR Code"
                className="w-38 h-38 object-contain"
              />
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Biryani Badshah — Special Menu',
                      text: 'Check out the Party Packs and Grand Handi Biryani from Biryani Badshah!',
                      url: shareUrl,
                    }).catch(() => {})
                  } else {
                    navigator.clipboard.writeText(shareUrl).catch(() => {})
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors cursor-pointer shadow-md shadow-emerald-700/20"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share QR</span>
              </button>
              <a
                href={`/api/business/qr?slug=${slug}&type=special&format=png&download=true`}
                download="biryani-badshah-special-menu.png"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer border border-stone-200"
              >
                Save QR
              </a>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {/* Hero Banner */}
        <div className="relative p-5 rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-[url('/logo.png')] bg-center bg-no-repeat bg-contain opacity-[0.06]" />
          <div className="relative z-10 space-y-3 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm">
              <Crown className="w-7 h-7 text-yellow-300 fill-yellow-400/30" />
            </div>
            <h2 className="font-heading font-black text-2xl tracking-tight">
              Mehman Nawazi
            </h2>
            <p className="text-sm text-emerald-100/90 font-medium">
              Royal Party Packs &amp; Grand Catering — crafted for your celebrations
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-emerald-200">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> 40-80+ Guests
              </span>
              <span className="flex items-center gap-1">
                <PartyPopper className="w-3.5 h-3.5" /> Weddings &amp; Events
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================
            SECTION 1: Mehman Nawazi (Party Pack) with + ADD Buttons
            ================================================================ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <ChefHat className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <h2 className="font-heading font-black text-lg text-stone-900">
                  Mehman Nawazi <span className="text-emerald-700">(Party Pack)</span>
                </h2>
                <p className="text-[11px] text-stone-500">Premium dishes prepared by the kilogram</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Order Online
            </span>
          </div>

          <div className="space-y-2.5">
            {PARTY_PACK_ITEMS.map((item) => {
              const qty = getItemQty(item.id)
              const isAdded = addedKey === cartLineKey(item.id, [])

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl bg-white border transition-all shadow-xs flex items-center justify-between gap-3 ${
                    qty > 0
                      ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/20'
                      : 'border-stone-200/90 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
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
                        {item.quantity} • {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-heading font-black text-sm text-emerald-800">
                      {item.priceFormatted}
                    </span>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleAddItem(item.id, item.name)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 ${
                          isAdded
                            ? 'bg-emerald-600 text-white scale-105'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center rounded-xl border border-emerald-300 bg-white p-0.5 shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleChangeQty(item.id, -1)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer active:scale-95"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-heading font-black text-xs text-stone-900">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChangeQty(item.id, 1)}
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
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-stone-200" />
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        {/* ================================================================
            SECTION 2: Shan-E-Biryani (Bulk Handis) with + ADD Buttons
            ================================================================ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 flex items-center justify-center shadow-xs text-white">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-heading font-black text-lg text-stone-900">
                  Shan-E-Biryani
                </h2>
                <p className="text-[11px] text-stone-500">Grand Handi Biryani for 40 to 80+ guests</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
              Bulk Handis
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {SHAN_E_BIRYANI_GROUPS.map((group, gi) => (
              <div
                key={gi}
                className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <h3 className="font-heading font-black text-sm text-stone-900 flex items-center gap-1.5 uppercase">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    {group.category}
                  </h3>
                  <span className="w-3.5 h-3.5 rounded-xs border-2 border-rose-600 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  </span>
                </div>

                <div className="space-y-2.5">
                  {group.items.map((opt) => {
                    const optQty = getItemQty(opt.id)

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                          optQty > 0
                            ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
                            : 'border-stone-200 bg-stone-50/50 hover:border-emerald-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs text-stone-800">
                            <Users className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="font-bold">{opt.serves}</span>
                          </div>
                          <p className="text-[10px] text-stone-400 font-medium pl-5">
                            {opt.perPerson}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-heading font-black text-sm text-emerald-800">
                            {opt.priceFormatted}
                          </span>

                          {optQty === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleAddItem(opt.id, `${group.category} (${opt.serves})`)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          ) : (
                            <div className="inline-flex items-center rounded-xl border border-emerald-300 bg-white p-0.5 shadow-xs">
                              <button
                                type="button"
                                onClick={() => handleChangeQty(opt.id, -1)}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer active:scale-95"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center font-heading font-black text-xs text-stone-900">
                                {optQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleChangeQty(opt.id, 1)}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50 text-emerald-800 text-xs font-black cursor-pointer active:scale-95"
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
            ))}
          </div>
        </section>

        {/* Advance Booking / Call Notice */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-200 text-center space-y-3">
          <h3 className="font-heading font-bold text-base text-emerald-950">
            Need custom catering or specific portions?
          </h3>
          <p className="text-xs text-stone-600">
            Advance notice recommended for bulk Handi Biryanis and large events. You can place your order online above or call our helpline directly.
          </p>
          <a
            href="tel:7763949496"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors shadow-md shadow-emerald-700/20 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            <span>Call Helpline: 77639 49496</span>
          </a>
        </div>

        {/* Back to Regular Menu */}
        <div className="text-center pt-2">
          <Link
            href={menuHref}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Regular Dine-in Menu</span>
          </Link>
        </div>
      </main>

      {/* Floating Tray Button (Appears whenever cart has items) */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/95 to-transparent">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="max-w-2xl mx-auto w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white font-bold shadow-xl shadow-emerald-800/25 flex items-center justify-between px-5 cursor-pointer active:scale-[0.99] transition-transform animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center font-extrabold text-xs">
                {cartCount}
              </span>
              <span className="font-heading font-black tracking-wide text-sm">View Tray</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-heading font-black text-base">{formatPaise(cartEstimate)}</span>
              <span className="text-xs opacity-90">→</span>
            </span>
          </button>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h2 className="font-heading font-black text-lg text-stone-900 uppercase tracking-wide">
                  Your Order Tray
                </h2>
                <p className="text-xs text-emerald-800 font-semibold">
                  {tableLabel ? `${formatTableDisplay(tableLabel)} • Dine-in & Party Order` : 'Dine-in & Party Order'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="p-2 rounded-xl hover:bg-stone-100 cursor-pointer transition-colors text-stone-400 hover:text-stone-700"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cart.length === 0 && (
              <div className="text-center py-10 space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto text-stone-300" />
                <p className="text-sm font-semibold text-stone-500">Your tray is empty.</p>
              </div>
            )}

            <div className="space-y-2.5 divide-y divide-stone-100">
              {cart.map((line) => {
                const specialDef = ALL_SPECIAL_ITEMS_MAP.get(line.itemId)
                const itemName = specialDef ? specialDef.name : line.itemId
                const unitPrice = specialDef ? specialDef.pricePaise : 20000
                const lineTotal = unitPrice * line.quantity

                return (
                  <div key={line.key} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-sm text-stone-900 truncate">{itemName}</p>
                      <p className="font-heading font-black text-xs text-emerald-800 mt-0.5">
                        {formatPaise(lineTotal)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 bg-stone-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleChangeQty(line.itemId, -1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center cursor-pointer hover:bg-stone-50 active:scale-95 transition-all text-stone-700"
                        aria-label="Decrease"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-heading font-black w-6 text-center text-stone-900">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleChangeQty(line.itemId, 1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center cursor-pointer hover:bg-stone-50 active:scale-95 transition-all text-stone-700"
                        aria-label="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.key)}
                        className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center cursor-pointer active:scale-95 transition-all ml-1"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {cart.length > 0 && (
              <div className="pt-3 space-y-2.5 border-t border-stone-100">
                <div className="flex justify-between items-center text-xs text-stone-600">
                  <span>Estimated Subtotal</span>
                  <span className="font-heading font-extrabold text-base text-stone-900">
                    {formatPaise(cartEstimate)}
                  </span>
                </div>

                <Link
                  href={checkoutHref}
                  className="w-full h-13 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold text-center leading-[3.25rem] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25"
                >
                  <span className="font-heading font-black tracking-wide">Proceed to Checkout</span>
                  <span>•</span>
                  <span>{formatPaise(cartEstimate)}</span>
                </Link>
                <p className="text-[10px] text-stone-400 text-center">
                  Taxes (GST 5%) applied at checkout. Pay at counter upon ordering.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
