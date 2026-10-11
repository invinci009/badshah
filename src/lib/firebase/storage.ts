import 'server-only'
import { getAdminStorage } from './admin'
import { createClient } from '@supabase/supabase-js'

// ==============================================================================
// Storage Helpers
// ==============================================================================
// Supports Supabase Storage (primary) and Firebase Storage (secondary/fallback).
// ==============================================================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * Upload a file to storage and return its public URL.
 */
export async function uploadFile(
  path: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '')

  // 1. Try Supabase storage if available
  const sb = getSupabaseAdmin()
  if (sb) {
    try {
      const bucketName = 'menu-items'
      const { error } = await sb.storage
        .from(bucketName)
        .upload(cleanPath, data, { contentType, upsert: true })

      if (!error) {
        const { data: pub } = sb.storage.from(bucketName).getPublicUrl(cleanPath)
        if (pub?.publicUrl) return pub.publicUrl
      } else {
        console.warn('Supabase storage upload error, trying Firebase:', error.message)
      }
    } catch (sbErr) {
      console.warn('Supabase storage upload exception:', sbErr)
    }
  }

  // 2. Try Firebase Storage
  try {
    const bucket = getAdminStorage().bucket()
    const file = bucket.file(cleanPath)

    await file.save(data, {
      metadata: {
        contentType,
      },
    })

    await file.makePublic().catch(() => {})
    return `https://storage.googleapis.com/${bucket.name}/${cleanPath}`
  } catch (fbErr) {
    console.error('Firebase storage upload error:', fbErr)
  }

  throw new Error('Storage service unavailable. Please check that Supabase storage credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) or Firebase Storage are configured.')
}

/**
 * Delete a file from Storage.
 */
export async function deleteFile(path: string): Promise<void> {
  const cleanPath = path.replace(/^\/+/, '')
  const sb = getSupabaseAdmin()
  if (sb) {
    try {
      await sb.storage.from('menu-items').remove([cleanPath])
      return
    } catch (e) {
      console.warn('Supabase delete error:', e)
    }
  }

  try {
    const bucket = getAdminStorage().bucket()
    const file = bucket.file(cleanPath)
    await file.delete()
  } catch (e) {
    console.warn('Firebase delete error:', e)
  }
}

/**
 * Check if a file exists in Storage.
 */
export async function fileExists(path: string): Promise<boolean> {
  const cleanPath = path.replace(/^\/+/, '')
  const sb = getSupabaseAdmin()
  if (sb) {
    try {
      const dir = cleanPath.includes('/') ? cleanPath.substring(0, cleanPath.lastIndexOf('/')) : ''
      const filename = cleanPath.split('/').pop() || cleanPath
      const { data } = await sb.storage.from('menu-items').list(dir)
      if (data?.some((f) => f.name === filename)) return true
    } catch (e) {
      console.warn('Supabase exists check error:', e)
    }
  }

  try {
    const bucket = getAdminStorage().bucket()
    const file = bucket.file(cleanPath)
    const [exists] = await file.exists()
    return exists
  } catch {
    return false
  }
}

/**
 * Get a public URL for a file.
 */
export function getPublicUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '')
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (sbUrl) {
    return `${sbUrl}/storage/v1/object/public/menu-items/${cleanPath}`
  }
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  return `https://storage.googleapis.com/${bucketName}/${cleanPath}`
}

/**
 * Generate a signed URL for temporary access.
 */
export async function getSignedUrl(path: string, expiresInMinutes = 60): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '')
  const sb = getSupabaseAdmin()
  if (sb) {
    const { data } = await sb.storage
      .from('menu-items')
      .createSignedUrl(cleanPath, expiresInMinutes * 60)
    if (data?.signedUrl) return data.signedUrl
  }

  const bucket = getAdminStorage().bucket()
  const file = bucket.file(cleanPath)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  })
  return url
}
