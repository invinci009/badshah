import 'server-only'
import type { NextRequest } from 'next/server'
import { getAdminAuth } from './admin'

// ==============================================================================
// Firebase Auth Helpers
// ==============================================================================
// Server-side authentication helpers for dashboard users.
// ==============================================================================

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  emailVerified: boolean
}

/**
 * Validate a Firebase ID token and return the user info.
 * Use this in API routes to authenticate dashboard requests.
 */
export async function validateSession(token: string): Promise<AuthUser | null> {
  if (!token || typeof token !== 'string') return null
  const auth = getAdminAuth()

  // 1. First verify as a long-lived Firebase session cookie (up to 14 days)
  try {
    const decoded = await auth.verifySessionCookie(token, false)
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      emailVerified: decoded.email_verified || false,
    }
  } catch {
    // Session cookie verification failed, fall back to ID token
  }

  // 2. Fall back to standard Firebase ID token
  try {
    const decoded = await auth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      displayName: decoded.name || null,
      emailVerified: decoded.email_verified || false,
    }
  } catch {
    return null
  }
}

/**
 * Extract the session from an incoming request.
 * Accepts `Authorization: Bearer <token>` OR the `firebase_token` cookie
 * (dashboard client components rely on the httpOnly cookie — they never
 * send an Authorization header, and <img> tags can't either).
 */
export async function getSessionFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.cookies.get('firebase_token')?.value
  if (!idToken) return null
  return validateSession(idToken)
}

/**
 * Create a custom session token for a user.
 * This can be used to create session cookies after Firebase Auth login.
 */
export async function createSessionToken(uid: string, expiresIn = 60 * 60 * 24 * 7): Promise<string> {
  const auth = getAdminAuth()
  return auth.createCustomToken(uid, {
    expiresIn,
  })
}

/**
 * Get or create a user by email.
 * Useful for first-time dashboard setup.
 */
export async function getOrCreateUser(email: string, password: string): Promise<AuthUser> {
  const auth = getAdminAuth()
  try {
    const user = await auth.getUserByEmail(email)
    return {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      emailVerified: user.emailVerified,
    }
  } catch {
    // User doesn't exist, create them
    const user = await auth.createUser({
      email,
      password,
      emailVerified: false,
    })
    return {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      emailVerified: false,
    }
  }
}

/**
 * Update a user's password.
 */
export async function updateUserPassword(uid: string, newPassword: string): Promise<void> {
  const auth = getAdminAuth()
  await auth.updateUser(uid, { password: newPassword })
}

/**
 * Delete a user.
 */
export async function deleteUser(uid: string): Promise<void> {
  const auth = getAdminAuth()
  await auth.deleteUser(uid)
}
