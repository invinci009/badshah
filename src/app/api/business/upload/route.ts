import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { uploadFile } from '@/lib/firebase/storage'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
])

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

    if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
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

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30)
    const filePath = `menu-items/${Date.now()}-${safeBase}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const url = await uploadFile(filePath, buffer, file.type)

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
