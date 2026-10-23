import { NextRequest, NextResponse } from 'next/server'
import { listRedemptionsFilterable, cancelRedemption } from '@/lib/firebase/loyalty'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { redemptionActionSchema } from '@/lib/loyalty/validation'

// GET /api/business/loyalty/redemptions?status=APPLIED|FULFILLED|CANCELLED|REFUNDED
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const limit = Math.min(500, Math.max(20, parseInt(searchParams.get('limit') || '200', 10)))
    const valid = ['APPLIED', 'FULFILLED', 'CANCELLED', 'REFUNDED']
    if (status && !valid.includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }
    return NextResponse.json(await listRedemptionsFilterable(status, limit))
  } catch (error) {
    console.error('Loyalty redemptions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/business/loyalty/redemptions — cancel + restore points (exception handling).
export async function PATCH(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = redemptionActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const reason = parsed.data.reason?.trim() || `Cancelled by admin (${user.email ?? user.uid}) — points restored`
    await cancelRedemption(parsed.data.id, reason)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    console.error('Loyalty redemption PATCH error:', error)
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Redemption not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
