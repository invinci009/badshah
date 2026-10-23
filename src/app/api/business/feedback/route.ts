import { NextRequest, NextResponse } from 'next/server'
import { getPrivateFeedback } from '@/lib/firebase/firestore'
import { getSessionFromRequest } from '@/lib/firebase/auth'

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const list = await getPrivateFeedback()
    const latest = list[0]?.createdAt || '0'
    const etag = `W/"fb-${list.length}-${list[0]?.id || '0'}-${latest}"`
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': 'private, max-age=30' },
      })
    }
    return NextResponse.json(list, {
      status: 200,
      headers: { ETag: etag, 'Cache-Control': 'private, max-age=30' },
    })
  } catch (error) {
    console.error('Error fetching private feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
