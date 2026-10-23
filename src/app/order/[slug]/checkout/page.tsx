'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  ShoppingBag,
  MapPin,
  Star,
  Clock,
  Sparkles,
  Gift,
  Crown,
  LogOut,
  ChevronRight,
  User,
  Phone,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react'
import { formatPaise, isValidIndianPhone, formatTableDisplay, maskPhone } from '@/lib/ordering/rules.mjs'
import { loadCart, saveCart, clearCart, getActiveOrderSession, saveActiveOrderSession, type CartLine, type ActiveSession } from '@/lib/ordering/cart'

const QUICK_NOTES = [
  'Less spicy 🌶️',
  'Extra spicy 🔥',
  'Extra raita 🥣',
  'Serve piping hot ♨️',
  'Extra spoons 🥄',
  'No onions 🧅',
]

interface QuoteItem {
  id: string
  name: string
  pricePaise: number
  options: Array<{ id: string; name: string; type: string; required: boolean; min: number; max: number; choices: Array<{ id: string; name: string; pricePaise: number }> }>
}

interface LoyaltySession {
  customerId: string
  name: string
  verified: boolean
  pointsPerOrder: number
  snapshot: { availablePoints: number; earnedTotal: number; redeemedTotal: number; expiredTotal: number; nextExpiry: { points: number; expiresAt: string } | null }
}

