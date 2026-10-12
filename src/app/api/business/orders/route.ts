import { NextRequest, NextResponse } from 'next/server'
import { getOrders, getActiveOrders, getTables, normalizeTableLabel } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

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

    let orders = status === 'active' ? await getActiveOrders(limit) : await getOrders(limit)
    if (status && status !== 'all' && status !== 'active') orders = orders.filter((o) => o.fulfilment === status)
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
      { status: 200 }
    )
  } catch (error) {
    console.error('Business orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
