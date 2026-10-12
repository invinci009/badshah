import 'server-only'
import { randomUUID } from 'crypto'
import { getAdminStorage } from './admin'

// ==============================================================================
// Resilient Storage Engine (Firebase Storage + Supabase Storage Fallback)
// Ensures menu item images and assets upload reliably without failing if
// Firebase Storage is not yet initialized or exceeds free tier quotas.
// ==============================================================================

function getStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()
  if (!bucketName) {
    throw new Error(
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set.'
    )
  }
  return getAdminStorage().bucket(bucketName)
}

/**
 * Upload to Supabase Storage as a resilient zero-quota-cost fallback.
 */
async function uploadToSupabaseStorage(
  cleanPath: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase storage credentials not configured')
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)
  const bucketName = 'menu-items'

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(cleanPath, data, { contentType, upsert: true })

  if (error) {
    throw new Error(`Supabase Storage upload error: ${error.message}`)
  }

  const { data: pubData } = supabase.storage.from(bucketName).getPublicUrl(cleanPath)
  return pubData.publicUrl
}

/**
 * Upload a file to Storage (Firebase Storage first, with resilient Supabase fallback).
 */
export async function uploadFile(
  path: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '')

  // 1. Try Firebase Storage if bucket is reachable
  try {
    const bucket = getStorageBucket()
    const file = bucket.file(cleanPath)
    const downloadToken = randomUUID()

    await file.save(data, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    })

    // Attempt public access for standard GCS ACLs if allowed
    await file.makePublic().catch(() => {})

    const encodedPath = encodeURIComponent(cleanPath)
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`
  } catch (error: unknown) {
    console.warn(
      'Firebase Storage unavailable or uninitialized. Falling back to Supabase Storage...',
      error instanceof Error ? error.message : error
    )

    // 2. Resilient fallback to Supabase Storage
    try {
      const fallbackUrl = await uploadToSupabaseStorage(cleanPath, data, contentType)
      console.log('Successfully uploaded via fallback storage:', fallbackUrl)
      return fallbackUrl
    } catch (fallbackError: unknown) {
      console.error('All storage options failed:', fallbackError)
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`Upload failed: ${msg}`)
    }
  }
}

/**
 * Delete a file from Storage.
 */
export async function deleteFile(path: string): Promise<void> {
  const cleanPath = path.replace(/^\/+/, '')
  try {
    const bucket = getStorageBucket()
    const file = bucket.file(cleanPath)
    await file.delete().catch(() => {})
  } catch (err) {
    console.warn('Firebase storage delete warning:', err)
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      await supabase.storage.from('menu-items').remove([cleanPath])
    }
  } catch (err) {
    console.warn('Supabase storage delete warning:', err)
  }
}

/**
 * Check if a file exists in Storage.
 */
export async function fileExists(path: string): Promise<boolean> {
  const cleanPath = path.replace(/^\/+/, '')
  try {
    const bucket = getStorageBucket()
    const file = bucket.file(cleanPath)
    const [exists] = await file.exists()
    if (exists) return true
  } catch {
    // continue
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.storage.from('menu-items').list('', { search: cleanPath })
      return Boolean(data && data.length > 0)
    }
  } catch {
    // continue
  }

  return false
}

/**
 * Get a public URL for a file.
 */
export function getPublicUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '')
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || 'default'
  const encodedPath = encodeURIComponent(cleanPath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`
}

/**
 * Generate a signed URL for temporary access to a file.
 */
export async function getSignedUrl(path: string, expiresInMinutes = 60): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '')
  try {
    const bucket = getStorageBucket()
    const file = bucket.file(cleanPath)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    })
    return url
  } catch {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.storage
        .from('menu-items')
        .createSignedUrl(cleanPath, expiresInMinutes * 60)
      if (data?.signedUrl) return data.signedUrl
    }
    return getPublicUrl(path)
  }
}

