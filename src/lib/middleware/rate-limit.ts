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

  // Periodic pruning of expired entries
  if (memoryLimiterStore.size > 1500) {
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
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'client'

  // Determine rate limits and isolated bucket key based on action type
  // Public catalog reads have high capacity to support 400+ guests sharing the restaurant Wi-Fi IP
  let maxRequests = 120
  let category = 'general'
  const windowMs = 60_000 // 1 minute

  if (pathname.includes('/orders') && method === 'POST') {
    // Order creation: limit to 25 per minute per IP to prevent spam submissions
    maxRequests = 25
    category = 'order-create'
  } else if (pathname.includes('/service-requests') && method === 'POST') {
    // Waiter service requests: limit to 15 per minute per IP
    maxRequests = 15
    category = 'service-create'
  } else if (pathname.includes('/loyalty/auth') || pathname.includes('/loyalty/claim')) {
    // Loyalty auth/claim attempts: limit to 30 per minute
    maxRequests = 30
    category = 'loyalty-auth'
  } else if (pathname.startsWith('/api/business/')) {
    // Business dashboard routes: max 300 per minute
    maxRequests = 300
    category = 'business'
  } else if (pathname === '/api/public/order-menu' || pathname.startsWith('/api/public/order-menu')) {
    // Public menu & catalog reads: High capacity (1200 per minute per IP)
    // Critical: Supports 400+ concurrent diners sharing the restaurant's guest Wi-Fi NAT IP
    maxRequests = 1200
    category = 'menu-catalog'
  } else if (pathname.startsWith('/api/public/orders/') && method === 'GET') {
    // Order tracking & SSE stream: 300 per minute per IP
    maxRequests = 300
    category = 'order-track'
  } else if (pathname.startsWith('/api/public/')) {
    // General public queries (tables, settings): 300 per minute per IP
    maxRequests = 300
    category = 'public-general'
  }

  const memoryKey = `${ip}:${category}`

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
