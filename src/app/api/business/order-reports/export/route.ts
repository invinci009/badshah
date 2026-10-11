import { NextRequest, NextResponse } from 'next/server'
import { getOrders } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

// GET /api/business/order-reports/export?format=csv — authorized CSV export.
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(5000, Math.max(100, parseInt(searchParams.get('limit') || '2000', 10) || 2000))
    const orders = await getOrders(limit)
    const header = ['Order', 'Date', 'Table', 'Customer', 'Phone', 'Items', 'Subtotal', 'Tax', 'Charges', 'Total', 'Fulfilment', 'Payment', 'Paid', 'Refunded']
    const rows = orders.map((o) => [
      o.orderNumber,
      o.createdAt,
      o.tableLabel || 'Counter',
      o.customerName,
      o.customerPhone,
      o.items.map((i) => `${i.quantity}x ${i.itemName}`).join('; '),
      (o.subtotalPaise / 100).toFixed(2),
      (o.taxPaise / 100).toFixed(2),
      (o.chargePaise / 100).toFixed(2),
      (o.totalPaise / 100).toFixed(2),
      o.fulfilment,
      o.paymentStatus,
      (o.paidPaise / 100).toFixed(2),
      (o.refundedPaise / 100).toFixed(2),
    ])
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('Order export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
