import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse, type NextRequest } from 'next/server'

// ==============================================================================
// Multi-Tier Rate Limiting & Load Shedding
// Protects Firestore quotas by enforcing strict per-IP rate limits:
// 1. Upstash Redis (if configured)
// 2. High-performance In-Memory Sliding Window (built-in fallback)
// Prevents bot scans, DDoS, order flooding, and infinite loops from exhausting read/write limits.
// ==============================================================================

let ratelimit: Ratelimit | null = null

function isPlaceholderOrInvalid(val?: string): boolean {
  if (!val) return true
  const lower = val.toLowerCase()
  return (
    lower.includes('placeholder') ||
    lower.includes('your-redis') ||
    lower.includes('your-upstash') ||
    lower.includes('example.com')
  )
}

function getUpstashLimiter(): Ratelimit | null {
  if (ratelimit) return ratelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (isPlaceholderOrInvalid(url) || isPlaceholderOrInvalid(token)) {
    return null
  }

  try {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: false,
      prefix: 'badshah:ratelimit',
    })
    return ratelimit
  } catch {
    return null
  }
}

// ------------------------------------------------------------------------------
// In-Memory Sliding Window Rate Limiter
// Thread-safe per Next.js worker. Ensures rate limiting works unconditionally.
// ------------------------------------------------------------------------------
interface RateLimitBucket {
  count: number
  resetAt: number
}

const memoryLimiterStore = new Map<string, RateLimitBucket>()

function checkMemoryLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const bucket = memoryLimiterStore.get(key)

  if (!bucket || now >= bucket.resetAt) {
    const newReset = now + windowMs
    memoryLimiterStore.set(key, { count: 1, resetAt: newReset })
    return { success: true, remaining: limit - 1, reset: newReset }
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, reset: bucket.resetAt }
  }

  bucket.count++
  const remaining = Math.max(0, limit - bucket.count)

  // Periodic pruning of expired entries (supports up to 25,000 active concurrent users)
  if (memoryLimiterStore.size > 25000) {
    for (const [k, v] of memoryLimiterStore.entries()) {
      if (v.resetAt <= now) {
        memoryLimiterStore.delete(k)
      }
    }
  }

  return { success: true, remaining, reset: bucket.resetAt }
}

export async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
  // 1. In local development or testing, never throttle developer activity
  if (process.env.NODE_ENV === 'development') {
    return null
  }

  const { pathname } = request.nextUrl
  const method = request.method
  // Prioritize Cloudflare's authenticated CF-Connecting-IP to prevent IP spoofing via forged X-Forwarded-For
  const ip =
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'client'

  // Extract session token or table identifier to prevent restaurant-wide NAT Wi-Fi false throttling
  const sessionToken =
    request.cookies.get('badshah_vip_session')?.value ||
    request.cookies.get('rp_table_session')?.value ||
    request.headers.get('x-table-id') ||
    request.headers.get('x-session-id') ||
    ''

  // Determine rate limits and isolated bucket key based on action type
  // High capacity guarantees seamless service for 10k+ daily users and 100+ concurrent orders on restaurant Wi-Fi
  let maxRequests = 120
  let category = 'general'
  const windowMs = 60_000 // 1 minute

  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/reset-password') || pathname.startsWith('/api/auth/change-password')) {
    // Admin login, password reset, and change-password brute-force defense
    maxRequests = 10
    category = 'admin-auth'
  } else if (pathname.startsWith('/api/auth/')) {
    // General auth actions (session check, logout)
    maxRequests = 60
    category = 'auth-general'
  } else if (pathname.includes('/orders') && method === 'POST') {
    // Order creation: 300/min per IP to support 100+ concurrent diners on shared Wi-Fi
    maxRequests = 300
    category = 'order-create'
  } else if (pathname.includes('/service-requests') && method === 'POST') {
    // Waiter service requests: 150/min per IP
    maxRequests = 150
    category = 'service-create'
  } else if (pathname.includes('/loyalty/auth') || pathname.includes('/loyalty/claim')) {
    // Loyalty auth/claim attempts: 60/min
    maxRequests = 60
    category = 'loyalty-auth'
  } else if (pathname.startsWith('/api/business/')) {
    // Business dashboard routes: max 600 per minute
    maxRequests = 600
    category = 'business'
  } else if (pathname === '/api/public/order-menu' || pathname.startsWith('/api/public/order-menu')) {
    // Public menu & catalog reads: High capacity (3000 per minute per IP)
    // Critical: Supports 1,000+ concurrent diners browsing dishes simultaneously on restaurant Wi-Fi
    maxRequests = 3000
    category = 'menu-catalog'
  } else if (pathname.startsWith('/api/public/orders/') && method === 'GET') {
    // Order tracking & SSE stream: 600 per minute per IP
    maxRequests = 600
    category = 'order-track'
  } else if (pathname.startsWith('/api/public/')) {
    // General public queries (tables, settings): 600 per minute per IP
    maxRequests = 600
    category = 'public-general'
  }

  const sessionSuffix = sessionToken ? `:${sessionToken.slice(0, 16)}` : ''
  const memoryKey = `${ip}${sessionSuffix}:${category}`

  const limiter = getUpstashLimiter()
  if (limiter) {
    try {
      const timeoutPromise = new Promise<{ success: boolean; remaining: number; reset: number }>((_, reject) =>
        setTimeout(() => reject(new Error('Rate limit timeout')), 600)
      )

      const result = await Promise.race([
        limiter.limit(memoryKey),
        timeoutPromise,
      ])

      if (!result.success) {
        return NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
            },
          }
        )
      }
      return null
    } catch {
      // If Redis times out, fall through to in-memory limiter
    }
  }

  // Use In-Memory sliding window
  const { success, remaining, reset } = checkMemoryLimit(memoryKey, maxRequests, windowMs)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'Retry-After': Math.max(1, Math.ceil((reset - Date.now()) / 1000)).toString(),
        },
      }
    )
  }

  return null
}
