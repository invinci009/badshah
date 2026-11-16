import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail } from 'firebase/auth'
import { getServerAuth } from '@/lib/firebase/server-auth'
import { resolveAdminEmail } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { username } = body

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username or email is required' },
        { status: 400 }
      )
    }

    const resolvedEmail = resolveAdminEmail(username) || username.trim()

    // Send password reset email via Firebase Auth (server-side client SDK —
    // never import '@/lib/firebase/client' here, it has 'use client').
    // actionCodeSettings routes the email link to OUR /reset-password page
    // (with ?oobCode=...) instead of Firebase's default handler, so the new
    // password is set inside this app and verified by Firebase's oobCode.
    // Safe origin resolution: prioritize explicit application URL to protect against Host-Header Poisoning
    let safeOrigin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    if (!safeOrigin) {
      const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').toLowerCase().trim()
      const isAllowedHost =
        host === 'localhost:3000' ||
        host === '127.0.0.1:3000' ||
        host.endsWith('.vercel.app') ||
        (process.env.APP_DOMAIN && host === process.env.APP_DOMAIN.toLowerCase().trim())

      if (isAllowedHost) {
        const proto = request.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
        safeOrigin = `${proto}://${host}`
      } else {
        safeOrigin = process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : 'http://localhost:3000'
      }
    }
    const continueUrl = `${safeOrigin}/reset-password`
    const auth = getServerAuth()
    await sendPasswordResetEmail(auth, resolvedEmail, {
      url: continueUrl,
      handleCodeInApp: true,
    })

    return NextResponse.json({
      success: true,
      message: `Password reset instructions sent to ${resolvedEmail}. Please check your email inbox (and Spam/Junk folder).`,
    })
  } catch (error) {
    console.error('Password reset error:', error)

    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code: unknown }).code
      : undefined
    let errorMessage = 'Failed to send reset link.'

    if (errorCode === 'auth/user-not-found') {
      // Don't reveal if user exists for security
      return NextResponse.json({
        success: true,
        message: 'If an account exists for this email, a reset link has been sent.',
      })
    } else if (errorCode === 'auth/too-many-requests') {
      errorMessage = 'Too many reset attempts. Please wait a few minutes before trying again.'
      return NextResponse.json({ error: errorMessage }, { status: 429 })
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
