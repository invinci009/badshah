import { NextRequest, NextResponse } from 'next/server'
import { getTable, issueTableToken, revokeTableToken } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { generateTableToken, hashToken, tokenPrefix } from '@/lib/ordering/tokens'

// POST /api/business/tables/[id]/qr — issue (rotate) a new ordering QR token.
// Returns the plaintext token ONCE; only its hash is stored for lookups.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const table = await getTable(id)
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

    const token = generateTableToken()
    const hash = hashToken(token)
    const prefix = tokenPrefix(token)
    await issueTableToken(id, token, hash, prefix)

    const proto =
      request.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
    const host =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      process.env.APP_DOMAIN ||
      'localhost:3000'
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, '')
    // Table QRs resolve through the general ordering portal slug of the
    // restaurant; the token carries the authoritative table identity.
    // The portal slug defaults to the table label slug below; the client
    // passes ?slug= explicitly when printing.
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || table.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const qrUrl = `${baseUrl}/order/${slug}?table=${encodeURIComponent(table.label)}&token=${encodeURIComponent(token)}`

    return NextResponse.json({ token, tokenPrefix: prefix, qrUrl }, { status: 201 })
  } catch (error) {
    console.error('Issue table QR error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/business/tables/[id]/qr — revoke active token (table + history kept).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const table = await getTable(id)
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    await revokeTableToken(id)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Revoke table QR error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
