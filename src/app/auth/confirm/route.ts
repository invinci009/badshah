import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawNext = searchParams.get('next') || '/reset-password'
  // Defend against Open Redirect (CWE-601): require safe relative path, disallow protocol-relative URLs (//)
  const safeNext =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes(':') && !rawNext.includes('\\')
      ? rawNext
      : '/reset-password'

  const proto = request.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000').toLowerCase().trim()
  const isAllowedHost =
    host === 'localhost:3000' ||
    host === '127.0.0.1:3000' ||
    host.endsWith('.vercel.app') ||
    (process.env.APP_DOMAIN && host === process.env.APP_DOMAIN.toLowerCase().trim())

  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (isAllowedHost ? `${proto}://${host}` : process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : 'http://localhost:3000')
  ).replace(/\/$/, '')

  // Firebase Auth handles email confirmation via its own flow
  // This route is kept for backward compatibility with old Supabase links
  return NextResponse.redirect(
    `${origin}${safeNext}?error_code=otp_expired&error_description=${encodeURIComponent(
      'This link is from an old system. Please use the password reset option in the login page.'
    )}`
  )
}
