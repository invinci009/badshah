import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawSlug = searchParams.get('slug')
  const format = searchParams.get('format') || 'png' // 'png' | 'svg'

  if (!rawSlug) {
    return NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 })
  }

  // Sanitize slug to safe characters to prevent CRLF injection in headers & URL confusion
  const slug = rawSlug.trim().replace(/[^a-zA-Z0-9_-]/g, '')
  if (!slug) {
    return NextResponse.json({ error: 'Invalid slug parameter' }, { status: 400 })
  }

  const type = searchParams.get('type') // 'feedback' | 'special' | 'menu'
  const customPath = searchParams.get('path')

  // Resolve safe base URL with host allowlist
  let baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!baseUrl) {
    const proto = request.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
    const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || process.env.APP_DOMAIN || 'localhost:3000').toLowerCase().trim()
    const isAllowed =
      host === 'localhost:3000' ||
      host === '127.0.0.1:3000' ||
      host.endsWith('.vercel.app') ||
      (process.env.APP_DOMAIN && host === process.env.APP_DOMAIN.toLowerCase().trim())
    baseUrl = isAllowed ? `${proto}://${host}` : (process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : 'http://localhost:3000')
  }
  
  let targetUrl = `${baseUrl}/r/${slug}`
  let qrColor = '#0f172a'

  if (type === 'special' || customPath === 'special-menu') {
    targetUrl = `${baseUrl}/order/${slug}/special-menu`
    qrColor = '#1a6234' // Brand emerald green
  } else if (customPath) {
    const cleanPath = customPath.replace(/^\/+/, '').trim()
    // Disallow protocol-relative URLs (//) and path traversal
    if (!cleanPath.startsWith('http:') && !cleanPath.startsWith('https:') && !cleanPath.includes('//') && !cleanPath.includes('..')) {
      targetUrl = `${baseUrl}/${cleanPath}`
    }
  }

  try {
    if (format === 'svg') {
      const svgString = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 2,
        width: 300,
        color: {
          dark: qrColor,
          light: '#ffffff',
        },
      })
      const isDownload = searchParams.get('download') === 'true'
      const filename = type === 'special' ? `biryani-badshah-special-menu-qr.svg` : `reviewpulse-qr-${slug}.svg`
      return new NextResponse(svgString, {
        headers: {
          'Content-Type': 'image/svg+xml',
          ...(isDownload
            ? { 'Content-Disposition': `attachment; filename="${filename}"` }
            : {}),
        },
      })
    }

    // Default: Return raw PNG image buffer
    const pngBuffer = await QRCode.toBuffer(targetUrl, {
      type: 'png',
      margin: 2,
      width: 512,
      color: {
        dark: qrColor,
        light: '#ffffff',
      },
    })

    const isDownload = searchParams.get('download') === 'true'
    const filename = type === 'special' ? `biryani-badshah-special-menu-qr.png` : `reviewpulse-qr-${slug}.png`
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        ...(isDownload
          ? { 'Content-Disposition': `attachment; filename="${filename}"` }
          : {}),
      },
    })
  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
