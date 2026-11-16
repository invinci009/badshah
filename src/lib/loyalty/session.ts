import 'server-only'
import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'

// ==============================================================================
// Customer loyalty session (signed JWT cookie, `rp_customer_session`).
// Separate from the admin `rp_session`/`firebase_token` cookies — customers
// authenticate with mobile + password, admins with Firebase Auth.
// ==============================================================================

export const CUSTOMER_SESSION_COOKIE = 'rp_customer_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

interface CustomerSessionPayload {
  customerId: string // 10-digit phone
  name: string
  verified: boolean
}

let cachedEphemeralSecret: Uint8Array | null = null

function getSecret(): Uint8Array {
  // 1. Explicit dedicated secret
  const explicit = process.env.CUSTOMER_SESSION_SECRET
  if (explicit && explicit.length >= 16) {
    return new TextEncoder().encode(crypto.createHash('sha256').update(explicit).digest('hex'))
  }
  // 2. Server-only private credential derivation (never client-visible)
  const serverPrivate = process.env.FIREBASE_PRIVATE_KEY || process.env.SESSION_COOKIE_SECRET
  if (serverPrivate) {
    return new TextEncoder().encode(
      crypto.createHash('sha256').update(`${serverPrivate}::loyalty-customer-session`).digest('hex')
    )
  }
  // 3. High-entropy in-memory secret generated on server boot to prevent external token forgery
  if (!cachedEphemeralSecret) {
    cachedEphemeralSecret = new TextEncoder().encode(crypto.randomBytes(32).toString('hex'))
  }
  return cachedEphemeralSecret
}

export async function createCustomerSessionToken(payload: CustomerSessionPayload): Promise<string> {
  return new SignJWT({
    c: payload.customerId,
    n: payload.name,
    v: payload.verified,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyCustomerSessionToken(token: string): Promise<CustomerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    const customerId = payload['c']
    if (typeof customerId !== 'string' || !/^\d{10}$/.test(customerId)) return null
    return {
      customerId,
      name: typeof payload['n'] === 'string' ? payload['n'] : '',
      verified: payload['v'] === true,
    }
  } catch {
    return null
  }
}

/** Reads the session cookie from a RouteHandler request (or via cookies() when omitted). */
export async function getCustomerSession(request?: Request): Promise<CustomerSessionPayload | null> {
  let token: string | undefined
  if (request) {
    token = request.headers
      .get('cookie')
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${CUSTOMER_SESSION_COOKIE}=`))
      ?.slice(CUSTOMER_SESSION_COOKIE.length + 1)
  } else {
    try {
      const { cookies } = await import('next/headers')
      token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
    } catch {
      return null
    }
  }
  if (!token) return null
  return verifyCustomerSessionToken(decodeURIComponent(token))
}

export function customerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}
