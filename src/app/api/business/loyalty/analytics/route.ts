import { NextRequest, NextResponse } from 'next/server'
import { getLoyaltyAnalytics } from '@/lib/firebase/loyalty'
import { getSessionFromRequest } from '@/lib/firebase/auth'

// GET /api/business/loyalty/analytics — program metrics for the admin dashboard.
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await getLoyaltyAnalytics()
    const etag = `W/"la-${data.enrolledCustomers}-${data.pointsIssued}-${data.pointsRedeemed}-${data.redemptionsTotal}-${data.updatedAt || '0'}"`
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': 'no-cache' },
      })
    }
    return NextResponse.json(data, {
      status: 200,
      headers: { ETag: etag, 'Cache-Control': 'no-cache' },
    })
  } catch (error) {
    console.error('Loyalty analytics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
