import 'server-only'
import crypto from 'crypto'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'rp_session'
let cachedSessionSecret: Uint8Array | null = null

function getSecret(): Uint8Array {
  const explicit = process.env.SESSION_COOKIE_SECRET
  if (explicit && explicit.length >= 16) {
    return new TextEncoder().encode(crypto.createHash('sha256').update(explicit).digest('hex'))
  }
  const serverPrivate = process.env.FIREBASE_PRIVATE_KEY
  if (serverPrivate) {
    return new TextEncoder().encode(
      crypto.createHash('sha256').update(`${serverPrivate}::rp-session-secret`).digest('hex')
    )
  }
  if (!cachedSessionSecret) {
    cachedSessionSecret = new TextEncoder().encode(crypto.randomBytes(32).toString('hex'))
  }
  return cachedSessionSecret
}

export interface SessionPayload extends JWTPayload {
  session_id: string
  campaign_id: string
  business_id: string
}

export async function signSessionCookie(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifySessionCookie(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionCookie(token)
}

export async function setSessionCookie(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<void> {
  const token = await signSessionCookie(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
  })
}
