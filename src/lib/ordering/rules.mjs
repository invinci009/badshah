/**
 * ReviewPulse Ordering — pure domain rules (dependency-free).
 *
 * Plain JavaScript (no imports) so it can be imported by:
 *  - Next.js TypeScript code (typed via rules.d.ts)
 *  - node:test suites without a build step
 *
 * Money is ALWAYS integer paise. Never use floats for money.
 */

// ---------------------------------------------------------------------------
// Indian phone validation (format-only, NEVER "verified")
// ---------------------------------------------------------------------------

/**
 * Normalize an Indian mobile number.
 * Accepts "98765 43210", "+91-9876543210", "91 9876543210", "09876543210".
 * Returns the 10-digit national number, or null when invalid.
 */
export function normalizeIndianPhone(raw) {
  if (typeof raw !== 'string') return null
  let digits = raw.replace(/\D/g, '')
  // Strip leading 0 trunk prefix
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  // Strip 91 country prefix
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3)
  if (!/^[6-9]\d{9}$/.test(digits)) return null
  return digits
}

export function isValidIndianPhone(raw) {
  return normalizeIndianPhone(raw) !== null
}

/** Mask a phone for customer-facing display: "******3210". Never log full numbers. */
export function maskPhone(phone10) {
  if (typeof phone10 !== 'string' || phone10.length !== 10) return '••••••––––'
  return `••••••${phone10.slice(6)}`
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Format integer paise as INR, e.g. 19900 -> "₹199.00". */
export function formatPaise(paise) {
  const n = Number(paise) || 0
  return `₹${(n / 100).toFixed(2)}`
}

export function isValidPaise(n) {
  return Number.isInteger(n) && n >= 0
}

/**
 * Compute an order quote from authoritative menu data.
 * @param {Array} lines - [{ item, quantity, selections }]
 *   item: { pricePaise }
 *   selections: [{ pricePaise }] flattened chosen option choices
 * @param {number} taxRateBps - e.g. 500 = 5%
 * @param {number} chargePaise - flat service/packaging charge
 * @returns {{ subtotalPaise, taxPaise, chargePaise, totalPaise }}
 */
export function computeQuote(lines, taxRateBps, chargePaise) {
  let subtotal = 0
  for (const line of lines) {
    const unit = line.item.pricePaise + line.selections.reduce((s, o) => s + o.pricePaise, 0)
    subtotal += unit * line.quantity
  }
  const tax = Math.round((subtotal * taxRateBps) / 10000)
  const total = subtotal + tax + chargePaise
  return { subtotalPaise: subtotal, taxPaise: tax, chargePaise, totalPaise: total }
}

// ---------------------------------------------------------------------------
// Fulfilment state machine
// ---------------------------------------------------------------------------

export const FULFILMENT_STATES = ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']

const ALLOWED_TRANSITIONS = {
  RECEIVED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
}

export function isAllowedTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

export function isTerminalFulfilment(state) {
  return state === 'SERVED' || state === 'CANCELLED'
}

// ---------------------------------------------------------------------------
// Payment states (derived, never set directly by clients)
// ---------------------------------------------------------------------------

export const PAYMENT_STATES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED']

/**
 * Derive payment status from recorded amounts.
 * Cancelled orders keep their payment status; a refund status requires a
 * recorded refund entry (callers must enforce that separately).
 */
export function derivePaymentStatus(totalPaise, paidPaise, refundedPaise) {
  if (refundedPaise >= paidPaise && paidPaise > 0) return 'REFUNDED'
  if (refundedPaise > 0) return 'PARTIALLY_REFUNDED'
  if (paidPaise <= 0) return 'UNPAID'
  if (paidPaise >= totalPaise) return 'PAID'
  return 'PARTIALLY_PAID'
}

export function outstandingPaise(totalPaise, paidPaise) {
  return Math.max(0, totalPaise - paidPaise)
}

// ---------------------------------------------------------------------------
// Order numbers
// ---------------------------------------------------------------------------

/** Format a sequential order number, e.g. seq 123 -> "ORD-000123". */
export function formatOrderNumber(seq) {
  return `ORD-${String(seq).padStart(6, '0')}`
}
