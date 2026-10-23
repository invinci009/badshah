import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/firebase/auth'

// GET /api/auth/session — Silent session heartbeat & auto-extension
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionFromRequest(request)
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }

    const currentToken = request.cookies.get('firebase_token')?.value
    const response = NextResponse.json({
      authenticated: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      },
    })

    // If session is valid, touch the cookie to extend maxAge by another 14 days
    if (currentToken) {
      response.cookies.set('firebase_token', currentToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 14, // 14 days
      })
    }

    return response
  } catch (error) {
    console.error('Session heartbeat error:', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
}
