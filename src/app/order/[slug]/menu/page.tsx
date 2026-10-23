'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  ChevronRight,
  CheckCircle2,
  Gift,
  Crown,
  Clock,
  History,
  User,
  RefreshCw,
} from 'lucide-react'
import { formatPaise, formatTableDisplay } from '@/lib/ordering/rules.mjs'
import { loadCart, saveCart, cartLineKey, getActiveOrderSession, type CartLine, type CartSelection, type ActiveSession } from '@/lib/ordering/cart'
import { normalizeImageUrl } from '@/lib/ordering/validation'
import { ItemDetailModal, type MenuItem, type OptionGroup, type MenuOption } from '@/components/ordering/ItemDetailModal'
import { TableSelectModal } from '@/components/ordering/TableSelectModal'
import { ServiceCallModal } from '@/components/ordering/ServiceCallModal'
import { VipOrdersHubModal, type CustomerPreviousOrder, type LoyaltyRewardItem } from '@/components/ordering/VipOrdersHubModal'
import { ItemCard } from '@/components/ordering/ItemCard'

function formatOrderDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 'Recent order'
    const now = new Date()
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()

    const timeStr = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    if (isToday) return `Today, ${timeStr}`
    if (isYesterday) return `Yesterday, ${timeStr}`
    return (
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      `, ${timeStr}`
    )
  } catch {
    return 'Recent order'
  }
}

