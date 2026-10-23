'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChefHat,
  Volume2,
  VolumeX,
  Loader2,
  BellRing,
  Check,
  Droplets,
  HandPlatter,
  Brush,
  UtensilsCrossed,
  Receipt,
} from 'lucide-react'
import { formatTableDisplay } from '@/lib/ordering/rules.mjs'
import { useOrderAnnouncer } from './OrderAnnouncerContext'

const SERVICE_TYPE_META: Record<
  string,
  { label: string; hindiLabel: string; icon: React.ElementType; color: string }
> = {
  water: {
    label: 'Drinking Water',
    hindiLabel: 'पीने का पानी',
    icon: Droplets,
    color: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
  },
  bill: {
    label: 'Request Bill',
    hindiLabel: 'बिल मांगा गया',
    icon: Receipt,
    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  },
  assistance: {
    label: 'Waiter Call',
    hindiLabel: 'वेटर सहायता',
    icon: HandPlatter,
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  },
  cleaning: {
    label: 'Clean Table',
    hindiLabel: 'टेबल सफाई',
    icon: Brush,
    color: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  },
  other: {
    label: 'Cutlery / Plates',
    hindiLabel: 'चम्मच और प्लेट',
    icon: UtensilsCrossed,
    color: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  },
}

interface KOrder {
  id: string
  orderNumber: string
  tableLabel: string | null
  customerName: string
  itemCount: number
  fulfilment: string
  notes?: string
  createdAt: string
  items?: Array<{ quantity: number; itemName: string; options?: Array<{ optionName: string }>; lineTotalPaise?: number }>
}

interface KDetail {
  order: {
    id: string
    orderNumber: string
    tableLabel: string | null
    customerName: string
    fulfilment: string
    notes?: string
    createdAt: string
    items: Array<{ quantity: number; itemName: string; options?: Array<{ optionName: string }>; lineTotalPaise?: number }>
  }
}

interface StaffCall {
  id: string
  tableLabel: string
  type: string
  note?: string
  status: string
  createdAt: string
}

function ageMin(createdAt: string) {
  return Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000))
}

