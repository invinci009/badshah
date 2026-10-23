import { NextRequest, NextResponse } from 'next/server'
import { getAdminCustomerDetail, normalizeCustomerPhone } from '@/lib/firebase/loyalty'
import { getSessionFromRequest } from '@/lib/firebase/auth'

// GET /api/business/loyalty/customers/[phone] — detail: safe profile, snapshot,
// transaction history and redemptions.
export async function GET(request: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { phone } = await params
    const normalized = normalizeCustomerPhone(phone)
    if (!normalized) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
    const detail = await getAdminCustomerDetail(normalized)
    if (!detail) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Loyalty customer detail GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
