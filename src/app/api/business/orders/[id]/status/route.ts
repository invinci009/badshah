import { NextRequest, NextResponse } from 'next/server'
import { transitionOrderStatus } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { orderStatusPatchSchema } from '@/lib/ordering/validation'

// PATCH /api/business/orders/[id]/status — validated lifecycle transition.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = orderStatusPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid transition', details: parsed.error.flatten() }, { status: 400 })
    }
    if (parsed.data.to === 'CANCELLED' && !parsed.data.reason?.trim()) {
      return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 })
    }
    try {
      const order = await transitionOrderStatus(id, parsed.data.to, { uid: user.uid, email: user.email }, parsed.data.reason?.trim())
      return NextResponse.json({ success: true, fulfilment: order.fulfilment }, { status: 200 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      if (msg === 'INVALID_TRANSITION') {
        return NextResponse.json({ error: 'Transition not allowed from current status' }, { status: 409 })
      }
      throw e
    }
  } catch (error) {
    console.error('Order status transition error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