export default function KitchenTab() {
  const { isVoiceEnabled, toggleVoice, activeOrders, refreshActiveOrders } = useOrderAnnouncer()
  const [orders, setOrders] = useState<KOrder[]>([])
  const [details, setDetails] = useState<Map<string, KDetail>>(new Map())
  const detailsRef = useRef<Map<string, KDetail>>(new Map())
  const [requests, setRequests] = useState<StaffCall[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const serviceEtagRef = useRef<string | null>(null)
  const authFailCountRef = useRef(0)

  // 1. Sync active orders and details directly from centralized active orders state
  useEffect(() => {
    if (!activeOrders) return
    const active: KOrder[] = activeOrders
      .filter((o) => ['RECEIVED', 'ACCEPTED', 'PREPARING'].includes(o.fulfilment))
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        tableLabel: o.tableLabel || null,
        customerName: o.customerName || 'Guest',
        itemCount: o.itemCount || (o.items?.reduce((s, i) => s + i.quantity, 0) ?? 0),
        fulfilment: o.fulfilment,
        notes: o.notes,
        createdAt: o.createdAt || new Date().toISOString(),
        items: o.items,
      }))

    setOrders(active)
    setError(null)

    for (const o of active) {
      if (o.items) {
        detailsRef.current.set(o.id, {
          order: {
            id: o.id,
            orderNumber: o.orderNumber,
            items: o.items,
            notes: o.notes,
            customerName: o.customerName,
            tableLabel: o.tableLabel,
            fulfilment: o.fulfilment,
            createdAt: o.createdAt,
          },
        })
      }
    }
    setDetails(new Map(detailsRef.current))
  }, [activeOrders])

  // 2. Poll open service requests (waiter calls) with ETag caching
  const loadServiceRequests = useCallback(async () => {
    try {
      const sHeaders: Record<string, string> = { 'Cache-Control': 'no-cache' }
      if (serviceEtagRef.current) sHeaders['If-None-Match'] = serviceEtagRef.current

      const sRes = await fetch(`/api/business/service-requests?status=OPEN`, {
        headers: sHeaders,
      })
      if (sRes.status === 401) {
        // Protect against accidental logout during temporary network or token transitions
        authFailCountRef.current += 1
        if (authFailCountRef.current >= 12) {
          window.location.href = '/login'
        }
        return
      }
      authFailCountRef.current = 0
      if (sRes.status === 304) {
        return
      }
      if (sRes.ok) {
        const newSEtag = sRes.headers.get('ETag')
        if (newSEtag) serviceEtagRef.current = newSEtag
        const sData = await sRes.json()
        if (Array.isArray(sData)) setRequests(sData)
      }
    } catch {
      // Non-critical background network retry
    }
  }, [])

  useEffect(() => {
    loadServiceRequests()

    // 5-second interval for service requests
    const t = setInterval(loadServiceRequests, 5000)

    // Immediate sync when tab gains visibility, window focus, or network reconnects
    const onVis = () => {
      loadServiceRequests()
      refreshActiveOrders()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    window.addEventListener('online', onVis)

    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
      window.removeEventListener('online', onVis)
    }
  }, [loadServiceRequests, refreshActiveOrders])

  const advance = async (id: string, to: string) => {
    setBusy(id)
    // Instant optimistic update
    setOrders((prev) =>
      prev
        .map((o) => (o.id === id ? { ...o, fulfilment: to } : o))
        .filter((o) => ['RECEIVED', 'ACCEPTED', 'PREPARING'].includes(o.fulfilment))
    )
    try {
      const res = await fetch(`/api/business/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(data.error || 'Failed to update order status')
        await refreshActiveOrders()
        return
      }
      detailsRef.current.delete(id)
      setDetails(new Map(detailsRef.current))
      await refreshActiveOrders()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to update order status')
      await refreshActiveOrders()
    } finally {
      setBusy(null)
    }
  }

  const resolveReq = async (id: string, status: string) => {
    try {
      await fetch('/api/business/service-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      loadServiceRequests()
    } catch {
      alert('Failed to update request')
    }
  }

  const nextFor = (s: string) => (s === 'RECEIVED' ? 'ACCEPTED' : s === 'ACCEPTED' ? 'PREPARING' : s === 'PREPARING' ? 'READY' : null)

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-amber-400" /> Kitchen Display
          <span className="text-xs font-medium text-slate-400">({orders.length} active)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Live Auto-Sync
          </span>
        </h2>
        <button
          type="button"
          onClick={() => toggleVoice()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
            isVoiceEnabled
              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              : 'bg-slate-800 text-slate-400 border border-slate-700/60 hover:text-slate-200'
          }`}
          title={isVoiceEnabled ? 'Hindi voice announcement enabled (tap to mute)' : 'Voice alerts muted (tap to enable)'}
        >
          {isVoiceEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          <span>{isVoiceEnabled ? 'Voice ON' : 'Muted'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" /> {error}
        </div>
      )}

      {requests.length > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border-2 border-amber-500/40 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-amber-300 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>Customer Assistance Calls</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {requests.length} pending
              </span>
            </p>
            <span className="text-[11px] text-amber-400/80 font-medium hidden sm:inline">
              Voice announced on kitchen &amp; admin devices
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {requests.map((r) => {
              const meta = SERVICE_TYPE_META[r.type] || {
                label: r.type,
                hindiLabel: 'सहायता कॉल',
                icon: BellRing,
                color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
              }
              const Icon = meta.icon

              return (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-2.5 shadow-md hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/40">
                            {formatTableDisplay(r.tableLabel)}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-100 truncate mt-0.5">
                          {meta.label} <span className="text-slate-400 font-normal">({meta.hindiLabel})</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {r.note && (
                    <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1 italic">
                      &ldquo;{r.note}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                    {r.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => resolveReq(r.id, 'ACK')}
                        className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => resolveReq(r.id, 'RESOLVED')}
                      className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="py-14 text-center text-slate-400 text-sm rounded-3xl bg-slate-900/50 border border-slate-800">
          <ChefHat className="w-8 h-8 mx-auto text-slate-600 mb-2" /> No active kitchen orders.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {orders.map((o) => {
            const d = details.get(o.id)?.order
            const age = ageMin(o.createdAt)
            const overdue = age >= 15
            const next = nextFor(o.fulfilment)
            return (
              <div key={o.id} className={`p-4 rounded-2xl border bg-slate-900/80 ${overdue ? 'border-rose-500/50' : 'border-slate-800'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-2xl font-black text-white">{o.orderNumber}</p>
                    <p className="text-xs text-slate-300 font-semibold">{o.tableLabel ? formatTableDisplay(o.tableLabel) : 'Counter'} • {age}m {overdue && <span className="text-rose-400 font-bold">OVERDUE</span>}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">{o.fulfilment}</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-200">
                  {d ? (
                    d.items.map((it, i) => {
                      const isFree = it.lineTotalPaise === 0 || it.itemName.toLowerCase().includes('reward')
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 font-semibold">
                          <div>
                            <span>{it.quantity} × {it.itemName}</span>
                            {it.options && it.options.length > 0 && <span className="block text-[11px] font-normal text-slate-400 pl-3">{it.options.map((x) => x.optionName).join(', ')}</span>}
                          </div>
                          {isFree && (
                            <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              Free VIP
                            </span>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading items… ({o.itemCount})</p>
                  )}
                </div>
                {d?.notes && <p className="mt-1.5 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">Note: {d.notes}</p>}
                {next && (
                  <button
                    type="button"
                    onClick={() => advance(o.id, next)}
                    disabled={busy === o.id}
                    className="mt-3 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {next === 'READY' ? 'Mark Ready' : next === 'PREPARING' ? 'Start Preparing' : 'Accept Order'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-500">Customer names and the running total are shown; phone numbers stay hidden on this screen. Full payment handling lives in the Orders tab.</p>
    </div>
  )
}
