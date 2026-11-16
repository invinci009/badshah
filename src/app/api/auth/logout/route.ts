import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/firebase/auth'
import { getAdminAuth } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  // Revoke session server-side if user is authenticated
  try {
    const user = await getSessionFromRequest(request)
    if (user?.uid) {
      await getAdminAuth().revokeRefreshTokens(user.uid).catch(() => {})
    }
  } catch (err) {
    console.warn('Logout server-side token revocation warning:', err)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('firebase_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}
