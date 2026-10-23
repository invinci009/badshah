import { NextRequest, NextResponse } from 'next/server'
import { getLoyaltyAnalytics } from '@/lib/firebase/loyalty'
import { getSessionFromRequest } from '@/lib/firebase/auth'

// GET /api/business/loyalty/analytics — program metrics for the admin dashboard.
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getLoyaltyAnalytics())
  } catch (error) {
    console.error('Loyalty analytics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
