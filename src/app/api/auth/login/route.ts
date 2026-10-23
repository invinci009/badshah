import { NextRequest, NextResponse } from 'next/server'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { getServerAuth } from '@/lib/firebase/server-auth'
import { resolveAdminEmail } from '@/lib/auth-helpers'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 400 }
      )
    }

    const { password } = parsed.data

    // Resolve aliases (admin/owner/manager/staff) to the configured owner email
    const resolvedEmail = resolveAdminEmail(parsed.data.email) ?? parsed.data.email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 400 }
      )
    }

    // Sign in with Firebase Auth (server-side client SDK — never import
    // '@/lib/firebase/client' here, it has a 'use client' directive)
    const auth = getServerAuth()
    const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail, password)

    // Get fresh ID token
    const idToken = await userCredential.user.getIdToken()

    // Mint a long-lived 14-day Firebase session cookie (14 days = 14 * 24 * 60 * 60 * 1000 ms)
    const expiresIn = 1000 * 60 * 60 * 24 * 14 // 14 days
    let sessionCookie = idToken
    try {
      const { getAdminAuth } = await import('@/lib/firebase/admin')
      sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn })
    } catch (sessionErr) {
      console.warn('Could not create Firebase session cookie, using idToken fallback:', sessionErr)
    }

    // Set session response
    const response = NextResponse.json({
      success: true,
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
      },
    })

    // Set Firebase token cookie (14 days)
    response.cookies.set('firebase_token', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14, // 14 days
    })

    return response
  } catch (error) {
    console.error('Login error:', error)

    // Map Firebase error codes to user-friendly messages
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code: unknown }).code
      : undefined
    let errorMessage = 'Invalid login credentials. Please try again.'

    if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
      errorMessage = 'Invalid email or password.'
    } else if (errorCode === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later.'
    } else if (errorCode === 'auth/invalid-credential') {
      errorMessage = 'Invalid email or password.'
    }

    return NextResponse.json({ error: errorMessage }, { status: 401 })
  }
}
