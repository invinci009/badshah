import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { getTable } from '@/lib/firebase/ordering'
import { getSessionFromRequest } from '@/lib/firebase/auth'

// GET /api/business/tables/qr?tableId=...&slug=...&format=png|svg&download=...
// Authenticated QR image rendering for table ordering codes.
// (Existing /api/business/qr for feedback campaigns is untouched.)
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')
  const slug = searchParams.get('slug') || 'order'
  const format = searchParams.get('format') || 'png'

  if (!tableId) return NextResponse.json({ error: 'tableId is required' }, { status: 400 })

  try {
    const table = await getTable(tableId)
    if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    if (!table.activeTokenHash) {
      return NextResponse.json({ error: 'No active QR for this table. Generate one first.' }, { status: 409 })
    }
    // Resolve the plaintext token (admin-only doc) to render the QR.
    const { getTableTokenByHash } = await import('@/lib/firebase/ordering')
    const tokenDoc = await getTableTokenByHash(table.activeTokenHash)
    if (!tokenDoc || tokenDoc.revokedAt) {
      return NextResponse.json({ error: 'Active QR token is revoked. Generate a new one.' }, { status: 409 })
    }

    const proto =
      request.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
    const host =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      process.env.APP_DOMAIN ||
      'localhost:3000'
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, '')
    const targetUrl = `${baseUrl}/order/${slug}?table=${encodeURIComponent(table.label)}&token=${encodeURIComponent(tokenDoc.token)}`

    if (format === 'svg') {
      const svgString = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 2,
        width: 300,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
      const isDownload = searchParams.get('download') === 'true'
      return new NextResponse(svgString, {
        headers: {
          'Content-Type': 'image/svg+xml',
          ...(isDownload ? { 'Content-Disposition': `attachment; filename="table-qr-${slug}.svg"` } : {}),
        },
      })
    }

    const pngBuffer = await QRCode.toBuffer(targetUrl, {
      type: 'png',
      margin: 2,
      width: 512,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
    const isDownload = searchParams.get('download') === 'true'
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        ...(isDownload ? { 'Content-Disposition': `attachment; filename="table-qr-${slug}.png"` } : {}),
      },
    })
  } catch (error) {
    console.error('Table QR render error:', error)
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
