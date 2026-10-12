import { NextRequest, NextResponse } from 'next/server'

// ==============================================================================
// High-Speed Image Proxy & Stream Cache for Google Drive & External Media
// Bypasses Google Drive hotlinking / Referer blocks and caches images for 7 days.
// ==============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driveId = searchParams.get('id') || searchParams.get('driveId')
  const rawUrl = searchParams.get('url')

  let targetUrl = ''
  if (driveId) {
    // Strip any trailing params or whitespace
    const cleanId = driveId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
    targetUrl = `https://lh3.googleusercontent.com/d/${cleanId}`
  } else if (rawUrl) {
    targetUrl = decodeURIComponent(rawUrl.trim())
  } else {
    return NextResponse.json({ error: 'Missing id or url parameter' }, { status: 400 })
  }

  try {
    // Server-to-server fetch without browser Referer headers (prevents Google 429 hotlink blocks)
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!res.ok) {
      // Fallback: try drive export view URL if direct stream fails
      if (driveId) {
        const altRes = await fetch(
          `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'image/*,*/*',
            },
          }
        )
        if (altRes.ok) {
          const contentType = altRes.headers.get('content-type') || 'image/jpeg'
          const data = await altRes.arrayBuffer()
          return new NextResponse(data, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
            },
          })
        }
      }
      return NextResponse.json({ error: 'Image unavailable from provider' }, { status: res.status })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const data = await res.arrayBuffer()

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    })
  } catch (error) {
    console.error('Image proxy fetch error:', error)
    return NextResponse.json({ error: 'Failed to retrieve image' }, { status: 500 })
  }
}
