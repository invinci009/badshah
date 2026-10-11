import { NextRequest, NextResponse } from 'next/server'
import { getOrder, getOrderEvents, getPaymentEntries, updateOrder } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const order = await getOrder(id)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const [events, payments] = await Promise.all([
      getOrderEvents(id).catch((err) => {
        console.warn('Events fetch warning:', err)
        return []
      }),
      getPaymentEntries(id).catch((err) => {
        console.warn('Payments fetch warning:', err)
        return []
      }),
    ])

    return NextResponse.json({ order, events, payments }, { status: 200 })
  } catch (error) {
    console.error('Business order detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const updated = await updateOrder(
      id,
      {
        tableId: body.tableId,
        tableLabel: body.tableLabel,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        notes: body.notes,
        fulfilment: body.fulfilment,
      },
      { uid: user.uid, email: user.email }
    )
    return NextResponse.json({ success: true, order: updated }, { status: 200 })
  } catch (error) {
    console.error('Order update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
