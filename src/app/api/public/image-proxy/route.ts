import { NextRequest, NextResponse } from 'next/server'

// ==============================================================================
// High-Speed Image Proxy & Stream Cache for Google Drive & External Media
// Hardened against Server-Side Request Forgery (SSRF) and Resource Exhaustion.
// Bypasses Google Drive hotlinking / Referer blocks and caches images for 7 days.
// ==============================================================================

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB limit
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  // Explicitly deny IP literals (IPv4 and IPv6)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':') || host === 'localhost') {
    return false
  }

  // Trusted image hosting domains
  if (
    host === 'lh3.googleusercontent.com' ||
    host.endsWith('.googleusercontent.com') ||
    host === 'drive.google.com' ||
    host === 'firebasestorage.googleapis.com' ||
    host.endsWith('.firebasestorage.app') ||
    host === 'images.unsplash.com' ||
    host === 'dl.dropboxusercontent.com' ||
    host.endsWith('.dropbox.com')
  ) {
    return true
  }

  return false
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driveId = searchParams.get('id') || searchParams.get('driveId')
  const rawUrl = searchParams.get('url')

  let targetUrl = ''
  if (driveId) {
    // Strip any trailing params or whitespace; only base64url/alphanumeric characters allowed
    const cleanId = driveId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
    if (!cleanId) {
      return NextResponse.json({ error: 'Invalid Google Drive ID' }, { status: 400 })
    }
    targetUrl = `https://lh3.googleusercontent.com/d/${cleanId}`
  } else if (rawUrl) {
    try {
      const parsed = new URL(decodeURIComponent(rawUrl.trim()))
      // SSRF defense: enforce https scheme only
      if (parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only secure HTTPS image URLs are supported' }, { status: 400 })
      }
      // SSRF defense: enforce host allowlist
      if (!isAllowedHost(parsed.hostname)) {
        return NextResponse.json({ error: 'Image domain not permitted' }, { status: 403 })
      }
      targetUrl = parsed.toString()
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'Missing id or url parameter' }, { status: 400 })
  }

  try {
    // Server-to-server fetch with strict timeout and without user Referer
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'image/avif,image/webp,image/apng,image/*;q=0.8',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      // Fallback: try drive export view URL if direct lh3 stream fails
      if (driveId) {
        const cleanId = driveId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
        const altController = new AbortController()
        const altTimeout = setTimeout(() => altController.abort(), 10000)

        const altRes = await fetch(
          `https://drive.google.com/uc?export=view&id=${encodeURIComponent(cleanId)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'image/*,*/*',
            },
            signal: altController.signal,
          }
        )
        clearTimeout(altTimeout)

        if (altRes.ok) {
          const contentType = (altRes.headers.get('content-type') || 'image/jpeg').split(';')[0].toLowerCase().trim()
          if (!ALLOWED_MIME_TYPES.has(contentType)) {
            return NextResponse.json({ error: 'Invalid media format returned' }, { status: 415 })
          }

          const contentLength = Number(altRes.headers.get('content-length')) || 0
          if (contentLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'Image exceeds maximum allowed size' }, { status: 413 })
          }

          const data = await altRes.arrayBuffer()
          if (data.byteLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'Image exceeds maximum allowed size' }, { status: 413 })
          }

          return new NextResponse(data, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
              'X-Content-Type-Options': 'nosniff',
            },
          })
        }
      }
      return NextResponse.json({ error: 'Image unavailable from provider' }, { status: res.status })
    }

    const rawContentType = res.headers.get('content-type') || 'image/jpeg'
    const contentType = rawContentType.split(';')[0].toLowerCase().trim()

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Only valid raster image formats are allowed' }, { status: 415 })
    }

    // Check Content-Length if reported
    const reportedLength = Number(res.headers.get('content-length')) || 0
    if (reportedLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image exceeds maximum allowed size' }, { status: 413 })
    }

    const data = await res.arrayBuffer()
    if (data.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image exceeds maximum allowed size' }, { status: 413 })
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Image proxy fetch error:', error)
    return NextResponse.json({ error: 'Failed to retrieve image' }, { status: 500 })
  }
}
