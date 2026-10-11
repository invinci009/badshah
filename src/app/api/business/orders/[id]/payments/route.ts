import { NextRequest, NextResponse } from 'next/server'
import { recordPaymentEntry } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { paymentRecordSchema } from '@/lib/ordering/validation'

// POST /api/business/orders/[id]/payments — auditable counter payment ledger.
// Refunds require an actual refund; cancelled orders are NOT auto-refunded.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = paymentRecordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment', details: parsed.error.flatten() }, { status: 400 })
    }
    try {
      const order = await recordPaymentEntry({
        orderId: id,
        kind: parsed.data.kind,
        amountPaise: parsed.data.amountPaise,
        method: parsed.data.method,
        staffUid: user.uid,
        staffEmail: user.email,
        reference: parsed.data.reference?.trim(),
      })
      return NextResponse.json(
        { success: true, paymentStatus: order.paymentStatus, paidPaise: order.paidPaise, refundedPaise: order.refundedPaise },
        { status: 200 }
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      if (msg === 'ORDER_CANCELLED') {
        return NextResponse.json({ error: 'Cannot record payments on a cancelled order' }, { status: 409 })
      }
      if (msg === 'OVER_COLLECTION') {
        return NextResponse.json({ error: 'Amount exceeds the outstanding balance' }, { status: 409 })
      }
      if (msg === 'REFUND_EXCEEDS_PAID') {
        return NextResponse.json({ error: 'Refund cannot exceed the recorded paid amount' }, { status: 409 })
      }
      throw e
    }
  } catch (error) {
    console.error('Payment record error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
