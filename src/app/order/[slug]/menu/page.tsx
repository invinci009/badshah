'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  AlertTriangle,
  Leaf,
  Drumstick,
  Egg,
  Star,
  X,
  BellRing,
  ArrowLeft,
  Phone,
  Check,
  Sparkles,
  UtensilsCrossed,
  Droplets,
  Receipt,
  HandPlatter,
  Brush,
  Loader2,
  MapPin,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'
import { loadCart, saveCart, cartLineKey, type CartLine, type CartSelection } from '@/lib/ordering/cart'

interface MenuOption {
  id: string
  name: string
  pricePaise: number
}

interface OptionGroup {
  id: string
  name: string
  type: 'single' | 'multi'
  required: boolean
  min: number
  max: number
  choices: MenuOption[]
}

interface MenuItem {
  id: string
  categoryId: string | null
  name: string
  description: string | null
  imageUrl: string | null
  pricePaise: number
  available: boolean
  veg: string
  featured: boolean
  position: number
  options: OptionGroup[]
}

export default function OrderMenuPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const slug = params.slug
  const token = searchParams.get('token') || ''
  const tableParam = searchParams.get('table') || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [tableLabel, setTableLabel] = useState<string | null>(tableParam || null)
  const [restaurantName, setRestaurantName] = useState('')
  const [contactPhone, setContactPhone] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(slug, tableParam || null))
  const [cartOpen, setCartOpen] = useState(false)
  const [customizing, setCustomizing] = useState<MenuItem | null>(null)
  const [pendingSel, setPendingSel] = useState<CartSelection[]>([])
  const [staffMsg, setStaffMsg] = useState<string | null>(null)
  const [addedKey, setAddedKey] = useState<string | null>(null)

  // Table Selection for Main QR
  const [availableTables, setAvailableTables] = useState<Array<{ id: string; label: string; state?: string }>>([])
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [activeSession, setActiveSession] = useState<{
    orderId: string
    accessToken?: string
    tableLabel: string
  } | null>(null)

  // Service Request Modal
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceType, setServiceType] = useState<string>('water')
  const [serviceNote, setServiceNote] = useState<string>('')
  const [serviceSending, setServiceSending] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`rp_active_order_${slug}`)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.tableLabel) setActiveSession(parsed)
        }
      } catch {}
    }
  }, [slug])

  useEffect(() => {
    const q = new URLSearchParams()
    q.set('slug', slug)
    if (token) q.set('token', token)
    if (tableParam) q.set('table', tableParam)
    fetch(`/api/public/order-menu?${q.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Menu unavailable')
        setItems(data.items || [])
        setCategories(data.categories || [])
        setAvailableTables(data.tables || [])
        let resolvedTable = data.table?.label || tableParam || null
        if (!resolvedTable && typeof window !== 'undefined') {
          try {
            resolvedTable = sessionStorage.getItem(`rp_table_${slug}`) || null
          } catch {}
        }
        setTableLabel(resolvedTable)
        if (resolvedTable) {
          const tableSpecificCart = loadCart(slug, resolvedTable)
          setCart(tableSpecificCart)
        }
        setRestaurantName(data.restaurantName || '')
        setContactPhone(data.contactPhone || null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Menu unavailable'))
      .finally(() => setLoading(false))
  }, [slug, token, tableParam])

  const switchTable = (label: string, state?: string) => {
    const isOwnActive = activeSession?.tableLabel === label
    if (state === 'occupied' && !isOwnActive) return
    if (state === 'cleaning') return

    setTableLabel(label)
    setTableModalOpen(false)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`rp_table_${slug}`, label)
      } catch {}
    }
    const tableCart = loadCart(slug, label)
    setCart(tableCart)
  }

  const updateCart = (next: CartLine[]) => {
    setCart(next)
    saveCart(slug, next, tableLabel)
  }

  const addLine = (itemId: string, selections: CartSelection[]) => {
    const key = cartLineKey(itemId, selections)
    const found = cart.find((l) => l.key === key)
    if (found) {
      updateCart(cart.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l)))
    } else {
      updateCart([...cart, { key, itemId, quantity: 1, selections }])
    }
    setAddedKey(key)
    setTimeout(() => setAddedKey(null), 1200)
  }

  const changeQty = (key: string, delta: number) => {
    updateCart(
      cart
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  const removeLine = (key: string) => updateCart(cart.filter((l) => l.key !== key))

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0)
  const cartEstimate = cart.reduce((s, l) => {
    const item = itemById.get(l.itemId)
    if (!item) return s
    const opts = l.selections.reduce((sum, sel) => {
      const g = item.options.find((g) => g.id === sel.groupId)
      const c = g?.choices.find((c) => c.id === sel.optionId)
      return sum + (c?.pricePaise || 0)
    }, 0)
    return s + (item.pricePaise + opts) * l.quantity
  }, 0)

  const filtered = items.filter((i) => {
    if (activeCat !== 'all' && (i.categoryId || 'uncategorized') !== activeCat) return false
    if (search.trim() && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const featured = search.trim() || activeCat !== 'all' ? [] : items.filter((i) => i.featured)

  const openCustomize = (item: MenuItem) => {
    if (!item.available) return
    if (!item.options || item.options.length === 0) {
      addLine(item.id, [])
      return
    }
    setCustomizing(item)
    // Pre-select first choice for single-choice required options
    const defaults: CartSelection[] = []
    for (const g of item.options) {
      if (g.type === 'single' && g.required && g.choices.length > 0) {
        defaults.push({ groupId: g.id, optionId: g.choices[0].id })
      }
    }
    setPendingSel(defaults)
  }

  const togglePending = (group: OptionGroup, optionId: string) => {
    if (group.type === 'single') {
      setPendingSel([...pendingSel.filter((s) => s.groupId !== group.id), { groupId: group.id, optionId }])
    } else {
      const has = pendingSel.some((s) => s.groupId === group.id && s.optionId === optionId)
      if (has) {
        setPendingSel(pendingSel.filter((s) => !(s.groupId === group.id && s.optionId === optionId)))
      } else {
        const count = pendingSel.filter((s) => s.groupId === group.id).length
        if (count >= group.max) return
        setPendingSel([...pendingSel, { groupId: group.id, optionId }])
      }
    }
  }

  const pendingValid = (item: MenuItem) => {
    for (const g of item.options) {
      const count = pendingSel.filter((s) => s.groupId === g.id).length
      if (g.required && count === 0) return false
      if (count < g.min || count > g.max) return false
    }
    return true
  }

  const currentCustomizingTotal = useMemo(() => {
    if (!customizing) return 0
    const optsPrice = pendingSel.reduce((sum, s) => {
      const g = customizing.options.find((grp) => grp.id === s.groupId)
      const c = g?.choices.find((ch) => ch.id === s.optionId)
      return sum + (c?.pricePaise || 0)
    }, 0)
    return customizing.pricePaise + optsPrice
  }, [customizing, pendingSel])

  const submitServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setServiceSending(true)
    try {
      const res = await fetch('/api/public/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          tableToken: token || undefined,
          tableLabel: tableLabel || undefined,
          type: serviceType,
          note: serviceNote.trim() || undefined,
        }),
      })
      if (res.ok) {
        setServiceModalOpen(false)
        setServiceNote('')
        setStaffMsg('Staff notified — someone will be with you shortly.')
      } else {
        const d = await res.json().catch(() => ({}))
        setStaffMsg(d.error || 'Could not reach staff. Please call the counter.')
      }
    } catch {
      setStaffMsg('Connection error. Please call the counter.')
    } finally {
      setServiceSending(false)
      setTimeout(() => setStaffMsg(null), 3500)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-28">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <div className="w-9 h-9 rounded-xl bg-stone-200 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 rounded bg-stone-200 animate-pulse" />
              <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
            </div>
          </div>
          <div className="max-w-2xl mx-auto h-10 rounded-xl bg-stone-100 animate-pulse" />
          <div className="flex gap-1.5 max-w-2xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-stone-100 animate-pulse" />
            ))}
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-3 py-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-white border border-stone-200 flex gap-3 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-stone-100" />
                <div className="h-3 w-full rounded bg-stone-50" />
                <div className="h-4 w-20 rounded bg-stone-100" />
              </div>
              <div className="w-20 h-20 rounded-xl bg-stone-100" />
            </div>
          ))}
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-stone-900">Menu Unavailable</h2>
          <p className="text-xs text-stone-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-11 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 cursor-pointer transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

  const checkoutParams = new URLSearchParams()
  if (token) checkoutParams.set('token', token)
  if (tableLabel) checkoutParams.set('table', tableLabel)
  const checkoutHref = `/order/${slug}/checkout${checkoutParams.toString() ? `?${checkoutParams.toString()}` : ''}`

  const backParams = new URLSearchParams()
  if (tableLabel) backParams.set('table', tableLabel)
  if (token) backParams.set('token', token)
  const backHref = `/order/${slug}${backParams.toString() ? `?${backParams.toString()}` : ''}`

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-stone-200 px-3 py-2.5 space-y-2.5 shadow-sm">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Link href={backHref} className="p-2 rounded-xl hover:bg-stone-100 transition-colors" aria-label="Back">
            <ArrowLeft className="w-4 h-4 text-stone-700" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-base truncate flex items-center gap-1.5 text-stone-900">
              <span>{restaurantName || 'Biryani Badshah'}</span>
            </h1>
            {token ? (
              <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                Table {tableLabel} • Dine-in Ordering
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setTableModalOpen(true)}
                className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 text-[11px] font-bold text-amber-950 cursor-pointer transition-all shadow-xs active:scale-95"
              >
                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                <span>{tableLabel ? `Table ${tableLabel}` : 'Choose Table'}</span>
                <ChevronDown className="w-3 h-3 text-amber-700 shrink-0" />
              </button>
            )}
          </div>
          {contactPhone && (
            <a
              href={`tel:${contactPhone}`}
              className="p-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
              aria-label="Call restaurant"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setServiceModalOpen(true)}
            className="p-2 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-300 hover:bg-amber-500/20 transition-colors flex items-center gap-1 cursor-pointer"
            aria-label="Call staff"
            title="Call staff / service request"
          >
            <BellRing className="w-4 h-4" />
            <span className="text-[11px] font-bold hidden sm:inline">Call Staff</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search delicious biryanis, gravies, rolls…"
            className="w-full h-10 pl-9 pr-9 rounded-xl bg-stone-100 border border-stone-200 text-xs focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all text-stone-900 placeholder:text-stone-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto max-w-2xl mx-auto pb-0.5 scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveCat('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeCat === 'all'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Dishes ({items.length})
          </button>
          {categories.map((c) => {
            const count = items.filter((i) => i.categoryId === c.id).length
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  activeCat === c.id
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {c.name} {count > 0 ? `(${count})` : ''}
              </button>
            )
          })}
        </div>
      </header>

      {/* Staff Toast Message */}
      {staffMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full bg-stone-900 text-white text-xs font-bold shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-top-3 duration-200 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-amber-400" />
          <span>{staffMsg}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-3 py-4 space-y-5">
        {featured.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-sm font-extrabold flex items-center gap-1.5 text-stone-900">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" /> Chef&apos;s Specials
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              {featured.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onAdd={() => openCustomize(item)}
                  justAdded={addedKey === cartLineKey(item.id, [])}
                />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-stone-900">
              {search ? `Search Results (${filtered.length})` : 'Menu Catalog'}
            </h2>
          </div>

          {filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-stone-500 bg-white rounded-2xl border border-stone-200 space-y-2">
              <Search className="w-8 h-8 mx-auto text-stone-300" />
              <p className="font-semibold">No dishes match your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setActiveCat('all')
                }}
                className="text-xs text-amber-700 font-bold hover:underline"
              >
                Clear search &amp; show all dishes
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5">
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onAdd={() => openCustomize(item)}
                justAdded={addedKey === cartLineKey(item.id, [])}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/90 to-transparent">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="max-w-2xl mx-auto w-full h-14 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-xl shadow-amber-600/25 flex items-center justify-between px-5 cursor-pointer active:scale-[0.99] transition-transform animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center font-extrabold text-xs">
                {cartCount}
              </span>
              <span>View Tray</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-black text-base">{formatPaise(cartEstimate)}</span>
              <span className="text-xs opacity-90">→</span>
            </span>
          </button>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h2 className="font-black text-lg text-stone-900">Your Tray</h2>
                <p className="text-xs text-amber-700 font-semibold">
                  {tableLabel ? `Table ${tableLabel} • Dine-in` : 'Dine-in Order'}
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
                const item = itemById.get(line.itemId)
                if (!item) return null
                const optTotal = line.selections.reduce((sum, sel) => {
                  const g = item.options.find((grp) => grp.id === sel.groupId)
                  const c = g?.choices.find((ch) => ch.id === sel.optionId)
                  return sum + (c?.pricePaise || 0)
                }, 0)
                const lineTotal = (item.pricePaise + optTotal) * line.quantity

                return (
                  <div key={line.key} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate">{item.name}</p>
                      {line.selections.length > 0 && (
                        <p className="text-[11px] text-stone-500 truncate">
                          {line.selections
                            .map((s) =>
                              item.options.find((g) => g.id === s.groupId)?.choices.find((c) => c.id === s.optionId)?.name
                            )
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                      <p className="text-xs font-black text-amber-700 mt-0.5">{formatPaise(lineTotal)}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 bg-stone-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => changeQty(line.key, -1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center cursor-pointer hover:bg-stone-50 active:scale-95 transition-all text-stone-700"
                        aria-label="Decrease"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-black w-6 text-center text-stone-900">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQty(line.key, 1)}
                        className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center cursor-pointer hover:bg-stone-50 active:scale-95 transition-all text-stone-700"
                        aria-label="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
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
              <div className="pt-2 space-y-2 border-t border-stone-100">
                <div className="flex justify-between items-center text-xs text-stone-600">
                  <span>Estimated Subtotal</span>
                  <span className="font-extrabold text-sm text-stone-900">{formatPaise(cartEstimate)}</span>
                </div>
                <Link
                  href={checkoutHref}
                  className="w-full h-13 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-center leading-[3.25rem] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                >
                  <span>Proceed to Checkout</span>
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

      {/* Customization Modal */}
      {customizing && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => setCustomizing(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h2 className="font-black text-lg text-stone-900">{customizing.name}</h2>
                <p className="text-xs text-amber-700 font-bold">{formatPaise(customizing.pricePaise)} starting</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizing(null)}
                className="p-2 rounded-xl hover:bg-stone-100 cursor-pointer transition-colors text-stone-400 hover:text-stone-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customizing.options.map((g) => (
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
                    const active = pendingSel.some((s) => s.groupId === g.id && s.optionId === c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => togglePending(g, c.id)}
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
              disabled={!pendingValid(customizing)}
              onClick={() => {
                addLine(customizing.id, pendingSel)
                setCustomizing(null)
              }}
              className="w-full h-13 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between px-5 shadow-lg shadow-amber-600/20"
            >
              <span>Add to Tray</span>
              <span className="font-black text-sm">{formatPaise(currentCustomizingTotal)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Selection Modal for Main QR */}
      {tableModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => setTableModalOpen(false)}
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
                  <p className="text-[11px] text-stone-500">Food will be served directly to this table</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTableModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto py-1">
              {availableTables.map((t) => {
                const isSelected = tableLabel === t.label
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTableLabel(t.label)
                      setTableModalOpen(false)
                      try {
                        sessionStorage.setItem(`rp_table_${slug}`, t.label)
                      } catch {}
                      const newCart = loadCart(slug, t.label)
                      setCart(newCart)
                    }}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400'
                        : 'bg-stone-50 text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50'
                    }`}
                  >
                    <span className="text-[10px] text-stone-400 group-hover:text-amber-700">Table</span>
                    <span className="text-sm font-black">{t.label}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  setTableLabel('Counter')
                  setTableModalOpen(false)
                  try {
                    sessionStorage.setItem(`rp_table_${slug}`, 'Counter')
                  } catch {}
                  const newCart = loadCart(slug, 'Counter')
                  setCart(newCart)
                }}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 col-span-3 ${
                  tableLabel === 'Counter'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400'
                    : 'bg-stone-50 text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50'
                }`}
              >
                <span>Counter / Takeaway</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Staff / Service Request Modal */}
      {serviceModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => setServiceModalOpen(false)}
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
                  {tableLabel ? `Table ${tableLabel}` : 'Dine-in assistance'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setServiceModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitServiceRequest} className="space-y-3">
              <p className="text-xs font-bold text-stone-700">What do you need?</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'water', label: 'Drinking Water', icon: Droplets },
                  { id: 'assistance', label: 'Waiter Call', icon: HandPlatter },
                  { id: 'cleaning', label: 'Clean Table', icon: Brush },
                  { id: 'other', label: 'Cutlery / Plates', icon: UtensilsCrossed },
                  { id: 'bill', label: 'Request Bill', icon: Receipt },
                ].map((req) => {
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
      )}

      {/* Table Switcher Modal */}
      {tableModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
          onClick={() => setTableModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-300 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h2 className="font-black text-base text-stone-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  Select Your Table
                </h2>
                <p className="text-[11px] text-stone-500">
                  {tableLabel ? `Currently: Table ${tableLabel}` : 'Choose your seated table'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTableModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Select where you are seated. Booked tables are unavailable for other guests:
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
                      title={`Table ${t.label} is currently booked by another guest.`}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-60 flex items-center gap-1.5"
                    >
                      <span>Table {t.label}</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
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
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-60 flex items-center gap-1.5"
                    >
                      <span>Table {t.label}</span>
                      <span className="text-[10px] font-bold text-stone-500 bg-stone-200 px-1.5 py-0.2 rounded">
                        Cleaning
                      </span>
                    </button>
                  )
                }

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => switchTable(t.label, t.state)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
                        : isOwnActive
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                        : 'bg-stone-50 text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/60'
                    }`}
                  >
                    <span>Table {t.label}</span>
                    {isOwnActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => switchTable('Counter')}
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
              onClick={() => setTableModalOpen(false)}
              className="w-full h-10 rounded-xl bg-stone-900 text-white font-bold text-xs cursor-pointer hover:bg-stone-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, onAdd, justAdded }: { item: MenuItem; onAdd: () => void; justAdded: boolean }) {
  const hasOptions = item.options && item.options.length > 0

  return (
    <div
      className={`p-3.5 rounded-2xl bg-white border flex gap-3 transition-all duration-200 ${
        justAdded
          ? 'border-emerald-400 shadow-md shadow-emerald-500/10'
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

      <div className="flex flex-col items-center gap-1.5 shrink-0">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-20 h-20 rounded-xl object-cover bg-stone-100"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-center text-stone-300">
            {item.veg === 'veg' ? (
              <Leaf className="w-6 h-6 text-emerald-500/50" />
            ) : item.veg === 'egg' ? (
              <Egg className="w-6 h-6 text-amber-500/50" />
            ) : (
              <Drumstick className="w-6 h-6 text-amber-700/50" />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onAdd}
          disabled={!item.available}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-xs ${
            justAdded
              ? 'bg-emerald-600 text-white'
              : item.available
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          {justAdded ? (
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3" /> Added
            </span>
          ) : item.available ? (
            hasOptions ? (
              'Customize'
            ) : (
              'Add'
            )
          ) : (
            'Unavailable'
          )}
        </button>
      </div>
    </div>
  )
}
