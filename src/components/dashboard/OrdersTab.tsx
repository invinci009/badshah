'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ClipboardList,
  Search,
  Loader2,
  X,
  Phone,
  Printer,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Undo2,
  ChevronRight,
} from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'

interface OrderRow {
  id: string
  orderNumber: string
  tableId: string | null
  tableLabel: string | null
  customerName: string
  customerPhone: string
  itemCount: number
  totalPaise: number
  fulfilment: string
  paymentStatus: string
  paidPaise: number
  refundedPaise: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  ACCEPTED: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  PREPARING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  READY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  SERVED: 'bg-slate-700 text-slate-300 border-slate-600',
  CANCELLED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

const NEXT_ACTIONS: Record<string, string[]> = {
  RECEIVED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
}

function ageMinutes(createdAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000))
}

interface DetailOption {
  optionName: string
}

interface DetailItem {
  quantity: number
  itemName: string
  lineTotalPaise: number
  options?: DetailOption[]
}

interface DetailPayment {
  id: string
  kind: string
  amountPaise: number
  method: string
  reference?: string | null
  createdAt: string
}

interface DetailEvent {
  id: string
  type: string
  prev?: string | null
  next?: string | null
  reason?: string | null
  createdAt: string
}

interface OrderDetail {
  order: {
    id: string
    orderNumber: string
    customerName: string
    customerPhone: string
    tableLabel: string | null
    fulfilment: string
    notes?: string
    items: DetailItem[]
    subtotalPaise: number
    taxPaise: number
    chargePaise: number
    totalPaise: number
    paidPaise: number
    refundedPaise: number
    paymentStatus: string
    createdAt: string
  }
  events: DetailEvent[]
  payments: DetailPayment[]
}