interface RewardOption {
  id: string
  name: string
  description: string | null
  type: string
  pointsCost: number
  discountPaise: number
  discountPctBps: number
  discountMaxPaise: number
  minOrderPaise: number
  stock: number | null
  endAt: string | null
  eligibility: string
  redeemable: boolean
}

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = params.slug
  const token = searchParams.get('token') || ''
  const tableParam = searchParams.get('table') || ''

  const [cart, setCart] = useState<CartLine[]>(() => loadCart(slug, tableParam || null))
  const [menu, setMenu] = useState<QuoteItem[]>([])
  const [taxRateBps, setTaxRateBps] = useState(500)
  const [chargePaise, setChargePaise] = useState(0)
  const [tableLabel, setTableLabel] = useState<string | null>(tableParam || null)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [availableTables, setAvailableTables] = useState<Array<{ id: string; label: string; state?: string }>>([])
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [contactPhone, setContactPhone] = useState<string | null>(null)
  const [loyaltySession, setLoyaltySession] = useState<LoyaltySession | null>(null)
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true)
  const [rewardOptions, setRewardOptions] = useState<RewardOption[]>([])
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null)
  const [rewardExpanded, setRewardExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('rp_customer_name') || ''
    } catch {
      return ''
    }
  })
  const [phone, setPhone] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('rp_customer_phone') || ''
    } catch {
      return ''
    }
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [priceConflict, setPriceConflict] = useState<{ quote: { totalPaise: number } } | null>(null)

  const updateLineQty = (lineKey: string, delta: number) => {
    setCart((prev) => {
      const updated = prev
        .map((l) => (l.key === lineKey ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
      saveCart(slug, updated, tableLabel)
      return updated
    })
  }

  const loginCustomer = useCallback(async (targetPhone?: string, targetName?: string): Promise<boolean> => {
    const p = (targetPhone || phone).trim()
    const n = (targetName || name).trim()
    if (!isValidIndianPhone(p)) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.')
      return false
    }
    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await fetch('/api/public/loyalty/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'phone-login', phone: p, name: n }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate mobile number')
      }
      setLoyaltySession({
        customerId: data.customer.customerId,
        name: data.customer.name || n,
        verified: true,
        pointsPerOrder: data.config?.pointsPerOrder ?? 20,
        snapshot: data.snapshot,
      })
      setLoyaltyEnabled(!!data.config?.enabled)
      setPhone(data.customer.customerId)
      if (data.customer.name) setName(data.customer.name)
      try {
        localStorage.setItem('rp_customer_phone', data.customer.customerId)
        if (data.customer.name) localStorage.setItem('rp_customer_name', data.customer.name)
      } catch {}
      return true
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed')
      return false
    } finally {
      setAuthLoading(false)
    }
  }, [phone, name])

  const logoutCustomer = useCallback(async () => {
    try {
      await fetch('/api/public/loyalty/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
    } catch {}
    setLoyaltySession(null)
    setSelectedRewardId(null)
    setRewardOptions([])
  }, [])

  useEffect(() => {
    setActiveSession(getActiveOrderSession(slug))
  }, [slug])

  useEffect(() => {
    const q = new URLSearchParams()
    q.set('slug', slug)
    if (token) q.set('token', token)
    if (tableParam) q.set('table', tableParam)
    fetch(`/api/public/order-menu?${q.toString()}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Checkout unavailable')
        setMenu(data.items || [])
        setTaxRateBps(data.taxRateBps ?? 500)
        setChargePaise(data.serviceChargePaise ?? 0)
        setAvailableTables(data.tables || [])
        let resolvedTable = data.table?.label || tableParam || null
        if (!resolvedTable && typeof window !== 'undefined') {
          try {
            resolvedTable = sessionStorage.getItem(`rp_table_${slug}`) || null
          } catch {}
        }
        setTableLabel(resolvedTable)
        if (resolvedTable) {
          const tableCart = loadCart(slug, resolvedTable)
          setCart(tableCart)
        }
        setContactPhone(data.contactPhone || null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Checkout unavailable'))
      .finally(() => setLoading(false))

    // Loyalty session + redeemable rewards (mirrors the phone into checkout).
    fetch('/api/public/loyalty/auth', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return
        if (data.customer && data.config) {
          setLoyaltySession({ customerId: data.customer.customerId, name: data.customer.name, verified: true, pointsPerOrder: data.config.pointsPerOrder ?? 20, snapshot: data.snapshot })
          setLoyaltyEnabled(!!data.config.enabled)
          if (data.customer.customerId) {
            setPhone(data.customer.customerId)
            if (data.customer.name) {
              setName(data.customer.name)
            }
          }
        } else if (typeof window !== 'undefined') {
          try {
            const cachedPhone = localStorage.getItem('rp_customer_phone')
            const cachedName = localStorage.getItem('rp_customer_name')
            if (cachedPhone && isValidIndianPhone(cachedPhone)) {
              loginCustomer(cachedPhone, cachedName || undefined)
            }
          } catch {}
        }
      })
      .catch(() => { /* loyalty is optional at checkout */ })
  }, [slug, token, tableParam, loginCustomer])

  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu])

  const preview = useMemo(() => {
    const lines = cart
      .map((l) => {
        const item = menuById.get(l.itemId)
        if (!item) return null
        const optTotal = l.selections.reduce((s, sel) => {
          const g = item.options.find((g) => g.id === sel.groupId)
          return s + (g?.choices.find((c) => c.id === sel.optionId)?.pricePaise || 0)
        }, 0)
        const lineTotal = (item.pricePaise + optTotal) * l.quantity
        return { line: l, item, lineTotal }
      })
      .filter((x): x is { line: CartLine; item: QuoteItem; lineTotal: number } => x !== null)
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
    const tax = Math.round((subtotal * taxRateBps) / 10000)
    return { lines, subtotal, tax, charge: chargePaise, total: subtotal + tax + chargePaise }
  }, [cart, menuById, taxRateBps, chargePaise])

  // Refresh reward eligibility when the loyalty session or cart subtotal changes.
  useEffect(() => {
    if (!loyaltySession || !loyaltyEnabled) return
    fetch(`/api/public/loyalty/rewards?subtotalPaise=${preview.subtotal}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setRewardOptions(data.rewards || [])
      })
      .catch(() => { /* keep previous list */ })
  }, [loyaltySession?.customerId, loyaltyEnabled, preview.subtotal])

  // Deselect reward if cart changes made it no longer redeemable (e.g. subtotal fell below minOrder)
  useEffect(() => {
    if (selectedRewardId && rewardOptions.length > 0) {
      const cur = rewardOptions.find((r) => r.id === selectedRewardId)
      if (cur && !cur.redeemable) {
        setSelectedRewardId(null)
      }
    }
  }, [rewardOptions, selectedRewardId])

  const phoneValid = isValidIndianPhone(phone)

  const selectedReward = useMemo(
    () => rewardOptions.find((r) => r.id === selectedRewardId && r.redeemable) || null,
    [rewardOptions, selectedRewardId]
  )

  const loyaltyDiscountPaise = useMemo(() => {
    if (!selectedReward) return 0
    if (selectedReward.type === 'FIXED_DISCOUNT' || selectedReward.type === 'FREE_ITEM') {
      return Math.min(selectedReward.discountPaise, preview.subtotal)
    }
    if (selectedReward.type === 'PERCENT_DISCOUNT') {
      const raw = Math.round((preview.subtotal * selectedReward.discountPctBps) / 10000)
      const capped = selectedReward.discountMaxPaise > 0 ? Math.min(raw, selectedReward.discountMaxPaise) : raw
      return Math.min(capped, preview.subtotal)
    }
    return 0
  }, [selectedReward, preview.subtotal])

  const payableTotal = Math.max(0, preview.total - loyaltyDiscountPaise)
  const effectiveName = name.trim() || loyaltySession?.name || 'VIP Guest'
  const canSubmit = (phoneValid || !!loyaltySession) && cart.length > 0 && !submitting && !authLoading

  // Debounced auto-login when a 10-digit mobile number is entered
  useEffect(() => {
    if (loyaltySession || authLoading) return
    const clean = phone.replace(/\D/g, '')
    const normalized = clean.length === 12 && clean.startsWith('91') ? clean.slice(2) : clean.slice(-10)
    if (/^[6-9]\d{9}$/.test(normalized)) {
      const timer = setTimeout(() => {
        loginCustomer(normalized, name)
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [phone, loyaltySession, authLoading, name, loginCustomer])

  const placeOrder = async (confirmUpdatedTotal: boolean) => {
    setSubmitting(true)
    setSubmitError(null)
    setAuthError(null)
    try {
      // Step 1: Ensure customer is authenticated before placing the order
      if (!loyaltySession) {
        const ok = await loginCustomer(phone, effectiveName)
        if (!ok) {
          setSubmitting(false)
          return
        }
      }

      let idemKey = sessionStorage.getItem(`rp_idem_${slug}`)
      if (!idemKey) {
        idemKey = crypto.randomUUID()
        sessionStorage.setItem(`rp_idem_${slug}`, idemKey)
      }

      // Check if this is an add-on order for the diner's active table
      let existingOrderId: string | undefined
      let activeOrderAccessToken: string | undefined
      if (activeSession && activeSession.tableLabel === tableLabel) {
        existingOrderId = activeSession.orderId
        activeOrderAccessToken = activeSession.accessToken
      }

      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          tableToken: token || null,
          tableLabel: tableLabel || undefined,
          customerName: effectiveName,
          customerPhone: (phone.trim() || loyaltySession?.customerId || '').replace(/\D/g, '').slice(-10),
          notes: notes.trim() || undefined,
          idempotencyKey: idemKey,
          clientTotalPaise: payableTotal,
          clientRedeemDiscountPaise: loyaltyDiscountPaise || undefined,
          redeemRewardId: selectedReward?.id || undefined,
          confirmUpdatedTotal,
          existingOrderId,
          activeOrderAccessToken,
          items: cart.map((l) => ({ itemId: l.itemId, quantity: l.quantity, selections: l.selections })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.code === 'PRICE_CHANGED') {
        setPriceConflict({ quote: data.quote })
        setSubmitting(false)
        return
      }
      // Redemption failures: drop the reward selection and surface why.
      if (res.status === 401 || res.status === 403 || (res.status === 409 && data.code && data.code !== 'TABLE_OCCUPIED' && data.code !== 'TABLE_CLEANING')) {
        if (selectedReward?.id) {
          setSelectedRewardId(null)
          setSubmitError(`${data.error || 'Your reward could not be applied'}. Reward removed — you can place your order without it.`)
        } else {
          setSubmitError(data.error || 'Could not place order')
        }
        setSubmitting(false)
        // Refresh rewards list (stock/eligibility may have changed).
        fetch(`/api/public/loyalty/rewards?subtotalPaise=${preview.subtotal}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => {
            if (d.rewards) setRewardOptions(d.rewards)
          })
          .catch(() => {})
        return
      }
      if (res.status === 409 && (data.code === 'TABLE_OCCUPIED' || data.code === 'TABLE_CLEANING')) {
        setSubmitError(data.error || 'This table is currently occupied. Please choose an open table below.')
        setSubmitting(false)
        // Refresh menu/tables to show current open tables
        fetch(`/api/public/order-menu?slug=${encodeURIComponent(slug)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.tables) setAvailableTables(d.tables)
          })
          .catch(() => {})
        return
      }
      if (!res.ok) throw new Error(data.error || 'Could not place order')
      sessionStorage.removeItem(`rp_idem_${slug}`)
      clearCart(slug, tableLabel)

      // Store active table booking in localStorage so this specific customer device is recognized
      saveActiveOrderSession(slug, {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        accessToken: data.accessToken,
        tableLabel: data.tableLabel || tableLabel,
        customerPhone: phone.trim(),
        customerName: name.trim(),
        createdAt: new Date().toISOString(),
      })

      const confirmationParams = new URLSearchParams()
      confirmationParams.set('accessToken', data.accessToken)
      if (token) confirmationParams.set('token', token)
      if (tableLabel) confirmationParams.set('table', tableLabel)
      const track = `/order/${slug}/confirmation/${data.orderId}?${confirmationParams.toString()}`
      try {
        localStorage.setItem(`rp_order_${data.orderId}`, data.accessToken)
        localStorage.setItem('rp_customer_name', name.trim())
        localStorage.setItem('rp_customer_phone', phone.trim())
      } catch { /* ignore */ }
      router.push(track)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not place order')
      setSubmitting(false)
    }
  }

  const menuParams = new URLSearchParams()
  if (token) menuParams.set('token', token)
  if (tableLabel) menuParams.set('table', tableLabel)
  const menuHref = `/order/${slug}/menu${menuParams.toString() ? `?${menuParams.toString()}` : ''}`

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-3 text-stone-500">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-600" />
          <p className="text-sm font-medium">Preparing checkout…</p>
        </div>
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
          <p className="text-sm text-stone-600">{error}</p>
          <Link href={menuHref} className="text-sm text-amber-700 font-bold underline">Back to menu</Link>
        </div>
      </div>
    )
  }
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="font-extrabold text-lg text-stone-900">Your Tray is Empty</h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            {tableLabel ? `Choose delicious Biryani & Mughlai specialties for ${formatTableDisplay(tableLabel)}.` : 'Select your favorite dishes to begin your order.'}
          </p>
          <Link href={menuHref} className="inline-block px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md shadow-amber-600/20 transition-colors">
            Browse Menu
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-10">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 px-3 py-2.5">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Link href={menuHref} className="p-2 rounded-lg hover:bg-stone-100 transition-colors" aria-label="Back to menu">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-extrabold text-base">Checkout{tableLabel ? ` • ${formatTableDisplay(tableLabel)}` : ''}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 space-y-4">
        {/* Order Summary */}
        <section className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-sm font-extrabold flex items-center gap-1.5"><Receipt className="w-4 h-4 text-amber-600" /> Order Summary</h2>
          {preview.lines.map(({ line, item, lineTotal }) => {
            const chosenOptions = line.selections
              .map((s) => item.options.find((g) => g.id === s.groupId)?.choices.find((c) => c.id === s.optionId)?.name)
              .filter(Boolean)
              .join(', ')

            return (
              <div key={line.key} className="space-y-1 py-1 first:pt-0">
                <div className="flex justify-between items-center text-sm gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-stone-900 font-bold truncate">{item.name}</p>
                    {chosenOptions && (
                      <p className="text-[11px] text-stone-500 font-normal truncate">{chosenOptions}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateLineQty(line.key, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-stone-200 text-stone-700 font-black text-xs cursor-pointer active:scale-90 transition-all"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-black text-stone-900">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateLineQty(line.key, 1)}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-stone-200 text-stone-700 font-black text-xs cursor-pointer active:scale-90 transition-all"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-extrabold text-sm shrink-0 text-stone-900 min-w-14 text-right">
                      {formatPaise(lineTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {selectedReward && (selectedReward.type === 'FREE_ITEM' || selectedReward.type === 'CUSTOM') && (
            <div className="py-2.5 px-3 rounded-xl bg-emerald-50/90 border border-emerald-200/90 flex justify-between items-center text-sm shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-emerald-950 truncate flex items-center gap-1.5">
                    <span>1 × {selectedReward.name}</span>
                    <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                      Free Gift
                    </span>
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">VIP Reward Included</p>
                </div>
              </div>
              <span className="font-black text-emerald-700 text-xs shrink-0">FREE</span>
            </div>
          )}
          <div className="border-t border-stone-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600"><span>Subtotal</span><span>{formatPaise(preview.subtotal)}</span></div>
            <div className="flex justify-between text-stone-600"><span>Tax ({(taxRateBps / 100).toFixed(1)}%)</span><span>{formatPaise(preview.tax)}</span></div>
            {preview.charge > 0 && <div className="flex justify-between text-stone-600"><span>Charges</span><span>{formatPaise(preview.charge)}</span></div>}
            {loyaltyDiscountPaise > 0 && (
              <div className="flex justify-between items-center text-emerald-800 font-bold bg-emerald-50/90 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                <span className="flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/30" />
                  <span>VIP Reward: {selectedReward?.name}</span>
                </span>
                <span className="text-xs font-black">−{formatPaise(loyaltyDiscountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline font-extrabold text-lg pt-1">
              <span>Total Payable</span>
              <div className="text-right">
                {loyaltyDiscountPaise > 0 && (
                  <span className="text-xs text-stone-400 line-through mr-2 font-semibold">
                    {formatPaise(preview.total)}
                  </span>
                )}
                <span className="text-amber-700 font-black">{formatPaise(payableTotal)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Price conflict */}
        {priceConflict && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="font-extrabold text-amber-900 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Prices changed</p>
            <p className="text-amber-800">Updated total is {formatPaise(priceConflict.quote.totalPaise)}. Confirm to place the order at the new total.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPriceConflict(null)} className="flex-1 h-10 rounded-xl border border-amber-400 text-amber-900 font-bold text-sm cursor-pointer hover:bg-amber-100 transition-colors">Review</button>
              <button type="button" onClick={() => { setPriceConflict(null); placeOrder(true) }} className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm cursor-pointer transition-colors">Confirm &amp; Order</button>
            </div>
          </div>
        )}

        {/* VIP Customer Identification & Login Gate */}
        {!loyaltySession ? (
          <section className="p-5 rounded-3xl bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 text-white border border-amber-500/40 shadow-xl shadow-amber-950/20 space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Diner Identification
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Zero Password
              </span>
            </div>

            <div>
              <h2 className="text-base font-black text-white">Log in with Mobile Number</h2>
              <p className="text-xs text-stone-300 mt-0.5 leading-relaxed">
                Connect your mobile to earn Badshah VIP points, unlock instant discounts, and place your order.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label htmlFor="co-phone" className="text-xs font-bold text-amber-100 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" /> Mobile Number *
                </label>
                <div className={`flex items-center rounded-xl bg-stone-800/80 border transition-all overflow-hidden ${authLoading ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-amber-500/30 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20'}`}>
                  <span className="px-3.5 text-xs font-extrabold text-amber-300 border-r border-amber-500/30 bg-stone-900/50 h-11 flex items-center">
                    +91
                  </span>
                  <input
                    id="co-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 13))}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="10-digit mobile number"
                    className="w-full h-11 px-3.5 bg-transparent text-white placeholder-stone-400 text-sm focus:outline-none"
                  />
                  {authLoading && (
                    <span className="pr-3 text-amber-400 flex items-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </span>
                  )}
                </div>
                {phone.length > 0 && !phoneValid && (
                  <p className="text-[11px] text-rose-400 font-medium">Enter a valid 10-digit Indian number starting with 6–9.</p>
                )}
                {phoneValid && !authLoading && (
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Auto-logging in with VIP account…
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="co-name" className="text-xs font-bold text-amber-100 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" /> Your Name (optional)
                </label>
                <input
                  id="co-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aman Kumar"
                  maxLength={100}
                  className="w-full h-11 px-3.5 rounded-xl bg-stone-800/80 border border-amber-500/30 text-white placeholder-stone-400 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => loginCustomer()}
                disabled={!phoneValid || authLoading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-600 hover:to-amber-500 text-stone-950 font-black shadow-md shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                {authLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying VIP Account…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> 1-Tap Login &amp; Check Points</>
                )}
              </button>
            </div>
          </section>
        ) : (
          /* VIP Member Status Card */
          <section className="p-5 rounded-3xl bg-gradient-to-br from-[#8a0214] via-[#a31621] to-[#b91c1c] text-white border border-amber-400/40 shadow-xl shadow-red-950/20 space-y-3.5 animate-in fade-in slide-in-from-bottom-3 duration-300 relative overflow-hidden">
            <Sparkles className="absolute -right-3 -top-3 w-28 h-28 text-white/10 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-200 uppercase tracking-widest flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300/40" /> Badshah VIP Member
              </span>
              <button
                type="button"
                onClick={logoutCustomer}
                className="text-[11px] font-bold text-amber-200 hover:text-white underline cursor-pointer flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" /> Switch
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-white truncate">{name || loyaltySession.name || 'VIP Guest'}</h2>
                <p className="text-xs text-amber-200 font-medium mt-0.5">
                  +91 {maskPhone(loyaltySession.customerId)}
                </p>
              </div>
              <div className="text-right px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur border border-white/20 shrink-0">
                <p className="text-[10px] font-bold text-amber-200 uppercase tracking-wider">Available</p>
                <p className="text-xl font-black text-white leading-tight">
                  {loyaltySession.snapshot.availablePoints} <span className="text-xs font-normal text-amber-200">pts</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/15 text-amber-100/90">
              <span className="text-[11px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <b className="text-white">+{loyaltySession.pointsPerOrder} pts</b> guaranteed on this order
              </span>
              <span className="text-[10px] font-bold text-amber-200 bg-black/20 px-2 py-0.5 rounded-full">
                Points credited on order
              </span>
            </div>
          </section>
        )}

        {/* Loyalty Rewards Redemption Drawer (When logged in) */}
        {loyaltyEnabled && loyaltySession && rewardOptions.length > 0 && (
          <section className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-1.5 text-stone-900">
                <Gift className="w-4 h-4 text-amber-600" /> Redeem Reward on This Meal
              </h2>
              {rewardOptions.filter((r) => r.redeemable && loyaltySession.snapshot.availablePoints >= r.pointsCost).length > 0 && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {rewardOptions.filter((r) => r.redeemable && loyaltySession.snapshot.availablePoints >= r.pointsCost).length} unlocked
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {rewardOptions.map((r) => {
                const enough = loyaltySession.snapshot.availablePoints >= r.pointsCost
                const isSelected = selectedRewardId === r.id
                const disabled = !r.redeemable
                const discountEst = r.type === 'FIXED_DISCOUNT' || r.type === 'FREE_ITEM'
                  ? r.discountPaise
                  : Math.round((preview.subtotal * r.discountPctBps) / 10000)

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (!disabled && enough) {
                        setSelectedRewardId(isSelected ? null : r.id)
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      disabled
                        ? 'border-stone-200 bg-stone-50/70 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'border-emerald-500 bg-gradient-to-r from-emerald-50/90 via-amber-50/40 to-emerald-50/90 ring-2 ring-emerald-500/30 shadow-xs'
                        : enough
                        ? 'border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50/30'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black truncate text-stone-900">{r.name}</p>
                          {isSelected && (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-600 text-white flex items-center gap-0.5 shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Applied
                            </span>
                          )}
                        </div>
                        {r.description && <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">{r.description}</p>}
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 border ${
                        isSelected
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : enough && !disabled
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-stone-100 text-stone-400 border-stone-200'
                      }`}>
                        {r.pointsCost} pts
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                      {disabled ? (
                        <p className="text-[10px] font-bold text-stone-400">
                          {r.eligibility === 'OUT_OF_STOCK'
                            ? 'Sold out'
                            : r.eligibility === 'REWARD_EXPIRED'
                            ? 'Expired'
                            : r.eligibility === 'MIN_ORDER'
                            ? `Min. order ${formatPaise(r.minOrderPaise)}`
                            : r.eligibility === 'CUSTOMER_LIMIT'
                            ? 'Already redeemed once'
                            : 'Unavailable'}
                        </p>
                      ) : !enough ? (
                        <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                          <span>Need {r.pointsCost - loyaltySession.snapshot.availablePoints} more pts</span>
                        </p>
                      ) : isSelected ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            Saves {formatPaise(discountEst)} on this order
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRewardId(null)
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-extrabold text-emerald-700">
                            Save {formatPaise(discountEst)} with {r.pointsCost} pts
                          </span>
                          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                            Apply <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedReward && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-300/60 text-[11px] text-stone-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>Using <b>{selectedReward.pointsCost} pts</b> on this meal</span>
                </span>
                <span className="text-emerald-800 font-extrabold">
                  {loyaltySession.snapshot.availablePoints - selectedReward.pointsCost} pts remain
                </span>
              </div>
            )}
          </section>
        )}

        {/* Dining Preferences & Table Selection */}
        <section className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="space-y-2">
            <label htmlFor="co-notes" className="text-xs font-bold text-stone-700">Order Note (optional)</label>
            <textarea
              id="co-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Less spicy, extra raita, no onion…"
              maxLength={280}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none transition-all"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {QUICK_NOTES.map((qn) => (
                <button
                  key={qn}
                  type="button"
                  onClick={() => {
                    setNotes((prev) => {
                      const trimmed = prev.trim()
                      if (!trimmed) return qn
                      if (trimmed.includes(qn)) return prev
                      return `${trimmed}, ${qn}`
                    })
                  }}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200/80 transition-colors cursor-pointer active:scale-95"
                >
                  {qn}
                </button>
              ))}
            </div>
          </div>

          {/* Table selection for main QR orders */}
          {!token && (
            <div className="space-y-2 pt-3 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>Delivering To</span>
                </label>
                {tableLabel && !tablePickerOpen && (
                  <button
                    type="button"
                    onClick={() => setTablePickerOpen(true)}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                  >
                    Change Table
                  </button>
                )}
              </div>

              {tableLabel && !tablePickerOpen ? (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-yellow-500/10 border border-amber-300/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-black shrink-0">
                      <MapPin className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <span>{formatTableDisplay(tableLabel)}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      </p>
                      <p className="text-[10px] text-amber-800">Fresh dishes will be served right to your seat</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTablePickerOpen(true)}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
                  >
                    Switch
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-stone-500">
                      Where are you seated? Select your table for food delivery:
                    </p>
                    {tableLabel && (
                      <button
                        type="button"
                        onClick={() => setTablePickerOpen(false)}
                        className="text-[11px] font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
                      >
                        Done
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-0.5">
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
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed flex items-center gap-1 opacity-60"
                          >
                            <span>{formatTableDisplay(t.label)}</span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-1 py-0.2 rounded">
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
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed flex items-center gap-1 opacity-60"
                          >
                            <span>{formatTableDisplay(t.label)}</span>
                            <span className="text-[10px] font-bold text-stone-500 bg-stone-200 px-1 py-0.2 rounded">
                              Cleaning
                            </span>
                          </button>
                        )
                      }

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTableLabel(t.label)
                            setTablePickerOpen(false)
                            try {
                              sessionStorage.setItem(`rp_table_${slug}`, t.label)
                            } catch {}
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                            isSelected
                              ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                              : isOwnActive
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                              : 'bg-stone-50 text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50'
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
                      onClick={() => {
                        setTableLabel('Counter')
                        setTablePickerOpen(false)
                        try {
                          sessionStorage.setItem(`rp_table_${slug}`, 'Counter')
                        } catch {}
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                        tableLabel === 'Counter'
                          ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                          : 'bg-stone-50 text-stone-800 border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50'
                      }`}
                    >
                      <span>Counter / Takeaway</span>
                      {tableLabel === 'Counter' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {submitError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex gap-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {submitError}
          </div>
        )}

        {/* Loyalty Guarantee Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-yellow-500/10 border border-amber-300/40 flex items-center justify-between text-xs animate-in fade-in duration-300 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <Crown className="w-4 h-4 fill-current" />
            </div>
            <div>
              <p className="font-extrabold text-stone-900 flex items-center gap-1.5">
                Badshah VIP Perk Guaranteed
              </p>
              <p className="text-[11px] text-stone-600">
                Earn <span className="font-bold text-amber-800">+{loyaltySession?.pointsPerOrder ?? 20} VIP points</span> upon meal delivery
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
            Auto-Credit
          </span>
        </div>

        <button
          type="button"
          onClick={() => placeOrder(false)}
          disabled={!canSubmit}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-700 hover:to-amber-600 text-white font-extrabold shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.99] animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Placing order…</>
          ) : !loyaltySession ? (
            <><Crown className="w-5 h-5 text-amber-200" /> Log In &amp; Confirm Order • {formatPaise(payableTotal)}</>
          ) : (
            <><CheckCircle2 className="w-5 h-5" /> Confirm Order • {formatPaise(payableTotal)}</>
          )}
        </button>
        <p className="text-[11px] text-stone-500 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Pay at counter after ordering. {contactPhone ? `Help: ${contactPhone}` : ''}
        </p>
      </main>
    </div>
  )
}
