import { NextRequest, NextResponse } from 'next/server'
import { getOrders, getRecentPaymentEntries } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

// GET /api/business/order-reports — server-side ordering analytics.
// Definitions:
// - grossValuePaise: sum of totals of NON-cancelled orders (completed sales only).
// - collectionsPaise: sum of recorded collection entries.
// - outstandingPaise: grossValue - totalPaid(non-cancelled).
// - aovPaise: grossValue / non-cancelled order count.
// - cancellationRate: cancelled / all orders.
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(5000, Math.max(100, parseInt(searchParams.get('limit') || '2000', 10) || 2000))
    const [orders, payments] = await Promise.all([getOrders(limit), getRecentPaymentEntries(limit)])

    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const todayIso = dayStart.toISOString()

    const active = orders.filter((o) => ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.fulfilment))
    const completed = orders.filter((o) => o.fulfilment === 'SERVED')
    const cancelled = orders.filter((o) => o.fulfilment === 'CANCELLED')
    const valid = orders.filter((o) => o.fulfilment !== 'CANCELLED')
    const today = orders.filter((o) => o.createdAt >= todayIso)

    const grossValuePaise = valid.reduce((s, o) => s + o.totalPaise, 0)
    const totalPaidValid = valid.reduce((s, o) => s + o.paidPaise, 0)
    const collectionsPaise = payments.filter((p) => p.kind === 'collection').reduce((s, p) => s + p.amountPaise, 0)
    const refundsPaise = payments.filter((p) => p.kind === 'refund').reduce((s, p) => s + p.amountPaise, 0)

    const itemQty = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const o of valid) {
      for (const it of o.items) {
        const cur = itemQty.get(it.itemId) || { name: it.itemName, qty: 0, revenue: 0 }
        cur.qty += it.quantity
        cur.revenue += it.lineTotalPaise
        itemQty.set(it.itemId, cur)
      }
    }
    const bestSellers = [...itemQty.values()].sort((a, b) => b.qty - a.qty).slice(0, 8)

    const byHour = new Array(24).fill(0) as number[]
    for (const o of valid) {
      const h = new Date(o.createdAt).getHours()
      if (h >= 0 && h < 24) byHour[h] += 1
    }

    const byTable = new Map<string, { label: string; count: number; revenue: number }>()
    for (const o of valid) {
      const key = o.tableId || 'counter'
      const cur = byTable.get(key) || { label: o.tableLabel || 'Counter', count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += o.totalPaise
      byTable.set(key, cur)
    }

    return NextResponse.json(
      {
        ordersToday: today.length,
        activeCount: active.length,
        newCount: orders.filter((o) => o.fulfilment === 'RECEIVED').length,
        completedCount: completed.length,
        cancelledCount: cancelled.length,
        totalCount: orders.length,
        grossValuePaise,
        collectionsPaise,
        refundsPaise,
        outstandingPaise: Math.max(0, grossValuePaise - totalPaidValid),
        aovPaise: valid.length > 0 ? Math.round(grossValuePaise / valid.length) : 0,
        cancellationRate: orders.length > 0 ? cancelled.length / orders.length : 0,
        bestSellers,
        byHour,
        byTable: [...byTable.values()].sort((a, b) => b.revenue - a.revenue),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Order reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
