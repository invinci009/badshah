import 'server-only'
import crypto from 'crypto'

// ==============================================================================
// Ordering tokens — opaque, revocable, server-validated
// Table QR tokens and customer order access tokens.
// Plaintext tokens are stored ONLY in admin-only Firestore docs (Admin SDK
// access); lookups use the SHA-256 hash. Plaintext never goes in logs.
// ==============================================================================

export function generateTableToken(): string {
  return `tbl_${crypto.randomBytes(24).toString('hex')}`
}

export function generateOrderAccessToken(): string {
  return `ord_${crypto.randomBytes(24).toString('hex')}`
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Constant-time comparison of a presented token against a stored hash. */
export function verifyTokenAgainstHash(presented: string, storedHash: string): boolean {
  const presentedHash = hashToken(presented)
  const a = Buffer.from(presentedHash, 'hex')
  const b = Buffer.from(storedHash, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 12)
}
