import { NextRequest, NextResponse } from 'next/server'
import {
  listLoyaltyCustomers,
  adjustPoints,
  setCustomerStatus,
  normalizeCustomerPhone,
} from '@/lib/firebase/loyalty'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import {
  loyaltyAdjustSchema,
  loyaltyCustomerStatusSchema,
} from '@/lib/loyalty/validation'

// GET /api/business/loyalty/customers — loyalty members + balances.
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const rows = await listLoyaltyCustomers()
    const filtered = q
      ? rows.filter(
          (r) =>
            r.phone.includes(q.replace(/\D/g, '')) ||
            r.name.toLowerCase().includes(q)
        )
      : rows
    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Loyalty customers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/business/loyalty/customers — manual point adjustment (mandatory reason).
export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = loyaltyAdjustSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid adjustment', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const phone = normalizeCustomerPhone(parsed.data.phone)
    if (!phone) return NextResponse.json({ error: 'Valid 10-digit phone required' }, { status: 400 })
    const result = await adjustPoints(phone, parsed.data.points, parsed.data.reason, {
      uid: user.uid,
      email: user.email,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Loyalty adjust POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/business/loyalty/customers — suspend / reactivate customer.
export async function PATCH(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = loyaltyCustomerStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const phone = normalizeCustomerPhone(parsed.data.phone)
    if (!phone) return NextResponse.json({ error: 'Valid 10-digit phone required' }, { status: 400 })
    await setCustomerStatus(phone, parsed.data.status)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Loyalty customer status PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
