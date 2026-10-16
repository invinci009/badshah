'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChefHat, Volume2, VolumeX, Loader2, BellRing, Check } from 'lucide-react'
import { formatTableDisplay } from '@/lib/ordering/rules.mjs'
import { useOrderAnnouncer } from './OrderAnnouncerContext'

interface KOrder {
  id: string
  orderNumber: string
  tableLabel: string | null
  customerName: string
  itemCount: number
  fulfilment: string
  notes?: string
  createdAt: string
  items?: Array<{ quantity: number; itemName: string; options?: Array<{ optionName: string }> }>
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
    items: Array<{ quantity: number; itemName: string; options?: Array<{ optionName: string }> }>
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
  const { isVoiceEnabled, toggleVoice, announceOrderDirectly, refreshActiveOrders } = useOrderAnnouncer()
  const [orders, setOrders] = useState<KOrder[]>([])
  const [details, setDetails] = useState<Map<string, KDetail>>(new Map())
  const detailsRef = useRef<Map<string, KDetail>>(new Map())
  const [requests, setRequests] = useState<StaffCall[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prevCount = useRef(0)
  const ordersEtagRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' }
      if (ordersEtagRef.current) {
        headers['If-None-Match'] = ordersEtagRef.current
      }

      const [oRes, sRes] = await Promise.all([
        fetch('/api/business/orders?status=active&limit=30', { headers }),
        fetch('/api/business/service-requests?status=OPEN'),
      ])
      if (oRes.status === 401 || sRes.status === 401) {
        window.location.href = '/login'
        return
      }

      if (oRes.status !== 304 && oRes.ok) {
        const newEtag = oRes.headers.get('ETag')
        if (newEtag) ordersEtagRef.current = newEtag

        const oData = await oRes.json()
        if (Array.isArray(oData)) {
          const active = oData.filter((o: KOrder) => ['RECEIVED', 'ACCEPTED', 'PREPARING'].includes(o.fulfilment))
          const receivedOrders = active.filter((o: KOrder) => o.fulfilment === 'RECEIVED')

          // Announce incoming orders automatically via Hindi voice
          if (prevCount.current > 0) {
            receivedOrders.forEach((o) => {
              announceOrderDirectly({
                id: o.id,
                orderNumber: o.orderNumber,
                tableLabel: o.tableLabel,
                fulfilment: o.fulfilment,
              })
            })
          }
          prevCount.current = receivedOrders.length
          setOrders(active)
          setError(null)
          // Order rows now include items directly — zero extra N+1 reads
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
        }
      }

      if (sRes.ok) {
        const sData = await sRes.json()
        if (Array.isArray(sData)) setRequests(sData)
      }
    } catch {
      setError('Failed to load kitchen data — retrying…')
    }
  }, [announceOrderDirectly])

  useEffect(() => {
    load()

    // 10-second auto-sync interval
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load()
      }
    }, 10000)

    // Immediate sync when tab gains visibility or focus
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)

    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [load])

  const advance = async (id: string, to: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/business/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(data.error || 'Failed to update order status')
        return
      }
      detailsRef.current.delete(id)
      setDetails(new Map(detailsRef.current))
      load()
      refreshActiveOrders()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to update order status')
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
      load()
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
        <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2">
          <p className="text-xs font-bold text-sky-300 flex items-center gap-1.5"><BellRing className="w-4 h-4" /> Staff calls ({requests.length})</p>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs text-sky-200 gap-2">
              <span>{formatTableDisplay(r.tableLabel)} — {r.type}{r.note ? `: ${r.note}` : ''}</span>
              <div className="flex gap-1.5 shrink-0">
                <button type="button" onClick={() => resolveReq(r.id, 'ACK')} className="px-2 py-1 rounded-lg bg-sky-600 text-white font-bold cursor-pointer">Ack</button>
                <button type="button" onClick={() => resolveReq(r.id, 'RESOLVED')} className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer">Done</button>
              </div>
            </div>
          ))}
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
                    d.items.map((it, i) => (
                      <p key={i} className="font-semibold">
                        {it.quantity} × {it.itemName}
                        {it.options && it.options.length > 0 && <span className="block text-[11px] font-normal text-slate-400 pl-3">{it.options.map((x) => x.optionName).join(', ')}</span>}
                      </p>
                    ))
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
