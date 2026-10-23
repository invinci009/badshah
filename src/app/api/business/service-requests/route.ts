import { NextRequest, NextResponse } from 'next/server'
import { getServiceRequests, updateServiceRequest } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { serviceRequestPatchSchema } from '@/lib/ordering/validation'

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const requests = await getServiceRequests(status, 200)
    const latest = requests[0]?.updatedAt || requests[0]?.createdAt || '0'
    const etag = `W/"sr-${requests.length}-${requests[0]?.id || '0'}-${latest}"`
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': 'no-cache' },
      })
    }
    return NextResponse.json(requests, {
      status: 200,
      headers: { ETag: etag, 'Cache-Control': 'no-cache' },
    })
  } catch (error) {
    console.error('Service requests GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const { id, ...rest } = body as { id?: string }
    if (!id) return NextResponse.json({ error: 'Missing request id' }, { status: 400 })
    const parsed = serviceRequestPatchSchema.safeParse(rest)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    await updateServiceRequest(id, parsed.data.status)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Service request update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
