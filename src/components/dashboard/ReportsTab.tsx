'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart3, Loader2 } from 'lucide-react'
import { formatPaise } from '@/lib/ordering/rules.mjs'

interface ReportBestSeller {
  name: string
  qty: number
  revenue: number
}

interface ReportTableRow {
  label: string
  count: number
  revenue: number
}

interface ReportData {
  ordersToday: number
  activeCount: number
  completedCount: number
  cancelledCount: number
  grossValuePaise: number
  collectionsPaise: number
  outstandingPaise: number
  aovPaise: number
  cancellationRate: number
  bestSellers: ReportBestSeller[]
  byHour: number[]
  byTable: ReportTableRow[]
}

export default function ReportsTab() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/business/order-reports')
      .then(async (r) => {
        const d = await r.json()
        if (r.ok) setData(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400"><Loader2 className="w-7 h-7 mx-auto animate-spin text-amber-500" /></div>
    )
  }
  if (!data) {
    return <div className="py-16 text-center text-slate-400 text-sm">Reports unavailable.</div>
  }

  const maxHour = Math.max(1, ...data.byHour)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-amber-400" /> Ordering Reports
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Orders Today', value: String(data.ordersToday) },
          { label: 'Active Now', value: String(data.activeCount) },
          { label: 'Completed', value: String(data.completedCount) },
          { label: 'Cancelled', value: String(data.cancelledCount) },
          { label: 'Gross Order Value', value: formatPaise(data.grossValuePaise), sub: 'non-cancelled orders only' },
          { label: 'Recorded Collections', value: formatPaise(data.collectionsPaise), sub: 'cash/counter ledger' },
          { label: 'Outstanding', value: formatPaise(data.outstandingPaise), sub: 'gross minus paid' },
          { label: 'Avg Order Value', value: formatPaise(data.aovPaise), sub: `${Math.round(data.cancellationRate * 100)}% cancelled` },
        ].map((k) => (
          <Card key={k.label} className="border-slate-800 bg-slate-900/60">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold text-slate-400">{k.label}</p>
              <p className="text-xl font-extrabold text-white mt-1">{k.value}</p>
              {k.sub && <p className="text-[10px] text-slate-500 mt-0.5">{k.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white">Best Sellers</CardTitle>
            <CardDescription className="text-xs text-slate-400">By quantity, non-cancelled orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.bestSellers || []).map((b) => (
              <div key={b.name} className="flex justify-between text-xs text-slate-200">
                <span>{b.name}</span>
                <span className="font-bold">{b.qty} sold • {formatPaise(b.revenue)}</span>
              </div>
            ))}
            {(data.bestSellers || []).length === 0 && <p className="text-xs text-slate-500">No sales yet.</p>}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white">Orders by Hour</CardTitle>
            <CardDescription className="text-xs text-slate-400">Local time buckets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {data.byHour.map((n: number, h: number) => (
                <div key={h} title={`${h}:00 — ${n}`} className="flex-1 rounded-t bg-amber-500/70 min-h-[2px]" style={{ height: `${Math.max(2, Math.round((n / maxHour) * 96))}px` }} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>0h</span><span>12h</span><span>23h</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Orders by Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr><th className="py-2 px-3">Table</th><th className="py-2 px-3">Orders</th><th className="py-2 px-3">Revenue</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {(data.byTable || []).map((t) => (
                  <tr key={t.label}><td className="py-2 px-3 font-semibold">{t.label}</td><td className="py-2 px-3">{t.count}</td><td className="py-2 px-3 font-bold text-amber-300">{formatPaise(t.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
