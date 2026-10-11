import { NextRequest, NextResponse } from 'next/server'
import { getOrder, getOrderEvents, getPaymentEntries } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const order = await getOrder(id)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const [events, payments] = await Promise.all([getOrderEvents(id), getPaymentEntries(id)])
    return NextResponse.json({ order, events, payments }, { status: 200 })
  } catch (error) {
    console.error('Business order detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
