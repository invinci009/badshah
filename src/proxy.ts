import { NextResponse, type NextRequest } from 'next/server'
import { botFilterMiddleware } from '@/lib/middleware/bot-filter'
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit'

// NOTE: Do NOT import firebase-admin / validateSession here.
// proxy.ts runs on the Edge runtime on Vercel — firebase-admin needs
// Node.js APIs (cert, Buffer, gRPC) and `server-only`, so importing it
// crashes with "A server error occurred" on every matched route.
// This layer only checks token *presence*; full verification happens
// in server components / API routes via validateSession().

// ==============================================================================
// ReviewPulse — Proxy (Next.js 16 Middleware)
// ==============================================================================
// Handles bot filtering, rate limiting, and authentication checks.
// In Next.js 16, middleware.ts has been renamed to proxy.ts.
// ==============================================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Bot filter for customer routes (cheapest check first)
  if (pathname.startsWith('/r/') || pathname.startsWith('/order/') || pathname.startsWith('/api/public/')) {
    const botResponse = botFilterMiddleware(request)
    if (botResponse) return botResponse
  }

  // 2. Rate limiting for public API routes
  if (pathname.startsWith('/api/public/')) {
    const rateLimitResponse = await rateLimitMiddleware(request)
    if (rateLimitResponse) return rateLimitResponse
  }

  // 3. Firebase Auth session check for dashboard routes
  const response = NextResponse.next({ request: { headers: request.headers } })

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/dashboard')) {
    // Edge-safe: presence check only. Full ID-token verification happens
    // downstream in the page / route handler (Node runtime).
    const authHeader = request.headers.get('authorization')
    const idToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : request.cookies.get('firebase_token')?.value

    if (!idToken) {
      // No token found, redirect to login
      if (pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return response
}

export const config = {
  matcher: [
    '/r/:path*',
    '/order/:path*',
    '/api/public/:path*',
    '/dashboard/:path*',
    '/api/dashboard/:path*',
  ],
}
