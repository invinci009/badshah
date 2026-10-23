'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertTriangle, CheckCircle2, ChefHat, BellRing, Receipt, Phone, RefreshCw, XCircle, PartyPopper, Sparkles, Gift, Star, ArrowRight, Copy, Check, Crown } from 'lucide-react'
import { formatPaise, formatTableDisplay } from '@/lib/ordering/rules.mjs'

const STATUS_META: Record<string, { label: string; hint: string }> = {
  RECEIVED: { label: 'Order Received', hint: 'Sent to the kitchen. Please wait for confirmation.' },
  ACCEPTED: { label: 'Confirmed', hint: 'The kitchen has accepted your order.' },
  PREPARING: { label: 'Being Prepared', hint: 'Our chefs are preparing your food.' },
  READY: { label: 'Ready', hint: 'Your food is ready — it will be served shortly.' },
  SERVED: { label: 'Served', hint: 'Enjoy your meal! We would love your feedback.' },
  CANCELLED: { label: 'Cancelled', hint: 'This order was cancelled. Please contact the counter.' },
}

interface TrackedOrderItem {
  quantity: number
  itemName: string
  lineTotalPaise: number
  options?: Array<{ optionName: string }>
}

interface TrackedOrder {
  orderId: string
  orderNumber: string
  tableLabel: string | null
  customerName: string
  customerPhoneMasked: string
  items: TrackedOrderItem[]
  subtotalPaise: number
  taxPaise: number
  chargePaise: number
  totalPaise: number
  fulfilment: string
  cancellationReason?: string | null
  paymentStatus: string
  paymentInstructions: string
  restaurantPhone: string | null
  createdAt: string
  // Loyalty context
  loyaltyAwarded?: boolean
  loyaltyPointsEarned?: number
  loyaltyDiscountPaise?: number
  loyaltyRewardName?: string | null
}

function readAccessToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null
  const qs = new URLSearchParams(window.location.search)
  const fromUrl = qs.get('accessToken')
  if (fromUrl) {
    try {
      window.localStorage.setItem(`rp_order_${orderId}`, fromUrl)
    } catch {
      // storage unavailable — token still works for this session
    }
    return fromUrl
  }
  try {
    return window.localStorage.getItem(`rp_order_${orderId}`)
  } catch {
    return null
  }
}