export default function OrdersTab({ tables, onRefresh }: { tables: Array<{ id: string; label: string }>; onRefresh: () => void }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [payFilter, setPayFilter] = useState('all')
  const [tableFilter, setTableFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [payRef, setPayRef] = useState('')
  const [payKind, setPayKind] = useState<'collection' | 'refund'>('collection')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [newArrivals, setNewArrivals] = useState(0)
  const prevIds = useRef<Set<string>>(new Set())

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const params = new URLSearchParams()
        if (tableFilter !== 'all') params.set('tableId', tableFilter)
        if (search.trim()) params.set('q', search.trim())
        params.set('limit', '300')
        const res = await fetch(`/api/business/orders?${params.toString()}`)
        const data = await res.json()
        if (res.ok && Array.isArray(data)) {
          const ids = new Set(data.map((o: OrderRow) => o.id))
          if (prevIds.current.size > 0) {
            const fresh = data.filter(
              (o: OrderRow) => !prevIds.current.has(o.id) && o.fulfilment === 'RECEIVED'
            ).length
            if (fresh > 0) setNewArrivals((n) => n + fresh)
          }
          prevIds.current = ids
          setOrders(data)
        }
      } catch { /* silent refresh failure */ } finally {
        if (!silent) setLoading(false)
      }
    },
    [search, tableFilter]
  )

  useEffect(() => {
    // Deferred initial load: the fetch resolves asynchronously after mount.
    const raf = requestAnimationFrame(() => fetchOrders())
    const t = setInterval(() => fetchOrders(true), 15000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(t)
    }
  }, [fetchOrders])

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'active') {
        if (!['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.fulfilment)) return false
      } else if (statusFilter !== 'all' && o.fulfilment !== statusFilter) return false
      if (payFilter !== 'all' && o.paymentStatus !== payFilter) return false
      return true
    })
  }, [orders, statusFilter, payFilter])

  const openDetail = async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    setDetail(null)
    setMsg(null)
    setShowCancel(false)
    setCancelReason('')
    setPayKind('collection')
    setPayMethod('CASH')
    setPayRef('')
    setPayAmount('')
    try {
      const res = await fetch(`/api/business/orders/${id}`)
      const data = await res.json()
      if (res.ok) {
        setDetail(data)
        const o = data.order
        setPayAmount(o ? String(((o.totalPaise - o.paidPaise) / 100).toFixed(2)) : '')
      }
    } catch { /* ignore */ } finally {
      setDetailLoading(false)
    }
  }

  const doTransition = async (to: string) => {
    if (!selectedId) return
    if (to === 'CANCELLED') {
      setShowCancel(true)
      return
    }
    setActionBusy(true)
    try {
      const res = await fetch(`/api/business/orders/${selectedId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Transition failed')
      setMsg({ ok: true, text: `Order moved to ${to}` })
      openDetail(selectedId)
      fetchOrders(true)
      onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Transition failed' })
    } finally {
      setActionBusy(false)
    }
  }

  const doCancel = async () => {
    if (!selectedId || !cancelReason.trim()) {
      setMsg({ ok: false, text: 'Cancellation reason is required' })
      return
    }
    setActionBusy(true)
    try {
      const res = await fetch(`/api/business/orders/${selectedId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'CANCELLED', reason: cancelReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cancel failed')
      setMsg({ ok: true, text: 'Order cancelled with reason recorded' })
      setShowCancel(false)
      openDetail(selectedId)
      fetchOrders(true)
      onRefresh()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Cancel failed' })
    } finally {
      setActionBusy(false)
    }
  }

  const doPayment = async () => {
    if (!selectedId || !detail?.order) return
    const o = detail.order
    const paise = Math.round(parseFloat(payAmount || '0') * 100)
    if (!Number.isFinite(paise) || paise <= 0) {
      setMsg({ ok: false, text: 'Enter a valid amount greater than zero' })
      return
    }
    if (o.fulfilment === 'CANCELLED') {
      setMsg({ ok: false, text: 'Cannot record payments on a cancelled order' })
      return
    }
    const outstanding = o.totalPaise - o.paidPaise
    if (payKind === 'collection' && paise > outstanding) {
      setMsg({ ok: false, text: `Amount exceeds outstanding balance of ${formatPaise(outstanding)}` })
      return
    }
    const maxRefund = o.paidPaise - o.refundedPaise
    if (payKind === 'refund' && paise > maxRefund) {
      setMsg({ ok: false, text: `Refund cannot exceed ${formatPaise(maxRefund)}` })
      return
    }
    if (payKind === 'refund' && !payRef.trim()) {
      setMsg({ ok: false, text: 'A reference is required when recording a refund' })
      return
    }
    if (!confirm(`${payKind === 'collection' ? 'Collect' : 'Refund'} ${formatPaise(paise)}? This is recorded permanently.`)) return
    setActionBusy(true)
    try {
      const res = await fetch(`/api/business/orders/${selectedId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: payKind, amountPaise: paise, method: payMethod, reference: payRef.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')
      setMsg({ ok: true, text: `${payKind === 'collection' ? 'Collection' : 'Refund'} recorded` })
      setPayRef('')
      openDetail(selectedId)
      fetchOrders(true)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Payment failed' })
    } finally {
      setActionBusy(false)
    }
  }

  const printDoc = (kind: 'kitchen' | 'receipt') => {
    if (!detail?.order) return
    const o = detail.order
    const w = window.open('', '_blank', 'width=420,height=650')
    if (!w) {
      alert('Please allow popups to print')
      return
    }
    const isKitchen = kind === 'kitchen'
    const itemsHtml = o.items
      .map((it) => {
        const opts = it.options && it.options.length ? `<div style="font-size:11px;color:#444;padding-left:14px;font-style:italic;">+ ${it.options.map((x) => x.optionName).join(', ')}</div>` : ''
        return `
          <div style="margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${isKitchen ? '14px' : '12px'};">
              <span>${it.quantity} × ${it.itemName}</span>
              ${!isKitchen ? `<span>${formatPaise(it.lineTotalPaise)}</span>` : ''}
            </div>
            ${opts}
          </div>
        `
      })
      .join('')

    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${isKitchen ? 'KOT' : 'Receipt'} - ${o.orderNumber}</title>
          <style>
            @page { margin: 4mm; size: 80mm auto; }
            * { box-sizing: border-box; }
            body {
              font-family: 'Courier New', Courier, monospace, system-ui;
              font-size: 12px;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 10px;
              max-width: 300px;
              line-height: 1.35;
            }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .bold { font-weight: bold; }
            .table-badge {
              border: 2px solid #000;
              padding: 4px;
              margin: 6px 0;
              font-size: 16px;
              font-weight: 900;
              text-align: center;
              letter-spacing: 1px;
            }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin:0;font-size:16px;letter-spacing:1px;font-weight:900;">BIRYANI BADSHAH</h2>
            <div style="font-size:10px;font-weight:bold;text-transform:uppercase;margin-top:2px;">
              ${isKitchen ? '★ KITCHEN ORDER TICKET (KOT) ★' : '★ CUSTOMER TAX INVOICE ★'}
            </div>
            <div style="font-size:13px;font-weight:bold;margin-top:4px;">${o.orderNumber}</div>
            <div style="font-size:10px;color:#333;">${new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
          </div>

          <div class="table-badge">
            ${o.tableLabel ? `TABLE ${o.tableLabel}` : 'COUNTER / DINE-IN'}
          </div>

          <div style="font-size:11px;">
            <div><strong>Guest:</strong> ${o.customerName}</div>
            ${!isKitchen ? `<div><strong>Phone:</strong> ${o.customerPhone}</div>` : ''}
          </div>

          <div class="divider"></div>
          <div style="margin: 6px 0;">
            ${itemsHtml}
          </div>
          <div class="divider"></div>

          ${o.notes ? `
            <div style="border:1px solid #000;padding:5px;margin:6px 0;font-size:11px;background:#f9f9f9;">
              <strong>CHEF NOTE:</strong> ${o.notes}
            </div>
          ` : ''}

          ${!isKitchen ? `
            <div style="font-size:11px;margin-top:4px;">
              <div class="row"><span>Subtotal</span><span>${formatPaise(o.subtotalPaise)}</span></div>
              <div class="row"><span>GST</span><span>${formatPaise(o.taxPaise)}</span></div>
              ${o.chargePaise ? `<div class="row"><span>Charges</span><span>${formatPaise(o.chargePaise)}</span></div>` : ''}
              <div class="divider"></div>
              <div class="row bold" style="font-size:14px;"><span>GRAND TOTAL</span><span>${formatPaise(o.totalPaise)}</span></div>
              <div class="row" style="font-size:10px;margin-top:4px;">
                <span>Payment:</span>
                <span class="bold">${o.paymentStatus === 'PAID' ? 'PAID' : `DUE (${formatPaise(o.totalPaise - o.paidPaise)})`}</span>
              </div>
            </div>
            <div class="divider"></div>
            <div class="center" style="font-size:10px;margin-top:8px;">
              Thank you for dining with Biryani Badshah!<br/>
              Scan table QR to leave feedback.
            </div>
          ` : `
            <div class="center" style="font-size:10px;margin-top:6px;font-weight:bold;">
              [ END OF KITCHEN TICKET ]
            </div>
          `}
          <script>window.onload=()=>{ window.print(); }</script>
        </body>
      </html>
    `

    w.document.open()
    w.document.write(docHtml)
    w.document.close()
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-400" /> Orders
            {newArrivals > 0 && (
              <button type="button" onClick={() => { setNewArrivals(0); fetchOrders() }} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white animate-pulse cursor-pointer">
                {newArrivals} new — tap to refresh
              </button>
            )}
          </h2>
          <p className="text-xs text-slate-400">Live queue • auto-refreshes every 15s</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fetchOrders()} className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a href="/api/business/order-reports/export?format=csv" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700">
            <Download className="w-3.5 h-3.5 text-amber-400" /> CSV
          </a>
        </div>
      </div>

      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order no, name, phone, table…" className="bg-slate-950/70 border-slate-800 text-white pl-9 h-10 text-xs" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white px-3 cursor-pointer">
          <option value="active">Active queue</option>
          <option value="all">All statuses</option>
          <option value="RECEIVED">Received</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="PREPARING">Preparing</option>
          <option value="READY">Ready</option>
          <option value="SERVED">Served</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} className="h-10 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white px-3 cursor-pointer">
          <option value="all">All payments</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partial</option>
          <option value="PAID">Paid</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Part-refund</option>
        </select>
        <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="h-10 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white px-3 cursor-pointer">
          <option value="all">All tables</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>Table {t.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-14 text-center text-slate-400"><Loader2 className="w-7 h-7 mx-auto animate-spin text-amber-500" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/40"><CardContent className="py-14 text-center text-slate-400 text-sm">No orders match.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => openDetail(o.id)}
              className="text-left p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-white">{o.orderNumber} <span className="text-[11px] font-medium text-slate-400">• {ageMinutes(o.createdAt)}m ago</span></p>
                  <p className="text-xs text-slate-300">{o.customerName} • Table {o.tableLabel || 'Counter'} • {o.itemCount} items</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[o.fulfilment] || ''}`}>{o.fulfilment}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="font-bold text-amber-300">{formatPaise(o.totalPaise)}</span>
                <span className="text-slate-400 flex items-center gap-1">
                  {o.paymentStatus} ({formatPaise(o.paidPaise)} paid) <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end" onClick={() => setSelectedId(null)}>
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">Order Detail</h3>
              <button type="button" onClick={() => setSelectedId(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {msg && (
              <div className={`p-2.5 rounded-xl text-xs flex gap-2 ${msg.ok ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'}`}>
                {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />} {msg.text}
              </div>
            )}
            {detailLoading && <div className="py-10 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-500" /></div>}
            {detail?.order && (
              <>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Order</span><span className="font-extrabold text-white">{detail.order.orderNumber}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Customer</span><span className="text-white font-semibold">{detail.order.customerName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Phone</span><a href={`tel:${detail.order.customerPhone}`} className="text-emerald-300 font-mono flex items-center gap-1"><Phone className="w-3 h-3" />{detail.order.customerPhone}</a></div>
                  <div className="flex justify-between"><span className="text-slate-400">Table</span><span className="text-white">{detail.order.tableLabel || 'Counter'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Status</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_COLORS[detail.order.fulfilment]}`}>{detail.order.fulfilment}</span></div>
                  {detail.order.notes && <p className="text-xs text-amber-200 pt-1">Note: {detail.order.notes}</p>}
                </div>

                <div className="space-y-1.5">
                  {(detail.order.items || []).map((it, i: number) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                      <div className="flex justify-between text-slate-200"><span>{it.quantity} × {it.itemName}</span><span className="font-bold">{formatPaise(it.lineTotalPaise)}</span></div>
                      {it.options && it.options.length > 0 && <p className="text-slate-400">{it.options.map((x) => x.optionName).join(', ')}</p>}
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-extrabold text-white pt-1"><span>Total</span><span>{formatPaise(detail.order.totalPaise)}</span></div>
                  <p className="text-[11px] text-slate-400">Outstanding: {formatPaise(Math.max(0, detail.order.totalPaise - detail.order.paidPaise))} • Payment: {detail.order.paymentStatus}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-300">Status actions</p>
                  <div className="flex flex-wrap gap-2">
                    {(NEXT_ACTIONS[detail.order.fulfilment] || []).map((a) => (
                      <button key={a} type="button" onClick={() => doTransition(a)} disabled={actionBusy} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${a === 'CANCELLED' ? 'bg-rose-600/20 border border-rose-500/40 text-rose-300' : 'bg-amber-600 text-white'}`}>
                        {a === 'CANCELLED' ? 'Cancel…' : `Mark ${a.charAt(0) + a.slice(1).toLowerCase()}`}
                      </button>
                    ))}
                  </div>
                  {showCancel && (
                    <div className="space-y-2 p-3 rounded-xl bg-rose-500/5 border border-rose-500/30">
                      <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (required)…" className="bg-slate-950 border-slate-700 text-white text-xs h-10" />
                      <Button onClick={doCancel} disabled={actionBusy} className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 rounded-xl cursor-pointer w-full">Confirm Cancellation</Button>
                    </div>
                  )}
                </div>

                {detail.order.fulfilment !== 'CANCELLED' && (
                <div className="space-y-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-amber-400" /> Record counter payment</p>
                  <div className="flex gap-1 text-xs">
                    <button type="button" onClick={() => setPayKind('collection')} className={`flex-1 py-1.5 rounded-lg font-bold cursor-pointer ${payKind === 'collection' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Collect</button>
                    <button type="button" onClick={() => setPayKind('refund')} className={`flex-1 py-1.5 rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1 ${payKind === 'refund' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}><Undo2 className="w-3 h-3" /> Refund</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder="Amount ₹" className="bg-slate-900 border-slate-700 text-white text-xs h-10" />
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="h-10 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white px-2">
                      <option value="CASH">Cash</option>
                      <option value="UPI_COUNTER">UPI</option>
                      <option value="CARD_COUNTER">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder={payKind === 'refund' ? 'Refund reference (required)' : 'Reference (optional)'} className="bg-slate-900 border-slate-700 text-white text-xs h-10" />
                  <Button onClick={doPayment} disabled={actionBusy} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl cursor-pointer w-full">
                    {actionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Record ${payKind}`}
                  </Button>
                  {(detail.payments || []).length > 0 && (
                    <div className="pt-1 space-y-1">
                      {detail.payments.map((p) => (
                        <p key={p.id} className="text-[11px] text-slate-400">
                          {p.kind === 'collection' ? '+' : '−'}{formatPaise(p.amountPaise)} {p.method} • {new Date(p.createdAt).toLocaleString()}{p.reference ? ` • ${p.reference}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={() => printDoc('kitchen')} className="flex-1 h-10 rounded-xl border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                    <Printer className="w-3.5 h-3.5" /> Kitchen Ticket
                  </button>
                  <button type="button" onClick={() => printDoc('receipt')} className="flex-1 h-10 rounded-xl border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                    <Printer className="w-3.5 h-3.5" /> Receipt
                  </button>
                </div>

                {(detail.events || []).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-300">History</p>
                    {detail.events.map((ev) => (
                      <p key={ev.id} className="text-[11px] text-slate-500">
                        {new Date(ev.createdAt).toLocaleString()} — {ev.type}{ev.prev || ev.next ? ` (${ev.prev || ''} → ${ev.next || ''})` : ''}{ev.reason ? ` — ${ev.reason}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
