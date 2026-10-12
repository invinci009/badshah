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
  const { pathname } = request.nextUrl
  const method = request.method
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown-client'

  // Determine rate limits based on action type to protect Firestore writes and reads
  let maxRequests = 60
  const windowMs = 60_000 // 1 minute

  if (pathname.includes('/orders') && method === 'POST') {
    // Order creation: limit to 15 per minute per IP to prevent spam submissions
    maxRequests = 15
  } else if (pathname.includes('/service-requests') && method === 'POST') {
    // Waiter service requests: limit to 10 per minute per IP
    maxRequests = 10
  } else if (pathname.startsWith('/api/business/')) {
    // Business dashboard routes: max 120 per minute
    maxRequests = 120
  } else if (pathname.startsWith('/api/public/')) {
    // Public queries & catalog reads: max 60 per minute per IP
    maxRequests = 60
  }

  const limiter = getUpstashLimiter()

  if (limiter) {
    try {
      const timeoutPromise = new Promise<{ success: boolean; remaining: number; reset: number }>((_, reject) =>
        setTimeout(() => reject(new Error('Rate limit timeout')), 600)
      )

      const result = await Promise.race([
        limiter.limit(`${ip}:${pathname}`),
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
  const memoryKey = `${ip}:${pathname.startsWith('/api/public/orders') ? 'order' : 'general'}`
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