export default function OrderConfirmationPage() {
  const params = useParams<{ slug: string; orderId: string }>()
  const { slug, orderId } = params

  const [mounted, setMounted] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loyaltyLoggedIn, setLoyaltyLoggedIn] = useState(false)
  const [copied, setCopied] = useState(false)
  const etagRef = useRef<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const token = readAccessToken(orderId)
    setAccessToken(token)
    // Check if customer is currently logged in to loyalty
    fetch('/api/public/loyalty/auth', { cache: 'no-store' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.customer?.verified) setLoyaltyLoggedIn(true)
        }
      })
      .catch(() => {})
  }, [orderId])
  const fetchOrder = useCallback(async (silent = false, force = false) => {
    if (!accessToken) return
    if (!silent) setRefreshing(true)
    try {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' }
      if (silent && !force && etagRef.current) headers['If-None-Match'] = etagRef.current

      const res = await fetch(`/api/public/orders/${orderId}?token=${encodeURIComponent(accessToken)}`, { headers })
      if (res.status === 304) {
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not load order')
      }
      const newEtag = res.headers.get('ETag')
      if (newEtag) etagRef.current = newEtag

      const data = await res.json()
      setOrder(data)
      setError(null)
      if (data.fulfilment === 'SERVED' || data.fulfilment === 'CANCELLED') {
        try {
          localStorage.removeItem(`rp_active_order_${slug}`)
        } catch {}
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load order')
    } finally {
      setRefreshing(false)
    }
  }, [accessToken, orderId, slug])

  const handleClaimPoints = async () => {
    if (!order) return
    setClaiming(true)
    setClaimMsg(null)
    try {
      const res = await fetch('/api/public/loyalty/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (res.ok) {
        setClaimMsg({ ok: true, text: data.message || `+${data.awarded} points claimed!` })
        fetchOrder(true, true)
      } else {
        setClaimMsg({ ok: false, text: data.error || 'Could not claim points' })
      }
    } catch {
      setClaimMsg({ ok: false, text: 'Failed to claim points' })
    } finally {
      setClaiming(false)
    }
  }

  // 1. Instant Real-time Server-Sent Events (SSE) Stream
  useEffect(() => {
    if (!accessToken || !orderId) return
    if (order && (order.fulfilment === 'SERVED' || order.fulfilment === 'CANCELLED')) return

    let es: EventSource | null = null
    try {
      es = new EventSource(`/api/public/orders/${orderId}/events?token=${encodeURIComponent(accessToken)}`)
      es.onmessage = (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return
          const payload = JSON.parse(event.data)
          if (payload?.fulfilment) {
            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    fulfilment: payload.fulfilment,
                    paymentStatus: payload.paymentStatus || prev.paymentStatus,
                  }
                : prev
            )
            // Silently sync any additional metadata
            fetchOrder(true, true)
          }
        } catch {}
      }
      es.onerror = () => {
        // Handled gracefully by fallback poller
        if (es) {
          es.close()
          es = null
        }
      }
    } catch {}

    return () => {
      if (es) es.close()
    }
  }, [accessToken, orderId, order?.fulfilment, fetchOrder])

  // 2. Adaptive Fast-Polling Fallback (every 3.5 seconds while active)
  useEffect(() => {
    if (!accessToken) return
    fetchOrder()

    if (order && (order.fulfilment === 'SERVED' || order.fulfilment === 'CANCELLED')) {
      return
    }

    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrder(true)
      }
    }, 3500)

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrder(true, true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [accessToken, fetchOrder, order?.fulfilment])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-3 text-stone-500">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-600" />
          <p className="text-sm font-medium">Loading order…</p>
        </div>
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <p className="text-sm text-stone-600 leading-relaxed">This tracking link needs its access code. Please open it from the device used to order.</p>
          <Link href={`/order/${slug}`} className="text-sm text-amber-700 font-bold underline">Back to ordering</Link>
        </div>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center p-8 rounded-3xl bg-white border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <p className="text-sm text-stone-600">{error}</p>
          <button type="button" onClick={() => fetchOrder()} className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-3 text-stone-500">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-600" />
          <p className="text-sm font-medium">Loading order…</p>
        </div>
      </div>
    )
  }

  const meta = STATUS_META[order.fulfilment] || STATUS_META.RECEIVED
  const steps = ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED']
  const stepIdx = order.fulfilment === 'CANCELLED' ? -1 : steps.indexOf(order.fulfilment)
  const isCancelled = order.fulfilment === 'CANCELLED'
  const isServed = order.fulfilment === 'SERVED'

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-10">
      <main className="max-w-lg mx-auto px-3 py-4 space-y-4">
        {/* Status Card */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center border-2 ${isCancelled ? 'bg-rose-50 border-rose-200 text-rose-600' : isServed ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
            {isCancelled ? <XCircle className="w-10 h-10" /> : isServed ? <PartyPopper className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
          </div>
          <h1 className="text-2xl font-extrabold">{isServed ? 'Enjoy Your Meal!' : isCancelled ? 'Order Cancelled' : 'Order Placed!'}</h1>
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-black tracking-wide text-amber-700">{order.orderNumber}</p>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(order.orderNumber).catch(() => {})
                }
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 cursor-pointer transition-colors"
              title="Copy Order ID"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {copied && <p className="text-[11px] font-bold text-emerald-600 animate-in fade-in">Order ID copied to clipboard!</p>}
          {order.tableLabel && <p className="text-sm font-bold text-stone-600">{formatTableDisplay(order.tableLabel)}</p>}

          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-left ${isCancelled ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            {isCancelled ? <XCircle className="w-5 h-5 text-rose-600 shrink-0" /> : <ChefHat className="w-5 h-5 text-amber-700 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-stone-900">{meta.label} {refreshing && <Loader2 className="inline w-3.5 h-3.5 animate-spin text-amber-600" />}</p>
              <p className="text-xs text-stone-600">{meta.hint}</p>
            </div>
          </div>

          {/* Loyalty: confirmation of points earned / reward applied / claim prompt */}
          {!isCancelled && (
            <div className={`p-4 rounded-2xl text-left space-y-2 border ${
              order.loyaltyAwarded
                ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-amber-50 border-emerald-300 shadow-xs'
                : 'bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-yellow-500/10 border-amber-300/60'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                  order.loyaltyAwarded ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-stone-950'
                }`}>
                  {order.loyaltyAwarded ? <PartyPopper className="w-4 h-4" /> : <Crown className="w-4 h-4 fill-current" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                      Badshah VIP Rewards
                    </p>
                    {order.loyaltyAwarded ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        Credited
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        Reserved
                      </span>
                    )}
                  </div>

                  {/* Reward discount note */}
                  {(order.loyaltyDiscountPaise ?? 0) > 0 && (
                    <p className="text-xs text-emerald-800 font-bold mt-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      {order.loyaltyRewardName ? (
                        <>Reward applied: <b>{order.loyaltyRewardName}</b> (saved {formatPaise(order.loyaltyDiscountPaise!)}).</>
                      ) : (
                        <>VIP Reward saved <b>{formatPaise(order.loyaltyDiscountPaise!)}</b> on this bill.</>
                      )}
                    </p>
                  )}

                  {/* Points earned / claim prompt */}
                  {order.loyaltyAwarded ? (
                    <div className="mt-1 space-y-1.5">
                      <p className="text-xs text-emerald-800 font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        +{order.loyaltyPointsEarned} VIP points added to your loyalty balance!
                      </p>
                      <Link
                        href={`/order/${slug}/menu?vip=1${order.tableLabel ? `&table=${encodeURIComponent(order.tableLabel)}` : ''}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs"
                      >
                        <Crown className="w-3.5 h-3.5" /> View VIP Card &amp; Rewards <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ) : isServed ? (
                    <div className="mt-2 space-y-1.5">
                      {claimMsg && (
                        <p className={`text-xs font-bold ${claimMsg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {claimMsg.text}
                        </p>
                      )}
                      {loyaltyLoggedIn ? (
                        <button
                          type="button"
                          onClick={handleClaimPoints}
                          disabled={claiming}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                          Claim your loyalty points
                        </button>
                      ) : (
                        <Link
                          href={`/order/${slug}/menu?vip=1${order.tableLabel ? `&table=${encodeURIComponent(order.tableLabel)}` : ''}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 underline"
                        >
                          Join or log in to collect your points <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-stone-600">
                        You&apos;ll earn <b className="text-amber-800 font-black">+{order.loyaltyPointsEarned || 20} VIP points</b> automatically once your food is served.{' '}
                        <Link
                          href={`/order/${slug}/menu?vip=1${order.tableLabel ? `&table=${encodeURIComponent(order.tableLabel)}` : ''}`}
                          className="text-amber-700 font-bold hover:underline inline-flex items-center gap-0.5 ml-1"
                        >
                          View rewards club <ArrowRight className="w-3 h-3" />
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isCancelled && order.cancellationReason && (
            <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200 text-left space-y-1 animate-in fade-in duration-200">
              <p className="text-[11px] font-black uppercase tracking-wider text-rose-800">Reason for Cancellation</p>
              <p className="text-xs text-rose-900 font-semibold">{order.cancellationReason}</p>
            </div>
          )}

          {stepIdx >= 0 && (
            <div className="flex items-center justify-between px-1 pt-1" aria-label="Order progress">
              {steps.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="relative">
                    {i === stepIdx && !isServed && (
                      <span className="absolute -inset-1 rounded-full bg-amber-400/35 animate-ping pointer-events-none" />
                    )}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold transition-all duration-300 relative ${
                      i < stepIdx
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : i === stepIdx
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/40 ring-4 ring-amber-400/20 scale-110'
                        : 'bg-stone-200 text-stone-400'
                    }`}>
                      {i < stepIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold capitalize ${i === stepIdx ? 'text-amber-800 font-extrabold' : i < stepIdx ? 'text-stone-700' : 'text-stone-400'}`}>{s.toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => fetchOrder()} className="text-xs text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 cursor-pointer transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh status
          </button>
        </div>

        {/* Guest Feedback & Rating Card */}
        <a
          href={`/r/${slug}?table=${encodeURIComponent(order.tableLabel || '')}`}
          className="block p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-amber-400 text-stone-800 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-stone-900">How is everything tasting?</p>
                <p className="text-[11px] text-stone-500">Tap to rate your experience &amp; earn VIP perks</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
              ))}
            </div>
          </div>
        </a>

        {/* Bill */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-sm font-extrabold flex items-center gap-1.5"><Receipt className="w-4 h-4 text-amber-600" /> Bill Details</h2>
          {order.items.map((it, idx: number) => (
            <div key={idx} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-stone-700">{it.quantity} × {it.itemName}</span>
                <span className="font-bold shrink-0">{formatPaise(it.lineTotalPaise)}</span>
              </div>
              {it.options && it.options.length > 0 && (
                <p className="text-[11px] text-stone-500 pl-2">{it.options.map((o) => o.optionName).join(', ')}</p>
              )}
            </div>
          ))}
          <div className="border-t border-stone-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600"><span>Subtotal</span><span>{formatPaise(order.subtotalPaise)}</span></div>
            <div className="flex justify-between text-stone-600"><span>Tax</span><span>{formatPaise(order.taxPaise)}</span></div>
            {order.chargePaise > 0 && <div className="flex justify-between text-stone-600"><span>Charges</span><span>{formatPaise(order.chargePaise)}</span></div>}
            {(order.loyaltyDiscountPaise ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-600" />
                  {order.loyaltyRewardName ? `Reward: ${order.loyaltyRewardName}` : 'Reward Discount'}
                </span>
                <span>−{formatPaise(order.loyaltyDiscountPaise!)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-lg pt-1"><span>Total</span><span className="text-amber-700">{formatPaise(order.totalPaise)}</span></div>
            <p className="text-[11px] text-stone-500">Payment: {order.paymentStatus === 'PAID' ? 'Paid' : 'Pay at counter'} • {order.paymentInstructions}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <Link
            href={`/order/${slug}/menu?table=${encodeURIComponent(order.tableLabel || '')}`}
            className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <ChefHat className="w-4 h-4" /> Order More Dishes ({order.tableLabel ? formatTableDisplay(order.tableLabel) : 'Dine-in'})
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/r/${slug}?table=${encodeURIComponent(order.tableLabel || '')}`}
              className="h-11 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <BellRing className="w-4 h-4" /> Give Feedback
            </Link>
            {order.restaurantPhone ? (
              <a
                href={`tel:${order.restaurantPhone}`}
                className="h-11 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-4 h-4" /> Call Staff
              </a>
            ) : (
              <Link
                href={`/order/${slug}?table=${encodeURIComponent(order.tableLabel || '')}`}
                className="h-11 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-800 text-xs font-bold flex items-center justify-center transition-colors"
              >
                Restaurant Home
              </Link>
            )}
          </div>
        </div>
        <p className="text-[11px] text-stone-400 text-center">For changes or cancellation, please contact the restaurant counter.</p>
      </main>
    </div>
  )
}
