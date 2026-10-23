'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Gift,
  Loader2,
  Lock,
  LogOut,
  Sparkles,
  Star,
  Clock,
  Wallet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  History,
  ShoppingBag,
  BadgeCheck,
  TrendingDown,
  TrendingUp,
  PartyPopper,
  Crown,
  ChevronRight,
  Copy,
  UtensilsCrossed,
} from 'lucide-react'
import { formatPaise, formatTableDisplay } from '@/lib/ordering/rules.mjs'

// Badshah VIP Club Portal — Integrated with Menu & Ordering
export default function LoyaltyHubPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = params?.slug || ''
  const tableParam = searchParams.get('table') || ''
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<{ customerId: string; name: string; phone: string; tier?: string } | null>(null)
  const [snapshot, setSnapshot] = useState<{ availablePoints: number; earnedTotal: number; redeemedTotal: number } | null>(null)
  const [orders, setOrders] = useState<Array<{
    id: string
    orderNumber: string
    totalPaise: number
    fulfilment: string
    createdAt: string
    tableLabel?: string | null
    loyaltyPointsEarned?: number
    items: Array<{ itemName: string; quantity: number; pricePaise?: number }>
  }>>([])
  const [rewards, setRewards] = useState<Array<{ id: string; name: string; description?: string; pointsCost: number; discountPaise: number }>>([])
  const [historyTab, setHistoryTab] = useState<'all' | 'earned' | 'redeemed'>('all')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  const menuHref = useMemo(() => {
    const q = new URLSearchParams()
    if (tableParam) q.set('table', tableParam)
    if (token) q.set('token', token)
    const qs = q.toString()
    return `/order/${slug}/menu${qs ? `?${qs}` : ''}`
  }, [slug, tableParam, token])

  const formatDisplayPhone = (rawPhone?: string | null) => {
    if (!rawPhone) return ''
    const digits = rawPhone.replace(/\D/g, '').replace(/^91/, '').slice(-10)
    if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
    return rawPhone.startsWith('+') ? rawPhone : `+91 ${rawPhone}`
  }

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/public/loyalty/auth', { cache: 'no-store' })
      if (!res.ok) {
        setCustomer(null)
        setSnapshot(null)
        setOrders([])
        setLoading(false)
        return
      }
      const data = await res.json().catch(() => null)
      if (data?.customer) {
        setCustomer({
          customerId: data.customer.customerId,
          name: data.customer.name,
          phone: data.customer.phone || data.customer.customerId,
          tier: data.customer.tier || 'Royal Gold',
        })
        setSnapshot(data.snapshot || { availablePoints: 0, earnedTotal: 0, redeemedTotal: 0 })
        if (Array.isArray(data.orders)) setOrders(data.orders)
      }
    } catch {}
    setLoading(false)
  }, [])

  const loadRewards = useCallback(async () => {
    try {
      const res = await fetch('/api/public/loyalty/rewards', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (Array.isArray(data.rewards)) setRewards(data.rewards)
    } catch {}
  }, [])

  useEffect(() => {
    checkSession()
    loadRewards()
  }, [checkSession, loadRewards])

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    const cleaned = phone.replace(/\D/g, '').replace(/^91/, '').slice(-10)
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.')
      return
    }
    setAuthLoading(true)
    try {
      const res = await fetch('/api/public/loyalty/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'phone-login', phone: cleaned, name: name.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Authentication failed')
      setCustomer({
        customerId: data.customer.customerId,
        name: data.customer.name,
        phone: data.customer.phone || data.customer.customerId,
        tier: data.customer.tier || 'Royal Gold',
      })
      setSnapshot(data.snapshot)
      if (Array.isArray(data.orders)) setOrders(data.orders)
      try {
        localStorage.setItem('rp_customer_phone', data.customer.customerId)
        if (data.customer.name) localStorage.setItem('rp_customer_name', data.customer.name)
      } catch {}
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleClaimPoints = async () => {
    setClaiming(true)
    setClaimMsg(null)
    try {
      const res = await fetch('/api/public/loyalty/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setClaimMsg('Loyalty points successfully credited!')
        checkSession()
      } else {
        setClaimMsg(data.error || 'Could not claim points. Points accrue on meal delivery.')
      }
    } catch {
      setClaimMsg('Network error claiming points.')
    } finally {
      setClaiming(false)
    }
  }

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
      } catch {}
    } catch {}
    setCustomer(null)
    setSnapshot(null)
    setOrders([])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-20">
      {/* Header with 1-tap back to food order */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <Link
            href={menuHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Open Food Menu</span>
          </Link>
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-600 fill-amber-500/20" />
            <span className="text-sm font-black text-amber-950">Badshah VIP Club</span>
          </div>
          {customer ? (
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-stone-500 hover:text-stone-800"
            >
              Sign Out
            </button>
          ) : (
            <div className="w-12" />
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-5">
        {customer ? (
          <div className="space-y-4">
            {/* Badshah VIP Member Royal Gold Card */}
            <div className="relative p-5 rounded-3xl bg-gradient-to-br from-[#8a0214] via-[#9e0c1f] to-[#6b010f] text-white shadow-xl overflow-hidden border border-amber-400/40">
              <Sparkles className="absolute -right-6 -top-6 w-36 h-36 text-white/10 pointer-events-none" />
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                    Badshah VIP Member • {customer.tier || 'Royal Gold'} Tier
                  </span>
                  <h1 className="text-xl font-black text-white mt-1">{customer.name || 'Honored Guest'}</h1>
                  <p className="text-xs text-amber-200/90 font-mono mt-0.5 font-bold">
                    {formatDisplayPhone(customer.phone)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-amber-300/80 uppercase block">Available Points</span>
                  <p className="text-3xl font-black text-amber-300 leading-none mt-1">
                    {snapshot?.availablePoints ?? 0}
                  </p>
                </div>
              </div>
              <div className="relative z-10 mt-5 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-amber-100">
                <span>✨ +20 pts on every dine-in meal</span>
                <Link href={menuHref} className="text-xs font-black text-amber-300 hover:underline">
                  Order Food Now →
                </Link>
              </div>
            </div>

            {/* Direct points claim if applicable */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-amber-200 text-xs shadow-xs">
              <div>
                <p className="font-extrabold text-stone-900">Claim Dining Points</p>
                <p className="text-[11px] text-stone-500">Points credit automatically upon meal delivery</p>
              </div>
              <button
                type="button"
                onClick={handleClaimPoints}
                disabled={claiming}
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs disabled:opacity-50"
              >
                {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Claim'}
              </button>
            </div>
            {claimMsg && <p className="text-xs text-center font-bold text-amber-800">{claimMsg}</p>}

            {/* Previous Orders */}
            {orders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-stone-900 uppercase flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-600" />
                    <span>Previous Orders ({orders.length})</span>
                  </h3>
                  <Link href={menuHref} className="text-[11px] font-bold text-amber-700 hover:underline">
                    Reorder on Menu →
                  </Link>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="p-3.5 rounded-2xl bg-white border border-stone-200 text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-stone-900">#{o.orderNumber}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          {o.fulfilment === 'completed' || o.fulfilment === 'served' ? 'Served' : o.fulfilment}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-600 space-y-0.5">
                        {o.items?.map((item: any, idx: number) => (
                          <p key={idx} className="truncate">
                            <strong className="text-stone-900">{item.quantity}x</strong> {item.itemName}
                          </p>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="font-black text-stone-900">{formatPaise(o.totalPaise)}</span>
                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                          +{o.loyaltyPointsEarned || 20} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity History Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-stone-900 uppercase">Rewards &amp; Activity</h3>
                <div className="flex gap-1 text-[11px] font-bold">
                  {(['all', 'earned', 'redeemed'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setHistoryTab(t)}
                      className={`px-2.5 py-1 rounded-lg ${
                        historyTab === t ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rewards.map((r) => (
                  <div key={r.id} className="p-3 rounded-2xl bg-white border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-stone-900">{r.name}</p>
                      <p className="text-[11px] text-stone-500">{r.description || 'Complimentary VIP perk'}</p>
                    </div>
                    <span className="text-[11px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {r.pointsCost} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href={menuHref}
              className="block w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-center text-xs font-black shadow-lg shadow-amber-600/25"
            >
              Return to Menu &amp; Order Food →
            </Link>
          </div>
        ) : (
          /* Sign in view */
          <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xl space-y-4 text-center">
            <Crown className="w-12 h-12 text-amber-600 mx-auto" />
            <h2 className="text-lg font-black text-stone-900">Sign in to Badshah VIP Club</h2>
            <p className="text-xs text-stone-500">
              Enter your mobile number to view points, claim rewards, and earn loyalty points.
            </p>
            {authError && <p className="text-xs text-rose-600 font-bold">{authError}</p>}
            <form onSubmit={handlePhoneSubmit} className="space-y-3 text-left">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-stone-50 border border-stone-200 text-xs font-bold text-stone-900"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Your Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Amanullah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md"
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign In to VIP Account'}
              </button>
            </form>
            <div className="pt-2 border-t border-stone-100">
              <Link href={menuHref} className="text-xs text-amber-800 font-bold hover:underline">
                ← Skip &amp; Go to Food Menu
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
