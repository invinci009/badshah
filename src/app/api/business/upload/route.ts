import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { uploadFile } from '@/lib/firebase/storage'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const mimeType = file.type.toLowerCase().trim()
    const safeExt = MIME_TO_EXT[mimeType]
    if (!safeExt) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, GIF, or SVG image.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds limit. Maximum allowed size is 5MB.' },
        { status: 400 }
      )
    }

    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30)
    const filePath = `menu-items/${Date.now()}-${safeBase || 'image'}.${safeExt}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Security: Sanitize SVG files to eliminate Stored XSS vectors
    if (mimeType === 'image/svg+xml') {
      const svgText = buffer.toString('utf8').toLowerCase()
      if (
        svgText.includes('<script') ||
        svgText.includes('javascript:') ||
        svgText.includes('onload') ||
        svgText.includes('onerror') ||
        svgText.includes('onclick') ||
        svgText.includes('<foreignobject') ||
        svgText.includes('<!entity')
      ) {
        return NextResponse.json(
          { error: 'SVG contains forbidden executable scripts or event handlers' },
          { status: 400 }
        )
      }
    }

    const url = await uploadFile(filePath, buffer, mimeType)

    return NextResponse.json(
      {
        success: true,
        url,
        name: file.name,
        size: file.size,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Menu image upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    )
  }
}
