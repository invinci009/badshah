import { NextRequest, NextResponse } from 'next/server'
import { getOrders, getActiveOrders, getOrdersByFulfilment, getTables, normalizeTableLabel, getActiveOrdersEtag, computeOrdersEtag, type FulfilmentStatus, type Order } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/business/orders?status=&payment=&tableId=&q=&limit=
// Server-side filtered list (no phone leakage concern — admin only).
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const payment = searchParams.get('payment')
    const tableId = searchParams.get('tableId')
    const q = (searchParams.get('q') || '').toLowerCase().trim()
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '60', 10) || 60))

    // Fast path: if requesting default active orders without custom filters, check cached ETag
    if ((!status || status === 'active') && (!payment || payment === 'all') && (!tableId || tableId === 'all') && !q) {
      const cachedEtag = getActiveOrdersEtag()
      const ifNoneMatch = request.headers.get('if-none-match')
      if (cachedEtag && ifNoneMatch === cachedEtag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: cachedEtag,
            'Cache-Control': 'no-cache',
          },
        })
      }
    }

    let orders: Order[] = []
    if (status === 'active') {
      orders = await getActiveOrders(limit)
    } else if (status && status !== 'all') {
      orders = await getOrdersByFulfilment(status as FulfilmentStatus, limit)
    } else {
      orders = await getOrders(limit)
    }
    if (payment && payment !== 'all') orders = orders.filter((o) => o.paymentStatus === payment)
    if (tableId) {
      const allTables = await getTables(true).catch(() => [])
      const selectedTable = allTables.find((t) => t.id === tableId)
      orders = orders.filter((o) => {
        if (o.tableId === tableId) return true
        if (selectedTable && o.tableLabel && normalizeTableLabel(o.tableLabel) === normalizeTableLabel(selectedTable.label)) {
          return true
        }
        return false
      })
    }
    if (q) {
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          (o.tableLabel || '').toLowerCase().includes(q)
      )
    }

    // Compute composite ETag so ANY status change across any order invalidates the cache immediately
    const etag = computeOrdersEtag(orders)

    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'no-cache',
        },
      })
    }

    // Return order rows including items to avoid N+1 fetches from kitchen and detail views
    return NextResponse.json(
      orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        tableId: o.tableId,
        tableLabel: o.tableLabel,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        items: o.items,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        totalPaise: o.totalPaise,
        subtotalPaise: o.subtotalPaise,
        taxPaise: o.taxPaise,
        chargePaise: o.chargePaise,
        fulfilment: o.fulfilment,
        paymentStatus: o.paymentStatus,
        paidPaise: o.paidPaise,
        refundedPaise: o.refundedPaise,
        notes: o.notes,
        createdAt: o.createdAt,
      })),
      {
        status: 200,
        headers: {
          ETag: etag,
          'Cache-Control': 'no-cache',
        },
      }
    )
  } catch (error) {
    console.error('Business orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