function formatDisplayPhone(phone?: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '').replace(/^91/, '').slice(-10)
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone.startsWith('+') ? phone : `+91 ${phone}`
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
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null)
  const [reviewSlug, setReviewSlug] = useState<string>('')
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg' | 'bestsellers'>('all')
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
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)

  // Service Request Modal
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceType, setServiceType] = useState<string>('water')
  const [serviceNote, setServiceNote] = useState<string>('')
  const [serviceSending, setServiceSending] = useState(false)
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<{ customerId: string; name?: string; phone: string } | null>(null)
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null)
  const [previousOrders, setPreviousOrders] = useState<CustomerPreviousOrder[]>([])
  const [vipModalTab, setVipModalTab] = useState<'orders' | 'perks' | 'profile'>('orders')
  const [loyaltyRewards, setLoyaltyRewards] = useState<Array<{
    id: string
    name: string
    description?: string | null
    pointsCost: number
    discountPaise: number
    discountPctBps: number
    type: string
  }>>([])
  const [loyaltyModalOpen, setLoyaltyModalOpen] = useState(false)
  const [loginPhone, setLoginPhone] = useState('')
  const [loginName, setLoginName] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    setActiveSession(getActiveOrderSession(slug))
  }, [slug])

  const refreshLoyaltySummary = useCallback(async (phone?: string) => {
    const targetPhone = phone || loyaltyCustomer?.customerId
    if (!targetPhone) return
    try {
      const q = new URLSearchParams()
      q.set('phone', targetPhone)
      const res = await fetch(`/api/public/loyalty/summary?${q.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data) {
        if (data.snapshot?.availablePoints !== undefined) setLoyaltyPoints(data.snapshot.availablePoints)
        if (Array.isArray(data.orders)) setPreviousOrders(data.orders)
      }
    } catch {}
  }, [loyaltyCustomer?.customerId])

  const handlePhoneLogin = useCallback(async (overridePhone?: string, overrideName?: string) => {
    const raw = (overridePhone || loginPhone).replace(/\D/g, '').replace(/^91/, '').slice(-10)
    if (!/^[6-9]\d{9}$/.test(raw)) {
      setLoginError('Please enter a valid 10-digit Indian mobile number')
      return
    }
    setLoginLoading(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/public/loyalty/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'phone-login', phone: raw, name: (overrideName || loginName).trim() || 'VIP Guest' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to sign in')
      setLoyaltyCustomer({
        customerId: data.customer.customerId,
        name: data.customer.name,
        phone: data.customer.phone || data.customer.customerId,
      })
      if (data.snapshot) setLoyaltyPoints(data.snapshot.availablePoints)
      if (Array.isArray(data.orders)) {
        setPreviousOrders(data.orders)
        if (data.orders.length > 0) {
          setVipModalTab('orders')
        } else {
          setVipModalTab('perks')
        }
      }
      try {
        localStorage.setItem('rp_customer_phone', data.customer.customerId)
        if (data.customer.name) localStorage.setItem('rp_customer_name', data.customer.name)
      } catch {}
      fetch('/api/public/loyalty/rewards')
        .then((r) => r.json())
        .then((d) => setLoyaltyRewards(d.rewards || []))
        .catch(() => {})
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Sign in failed')
    } finally {
      setLoginLoading(false)
    }
  }, [loginPhone, loginName])

  // Integrated Loyalty & VIP state
  useEffect(() => {
    fetch('/api/public/loyalty/auth', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          if (typeof window !== 'undefined') {
            const savedPhone = localStorage.getItem('rp_customer_phone')
            if (!savedPhone && !sessionStorage.getItem('rp_skip_phone')) {
              setLoyaltyModalOpen(true)
            }
          }
          return
        }
        const data = await res.json().catch(() => null)
        if (data?.customer) {
          setLoyaltyCustomer({
            customerId: data.customer.customerId,
            name: data.customer.name,
            phone: data.customer.phone || data.customer.customerId,
          })
          if (data?.snapshot) setLoyaltyPoints(data.snapshot.availablePoints)
          if (Array.isArray(data.orders)) {
            setPreviousOrders(data.orders)
            if (data.orders.length > 0) {
              setVipModalTab('orders')
            }
          }
        } else if (typeof window !== 'undefined') {
          try {
            const savedPhone = localStorage.getItem('rp_customer_phone')
            const savedName = localStorage.getItem('rp_customer_name')
            if (savedPhone && /^[6-9]\d{9}$/.test(savedPhone)) {
              handlePhoneLogin(savedPhone, savedName || undefined)
            } else if (!sessionStorage.getItem('rp_skip_phone')) {
              // First time entering ordering: prompt to enter mobile number first
              setLoyaltyModalOpen(true)
            }
          } catch {
            setLoyaltyModalOpen(true)
          }
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          const savedPhone = localStorage.getItem('rp_customer_phone')
          if (!savedPhone && !sessionStorage.getItem('rp_skip_phone')) {
            setLoyaltyModalOpen(true)
          }
        }
      })

    fetch('/api/public/loyalty/rewards')
      .then((r) => r.json())
      .then((d) => setLoyaltyRewards(d.rewards || []))
      .catch(() => {})
  }, [slug, handlePhoneLogin])

  useEffect(() => {
    if (searchParams.get('vip') === '1') {
      setLoyaltyModalOpen(true)
    }
  }, [searchParams])

  const handleLogout = async () => {
    try {
      await fetch('/api/public/loyalty/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
      try {
        localStorage.removeItem('rp_customer_phone')
        localStorage.removeItem('rp_customer_name')
        sessionStorage.removeItem('rp_skip_phone')
      } catch {}
    } catch {}
    setLoyaltyCustomer(null)
    setLoyaltyPoints(null)
    setPreviousOrders([])
    setLoginPhone('')
    setLoginName('')
    setLoginError(null)
    setVipModalTab('orders')
    setLoyaltyModalOpen(true)
  }

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
        if (data.googleReviewUrl) setGoogleReviewUrl(data.googleReviewUrl)
        if (data.reviewSlug) setReviewSlug(data.reviewSlug)
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

  const handleReorder = (order: CustomerPreviousOrder) => {
    let addedCount = 0
    let nextCart = [...cart]

    for (const oi of order.items) {
      const matched = items.find(
        (m) =>
          (oi.itemId && m.id === oi.itemId) ||
          m.name.toLowerCase().trim() === oi.itemName.toLowerCase().trim()
      )

      if (matched && matched.available) {
        const selections = oi.selections || []
        const key = cartLineKey(matched.id, selections)
        const found = nextCart.find((l) => l.key === key)
        if (found) {
          nextCart = nextCart.map((l) =>
            l.key === key ? { ...l, quantity: Math.min(20, l.quantity + oi.quantity) } : l
          )
        } else {
          nextCart.push({
            key,
            itemId: matched.id,
            quantity: Math.min(20, oi.quantity),
            selections,
          })
        }
        addedCount += oi.quantity
      }
    }

    if (addedCount > 0) {
      updateCart(nextCart)
      setStaffMsg(`Added ${addedCount} dish${addedCount > 1 ? 'es' : ''} from #${order.orderNumber} to your cart!`)
      setTimeout(() => setStaffMsg(null), 3500)
      setLoyaltyModalOpen(false)
    } else {
      setStaffMsg('These items are currently unavailable on today\'s menu.')
      setTimeout(() => setStaffMsg(null), 3000)
    }
  }

  const getItemQtyInCart = (itemId: string): number => {
    return cart.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.quantity, 0)
  }

  const handleQuickIncrement = (item: MenuItem) => {
    if (item.options && item.options.length > 0) {
      openCustomize(item)
    } else {
      addLine(item.id, [])
    }
  }

  const handleQuickDecrement = (itemId: string) => {
    const line = cart.find((l) => l.itemId === itemId)
    if (line) {
      changeQty(line.key, -1)
    }
  }

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
    if (
      search.trim() &&
      !i.name.toLowerCase().includes(search.toLowerCase()) &&
      !(i.description || '').toLowerCase().includes(search.toLowerCase())
    )
      return false
    if (dietFilter === 'veg' && i.veg !== 'veg') return false
    if (dietFilter === 'nonveg' && i.veg !== 'nonveg' && i.veg !== 'egg') return false
    if (dietFilter === 'bestsellers' && !i.featured) return false
    return true
  })
  const featured =
    search.trim() || activeCat !== 'all' || dietFilter !== 'all'
      ? []
      : items.filter((i) => i.featured)

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
        <div className="flex items-center gap-2.5 max-w-2xl mx-auto">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-amber-300 shadow-xs shrink-0 bg-slate-900 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={restaurantName || 'Biryani Badshah'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-base truncate flex items-center gap-1.5 text-stone-900 leading-tight">
              <span>{restaurantName || 'Biryani Badshah'}</span>
            </h1>
            {token ? (
              <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                {formatTableDisplay(tableLabel)} • Dine-in Ordering
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setTableModalOpen(true)}
                className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 text-[11px] font-bold text-amber-950 cursor-pointer transition-all shadow-xs active:scale-95"
              >
                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                <span>{tableLabel ? formatTableDisplay(tableLabel) : 'Choose Table'}</span>
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
            onClick={() => setLoyaltyModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/20 text-amber-900 border border-amber-300 hover:border-amber-400 hover:bg-amber-500/25 transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            aria-label="Loyalty and rewards"
            title="Badshah VIP Points & Rewards"
          >
            <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500/30 shrink-0" />
            {loyaltyPoints === null ? (
              <span className="text-[11px] font-black tracking-tight text-amber-900">VIP Club</span>
            ) : (
              <span className="text-[11px] font-black text-amber-950 flex items-center gap-0.5">
                <span>{loyaltyPoints}</span>
                <span className="text-[9px] font-bold text-amber-700 uppercase">pts</span>
              </span>
            )}
          </button>
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

        {/* Dietary Quick-Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-2xl mx-auto no-scrollbar scrollbar-hide py-1">
          <button
            type="button"
            onClick={() => setDietFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
              dietFilter === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
            }`}
          >
            <span>All Dishes</span>
          </button>
          <button
            type="button"
            onClick={() => setDietFilter('veg')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 ${
              dietFilter === 'veg'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-xs border border-current flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
            </span>
            <span>Pure Veg 🌱</span>
          </button>
          <button
            type="button"
            onClick={() => setDietFilter('nonveg')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 ${
              dietFilter === 'nonveg'
                ? 'bg-rose-800 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-xs border border-current flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
            </span>
            <span>Non-Veg 🍗</span>
          </button>
          <button
            type="button"
            onClick={() => setDietFilter('bestsellers')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
              dietFilter === 'bestsellers'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
            <span>Chef&apos;s Specials</span>
          </button>
        </div>

        {/* Integrated VIP Rewards & Member Perks Strip */}
        <div className="pt-1 pb-0.5 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => {
              if (loyaltyCustomer) {
                setVipModalTab(previousOrders.length > 0 ? 'orders' : 'perks')
                refreshLoyaltySummary()
              }
              setLoyaltyModalOpen(true)
            }}
            className="w-full text-left p-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-yellow-500/15 border border-amber-300 hover:border-amber-400 hover:bg-amber-500/20 transition-all flex items-center justify-between gap-2.5 shadow-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Crown className="w-4 h-4 fill-white/30" />
              </div>
              <div className="min-w-0 text-xs">
                {loyaltyCustomer ? (
                  <p className="font-extrabold text-amber-950 truncate flex items-center gap-1.5">
                    <span>VIP Member: {formatDisplayPhone(loyaltyCustomer.phone)}</span>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200/90 text-amber-900 font-black">
                      {loyaltyPoints ?? 0} pts
                    </span>
                  </p>
                ) : (
                  <p className="font-black text-amber-950 truncate flex items-center gap-1.5">
                    <span>Badshah VIP Club • Enter Mobile</span>
                  </p>
                )}
                <p className="text-[10px] text-amber-800/90 truncate">
                  {loyaltyCustomer
                    ? `${previousOrders.length > 0 ? `${previousOrders.length} previous order${previousOrders.length > 1 ? 's' : ''} • ` : ''}Rewards & discounts apply at checkout • Tap to view`
                    : 'Enter mobile number to view previous orders, points & earn member perks'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-black text-amber-950 shrink-0 bg-white/90 border border-amber-300 px-2.5 py-1 rounded-xl group-hover:bg-amber-100 transition-colors shadow-xs">
              <span>{loyaltyCustomer ? 'My Perks & Orders' : 'Enter Mobile'}</span>
              <Sparkles className="w-3 h-3 text-amber-600 fill-amber-400" />
            </div>
          </button>
        </div>

        {/* Category Pills */}
        <div className="-mx-3 -mb-2.5 px-3 py-2.5 bg-gradient-to-r from-[#8b0213] via-[#a50215] to-[#800511] shadow-inner">
          <div className="flex gap-2 overflow-x-auto max-w-2xl mx-auto no-scrollbar scrollbar-hide py-0.5">
            <button
              type="button"
              onClick={() => setActiveCat('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
                activeCat === 'all'
                  ? 'bg-white text-[#7f1d1d] shadow-sm font-extrabold'
                  : 'bg-transparent text-white border border-white/85 hover:bg-white/10'
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
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
                    activeCat === c.id
                      ? 'bg-white text-[#7f1d1d] shadow-sm font-extrabold'
                      : 'bg-transparent text-white border border-white/85 hover:bg-white/10'
                  }`}
                >
                  {c.name} {count > 0 ? `(${count})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Staff Toast Message */}
      {staffMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full bg-stone-900 text-white text-xs font-bold shadow-2xl border border-stone-700 animate-in fade-in slide-in-from-top-3 duration-200 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-amber-400" />
          <span>{staffMsg}</span>
        </div>
      )}

      {/* Main Content Layout (Responsive Dual-Pane for Desktop) */}
      <div className="max-w-6xl mx-auto px-3 py-4 lg:grid lg:grid-cols-12 lg:gap-8 items-start">
        <main className="lg:col-span-8 space-y-5">
          {/* Active Dining Session Banner if customer already placed an order */}
          {activeSession && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-300 text-left space-y-1.5 shadow-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Active Dine-in Order at {formatTableDisplay(activeSession.tableLabel)}</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                  Cooking
                </span>
              </div>
              <p className="text-[11px] text-emerald-900/80">
                Your order has been sent to the kitchen. You can track live status or add more dishes below.
              </p>
              <div className="pt-0.5">
                <Link
                  href={`/order/${slug}/confirmation/${activeSession.orderId}?accessToken=${encodeURIComponent(
                    activeSession.accessToken || ''
                  )}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
                >
                  <span>Track Live Order &amp; Kitchen Status →</span>
                </Link>
              </div>
            </div>
          )}

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
                    qtyInCart={getItemQtyInCart(item.id)}
                    onIncrement={() => handleQuickIncrement(item)}
                    onDecrement={() => handleQuickDecrement(item.id)}
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
                    setDietFilter('all')
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
                  qtyInCart={getItemQtyInCart(item.id)}
                  onIncrement={() => handleQuickIncrement(item)}
                  onDecrement={() => handleQuickDecrement(item.id)}
                />
              ))}
            </div>
          </section>

          {/* Subtle Guest Feedback / Google Review Card */}
          <div className="pt-2 pb-6">
            <a
              href={googleReviewUrl || (reviewSlug ? `/r/${reviewSlug}` : `/r/${slug}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3.5 rounded-2xl bg-white border border-stone-200/90 hover:border-amber-300 text-stone-800 transition-all shadow-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-stone-900">Enjoying your dining experience?</p>
                    <p className="text-[11px] text-stone-500">Rate us &amp; share feedback on Google</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400" />
                  ))}
                </div>
              </div>
            </a>
          </div>
        </main>

        {/* Desktop Sticky Dining Folio & Cart Tray (Visible on large screens) */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h2 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-amber-600" /> Dining Folio
                </h2>
                <p className="text-[11px] text-stone-500">
                  {tableLabel ? `Delivering to ${formatTableDisplay(tableLabel)}` : 'Dine-in Order'}
                </p>
              </div>
              {!token && (
                <button
                  type="button"
                  onClick={() => setTableModalOpen(true)}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                >
                  {tableLabel ? 'Change' : 'Select Table'}
                </button>
              )}
            </div>

            {/* Badshah VIP Status inside desktop folio */}
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-yellow-500/10 border border-amber-300/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-600 fill-amber-400" />
                <span className="font-bold text-amber-950 text-[11px]">
                  {loyaltyCustomer ? `VIP: ${loyaltyPoints ?? 0} pts` : 'Badshah VIP Member'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLoyaltyModalOpen(true)}
                className="text-[10px] font-black text-amber-800 bg-white/90 border border-amber-300 px-2.5 py-0.5 rounded-full hover:bg-amber-100 transition-colors shadow-xs cursor-pointer"
              >
                {loyaltyCustomer ? 'Perks' : 'Join'}
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto text-stone-300" />
                <p className="text-xs font-semibold text-stone-500">Your tray is empty.</p>
                <p className="text-[11px] text-stone-400">Click &ldquo;+ Add&rdquo; on any dish to begin.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
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
                      <div key={line.key} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-stone-900 truncate">{item.name}</p>
                            {line.selections.length > 0 && (
                              <p className="text-[10px] text-stone-500 truncate">
                                {line.selections
                                  .map((s) => item.options.find((g) => g.id === s.groupId)?.choices.find((c) => c.id === s.optionId)?.name)
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-black text-stone-900 shrink-0">{formatPaise(lineTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-stone-200/50">
                          <div className="inline-flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => changeQty(line.key, -1)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-stone-100 text-stone-700 text-xs font-bold cursor-pointer"
                              aria-label="Decrease"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-black text-stone-900">{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(line.key, 1)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-stone-100 text-stone-700 text-xs font-bold cursor-pointer"
                              aria-label="Increase"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <div className="flex justify-between items-center text-xs text-stone-600">
                    <span>Items Subtotal</span>
                    <span className="font-extrabold text-sm text-stone-900">{formatPaise(cartEstimate)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-stone-500">
                    <span>Estimated GST (5%)</span>
                    <span>{formatPaise(Math.round((cartEstimate * 500) / 10000))}</span>
                  </div>

                  <Link
                    href={checkoutHref}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <span>Review &amp; Place Order</span>
                    <span>→</span>
                  </Link>
                </div>
              </>
            )}

            {/* Service Request Button */}
            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setServiceModalOpen(true)}
                className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>Need Water / Napkins / Call Waiter</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Floating Cart Button (Mobile / Tablet < lg) */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/90 to-transparent lg:hidden">
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
                  {tableLabel ? `${formatTableDisplay(tableLabel)} • Dine-in` : 'Dine-in Order'}
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
                {/* Badshah VIP Points Preview Banner */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-yellow-500/10 border border-amber-300/40 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-bold text-amber-950 truncate">
                    <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500/30 shrink-0" />
                    {loyaltyPoints !== null
                      ? `VIP Balance: ${loyaltyPoints} pts available to redeem`
                      : 'Earn Badshah VIP points on this meal'}
                  </span>
                  <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                    +20 pts
                  </span>
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
      <ItemDetailModal
        item={customizing}
        onClose={() => setCustomizing(null)}
        pendingSelections={pendingSel}
        onTogglePending={togglePending}
        isValid={customizing ? pendingValid(customizing) : false}
        currentTotalPaise={currentCustomizingTotal}
        onAddToCart={addLine}
      />

      {/* Table Selection Modal */}
      <TableSelectModal
        isOpen={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        tableLabel={tableLabel}
        availableTables={availableTables}
        activeSession={activeSession}
        onSelectTable={(label, state) => switchTable(label, state)}
      />

      {/* Call Staff / Service Request Modal */}
      <ServiceCallModal
        isOpen={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        tableLabel={tableLabel}
        serviceType={serviceType}
        setServiceType={setServiceType}
        serviceNote={serviceNote}
        setServiceNote={setServiceNote}
        serviceSending={serviceSending}
        onSubmit={submitServiceRequest}
      />

      {/* Badshah VIP & Orders Hub Modal */}
      <VipOrdersHubModal
        isOpen={loyaltyModalOpen}
        onClose={() => setLoyaltyModalOpen(false)}
        loyaltyCustomer={loyaltyCustomer}
        loyaltyPoints={loyaltyPoints}
        previousOrders={previousOrders}
        vipModalTab={vipModalTab}
        setVipModalTab={setVipModalTab}
        loyaltyRewards={loyaltyRewards}
        loginPhone={loginPhone}
        setLoginPhone={setLoginPhone}
        loginName={loginName}
        setLoginName={setLoginName}
        loginLoading={loginLoading}
        loginError={loginError}
        handlePhoneLogin={handlePhoneLogin}
        handleLogout={handleLogout}
        handleReorder={handleReorder}
        formatDisplayPhone={formatDisplayPhone}
        formatOrderDate={formatOrderDate}
      />
    </div>
  )
}
