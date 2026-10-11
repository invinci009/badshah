import 'server-only'
import { randomUUID } from 'crypto'
import { getAdminStorage } from './admin'

// ==============================================================================
// Firebase Storage Helpers (Images & Assets)
// ==============================================================================

function getStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()
  if (!bucketName) {
    throw new Error(
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set. Please add your Firebase Storage bucket name.'
    )
  }
  return getAdminStorage().bucket(bucketName)
}

/**
 * Upload a file to Firebase Storage and return its public URL.
 */
export async function uploadFile(
  path: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '')
  const bucket = getStorageBucket()
  const file = bucket.file(cleanPath)
  const downloadToken = randomUUID()

  try {
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

    // Firebase Storage persistent download URL
    const encodedPath = encodeURIComponent(cleanPath)
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`
  } catch (error: unknown) {
    console.error('Firebase storage upload error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('bucket does not exist') || (error as { code?: number })?.code === 404) {
      throw new Error(
        `Firebase Storage bucket "${bucket.name}" does not exist. Please go to Firebase Console > Build > Storage and click "Get started" to initialize it.`
      )
    }
    throw new Error(`Firebase Storage error: ${msg}`)
  }
}

/**
 * Delete a file from Firebase Storage.
 */
export async function deleteFile(path: string): Promise<void> {
  const cleanPath = path.replace(/^\/+/, '')
  try {
    const bucket = getStorageBucket()
    const file = bucket.file(cleanPath)
    await file.delete()
  } catch (err) {
    console.warn('Firebase storage delete warning:', err)
  }
}

/**
 * Check if a file exists in Firebase Storage.
 */
export async function fileExists(path: string): Promise<boolean> {
  const cleanPath = path.replace(/^\/+/, '')
  try {
    const bucket = getStorageBucket()
    const file = bucket.file(cleanPath)
    const [exists] = await file.exists()
    return exists
  } catch {
    return false
  }
}

/**
 * Get a public URL for a file in Firebase Storage.
 */
export function getPublicUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '')
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || 'default'
  const encodedPath = encodeURIComponent(cleanPath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`
}

/**
 * Generate a signed URL for temporary access to a Firebase Storage file.
 */
export async function getSignedUrl(path: string, expiresInMinutes = 60): Promise<string> {
  const cleanPath = path.replace(/^\/+/, '')
  const bucket = getStorageBucket()
  const file = bucket.file(cleanPath)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  })
  return url
}
