'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertTriangle, CheckCircle2, ChefHat, BellRing, Receipt, Phone, RefreshCw, XCircle, PartyPopper } from 'lucide-react'
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

  useEffect(() => {
    setMounted(true)
    const token = readAccessToken(orderId)
    setAccessToken(token)
  }, [orderId])

  const fetchOrder = useCallback(async (silent = false) => {
    if (!accessToken) return
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch(`/api/public/orders/${orderId}?token=${encodeURIComponent(accessToken)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load order')
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
  }, [accessToken, orderId])

  useEffect(() => {
    if (!accessToken) return
    const raf = requestAnimationFrame(() => fetchOrder())
    // If order is served or cancelled, final status is reached — stop polling
    if (order && (order.fulfilment === 'SERVED' || order.fulfilment === 'CANCELLED')) {
      return () => cancelAnimationFrame(raf)
    }
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrder(true)
      }
    }, 20000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(t)
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
          <p className="text-3xl font-black tracking-wide text-amber-700">{order.orderNumber}</p>
          {order.tableLabel && <p className="text-sm font-bold text-stone-600">{formatTableDisplay(order.tableLabel)}</p>}

          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-left ${isCancelled ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            {isCancelled ? <XCircle className="w-5 h-5 text-rose-600 shrink-0" /> : <ChefHat className="w-5 h-5 text-amber-700 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-stone-900">{meta.label} {refreshing && <Loader2 className="inline w-3.5 h-3.5 animate-spin text-amber-600" />}</p>
              <p className="text-xs text-stone-600">{meta.hint}</p>
            </div>
          </div>

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
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold transition-all duration-300 ${i < stepIdx ? 'bg-emerald-500 text-white shadow-xs' : i === stepIdx ? 'bg-amber-600 text-white shadow-md shadow-amber-600/40 ring-4 ring-amber-400/20 scale-110' : 'bg-stone-200 text-stone-400'}`}>
                    {i < stepIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
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
