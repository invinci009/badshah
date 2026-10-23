import 'server-only'
import crypto from 'crypto'
import type { Firestore } from 'firebase-admin/firestore'
import { getAdminFirestore } from './admin'
import { getCached, invalidateCache } from '../cache'

// ==============================================================================
// Loyalty & Rewards persistence (Firestore, Admin SDK, server-only).
// Single-restaurant deployment: docs carry restaurantId: 'default'.
//
// Money in integer paise. Points are NON-NEGATIVE integers.
//
// Point model: each loyalty account keeps an expiry-schedule of "buckets".
// Every earn adds a bucket { points, remaining, expiresAt? }. Every redemption
// consumes points oldest-first (reduces bucket.remaining), so leftover points
// keep their original expiry. Expiry is processed lazily inside transactions
// (sweep) - expired remainders never count and are recorded in the ledger.
//
// Every balance change writes an audit transaction to `loyaltyTransactions`,
// so the displayed balance is always reconstructible:
//   EARN | REDEEM | EXPIRE | REVERSE (earn reversal) | RESTORE (redemption
//   restore) | ADJUST (manual admin).
// ==============================================================================

function getDb(): Firestore {
  return getAdminFirestore()
}

const RESTAURANT_ID = 'default'
const serverNow = () => new Date().toISOString()

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v
  }
  return clean as T
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoyaltyTransactionType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'REVERSE' | 'RESTORE' | 'ADJUST'

export interface LoyaltyBucket {
  /** Unique bucket id (deterministic per earn event). */
  id: string
  points: number
  /** Points still unspent in this bucket (expiry applies to this). */
  remaining: number
  earnedAt: string
  /** ISO date when the remaining points expire, or null for never-expiring. */
  expiresAt: string | null
  /** Free-text origin marker (order number, admin adjustment). */
  origin: string
}

export interface LoyaltyAccount {
  phone: string
  restaurantId: string
  availablePoints: number
  earnedTotal: number
  redeemedTotal: number
  expiredTotal: number
  reversedTotal: number
  adjustedTotal: number
  buckets: LoyaltyBucket[]
  createdAt: string
  updatedAt: string
}

export interface CustomerAccount {
  phone: string
  restaurantId: string
  name: string
  /** scrypt hash (hex) + salt - optional for passwordless phone login */
  passwordHash?: string
  passwordSalt?: string
  verified: boolean
  /** 'active' | 'suspended' - suspended customers cannot earn or redeem. */
  status: 'active' | 'suspended'
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LoyaltyConfig {
  enabled: boolean
  pointsPerOrder: number
  /** Minimum order subtotal (pre-discount, paise) required to earn points. */
  minOrderPaise: number
  /** Whether points expire after being earned. */
  expiryEnabled: boolean
  /** Days until earned points expire. */
  expiryDays: number
  /** Max rewards redeemable per single order. */
  maxRedemptionsPerOrder: number
  /** Behaviour when a paid order is refunded: reverse earned points or keep. */
  refundPolicy: 'REVERSE' | 'KEEP'
  updatedAt: string
}

export type RewardType = 'FREE_ITEM' | 'FIXED_DISCOUNT' | 'PERCENT_DISCOUNT' | 'CUSTOM'

export interface Reward {
  id: string
  restaurantId: string
  name: string
  description?: string
  imageUrl?: string
  type: RewardType
  pointsCost: number
  /** Fixed discount in paise (FIXED_DISCOUNT / FREE_ITEM value). */
  discountPaise: number
  /** Basis-points discount for PERCENT_DISCOUNT (e.g. 1000 = 10%). */
  discountPctBps: number
  /** Upper bound on a single percentage discount (paise). 0 = uncapped. */
  discountMaxPaise: number
  /** Minimum order subtotal (pre-discount, paise) for this reward. */
  minOrderPaise: number
  /** Menu items this reward applies to (empty = any). */
  applicableItemIds: string[]
  active: boolean
  /** Remaining usable count. null/undefined = unlimited. */
  stock: number | null
  /** Reward validity window (ISO). */
  startAt: string | null
  endAt: string | null
  /** Max successful redemptions per customer. null = unlimited. */
  maxPerCustomer: number | null
  createdAt: string
  updatedAt: string
}

export type RedemptionStatus = 'APPLIED' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED'

export interface Redemption {
  id: string
  restaurantId: string
  customerId: string
  customerPhone: string
  rewardId: string
  rewardName: string
  pointsUsed: number
  discountPaise: number
  orderId: string | null
  orderNumber: string | null
  status: RedemptionStatus
  /** Set when the order was refunded: how reward points were settled. */
  refundNote?: string | null
  createdAt: string
  updatedAt: string
}

export interface LoyaltyTransaction {
  id: string
  customerId: string
  type: LoyaltyTransactionType
  points: number
  orderId?: string | null
  orderNumber?: string | null
  rewardId?: string | null
  redemptionId?: string | null
  /** Signed delta applied to availablePoints (-x / +x). */
  delta: number
  reason?: string | null
  adminActor?: string | null
  expiresAt?: string | null
  createdAt: string
}

export interface LoyaltySnapshot {
  availablePoints: number
  earnedTotal: number
  redeemedTotal: number
  expiredTotal: number
  adjustedTotal: number
  /** Newest expiring bucket with remaining points (for "expiring soon" UI). */
  nextExpiry: { points: number; expiresAt: string } | null
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  enabled: true,
  pointsPerOrder: 20,
  minOrderPaise: 0,
  expiryEnabled: false,
  expiryDays: 365,
  maxRedemptionsPerOrder: 1,
  refundPolicy: 'REVERSE',
  updatedAt: '',
}

function normalizeConfig(raw: Partial<LoyaltyConfig> | undefined): LoyaltyConfig {
  return {
    enabled: raw?.enabled ?? DEFAULT_LOYALTY_CONFIG.enabled,
    pointsPerOrder: clampInt(raw?.pointsPerOrder, 0, 100000, DEFAULT_LOYALTY_CONFIG.pointsPerOrder),
    minOrderPaise: clampInt(raw?.minOrderPaise, 0, 100000000, DEFAULT_LOYALTY_CONFIG.minOrderPaise),
    expiryEnabled: raw?.expiryEnabled ?? DEFAULT_LOYALTY_CONFIG.expiryEnabled,
    expiryDays: clampInt(raw?.expiryDays, 1, 36500, DEFAULT_LOYALTY_CONFIG.expiryDays),
    maxRedemptionsPerOrder: clampInt(raw?.maxRedemptionsPerOrder, 0, 10, DEFAULT_LOYALTY_CONFIG.maxRedemptionsPerOrder),
    refundPolicy: raw?.refundPolicy ?? DEFAULT_LOYALTY_CONFIG.refundPolicy,
    updatedAt: raw?.updatedAt ?? '',
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isInteger(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  return getCached('loyalty:config', 60 * 60 * 1000, async () => {
    const snap = await getDb().doc('restaurant/loyalty').get()
    return normalizeConfig(snap.exists ? (snap.data() as Partial<LoyaltyConfig>) : undefined)
  })
}

export async function saveLoyaltyConfig(data: Partial<LoyaltyConfig>): Promise<LoyaltyConfig> {
  const clean: Record<string, unknown> = { updatedAt: serverNow() }
  if (data.enabled !== undefined) clean.enabled = data.enabled
  if (data.pointsPerOrder !== undefined) clean.pointsPerOrder = data.pointsPerOrder
  if (data.minOrderPaise !== undefined) clean.minOrderPaise = data.minOrderPaise
  if (data.expiryEnabled !== undefined) clean.expiryEnabled = data.expiryEnabled
  if (data.expiryDays !== undefined) clean.expiryDays = data.expiryDays
  if (data.maxRedemptionsPerOrder !== undefined) clean.maxRedemptionsPerOrder = data.maxRedemptionsPerOrder
  if (data.refundPolicy !== undefined) clean.refundPolicy = data.refundPolicy
  await getDb().doc('restaurant/loyalty').set(clean, { merge: true })
  invalidateCache('loyalty:config')
  return getLoyaltyConfigImmediate()
}

async function getLoyaltyConfigImmediate(): Promise<LoyaltyConfig> {
  const snap = await getDb().doc('restaurant/loyalty').get()
  return normalizeConfig(snap.exists ? (snap.data() as Partial<LoyaltyConfig>) : undefined)
}

// ---------------------------------------------------------------------------
// Customer accounts (mobile + password, OTP verified)
// ---------------------------------------------------------------------------

export function normalizeCustomerPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  let d = digits
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 13 && d.startsWith('091')) d = d.slice(3)
  if (!/^[6-9]\d{9}$/.test(d)) return null
  return d
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? crypto.randomBytes(16).toString('hex')
  // N=16384 (default), r=8, p=1, 64-byte key.
  const hash = crypto.scryptSync(password, s, 64).toString('hex')
  return { hash, salt: s }
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const { hash } = hashPassword(password, salt)
    const a = Buffer.from(hash, 'hex')
    const b = Buffer.from(storedHash, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

const lastLoginThrottle = new Map<string, number>()

export async function getCustomerAccount(phone: string): Promise<CustomerAccount | null> {
  return getCached(`customerAccount:${phone}`, 60 * 1000, async () => {
    const snap = await getDb().doc(`customerAccounts/${phone}`).get()
    if (!snap.exists) return null
    return { ...(snap.data() as CustomerAccount), phone: snap.id }
  })
}

/** Creates an unverified customer + empty loyalty account in one batch (idempotent). */
export async function createCustomerAccount(data: {
  phone: string
  name: string
  password?: string
}): Promise<CustomerAccount> {
  const db = getDb()
  const existing = await getCustomerAccount(data.phone)
  if (existing) throw new Error('ACCOUNT_EXISTS')
  const now = serverNow()
  const creds = data.password ? hashPassword(data.password) : null
  const account: CustomerAccount = {
    phone: data.phone,
    restaurantId: RESTAURANT_ID,
    name: data.name.trim().slice(0, 80) || 'Diner',
    ...(creds ? { passwordHash: creds.hash, passwordSalt: creds.salt } : {}),
    verified: false,
    status: 'active',
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.doc(`customerAccounts/${data.phone}`).set(stripUndefined(account as unknown as Record<string, unknown>))
  invalidateCache(`customerAccount:${data.phone}`)
  await ensureLoyaltyAccount(data.phone)
  return account
}

/** Passwordless customer login / registration. Resolves or creates verified customer by mobile number. */
export async function getOrCreateCustomerAccount(data: {
  phone: string
  name?: string
}): Promise<CustomerAccount> {
  const db = getDb()
  const now = serverNow()
  const snap = await db.doc(`customerAccounts/${data.phone}`).get()
  if (snap.exists) {
    const existing = snap.data() as CustomerAccount
    const updates: Record<string, unknown> = {
      lastLoginAt: now,
      updatedAt: now,
      verified: true,
    }
    if (data.name && data.name.trim() && (!existing.name || existing.name === 'Diner' || existing.name === data.phone)) {
      updates.name = data.name.trim().slice(0, 80)
    }
    await snap.ref.update(updates)
    invalidateCache(`customerAccount:${data.phone}`)
    await ensureLoyaltyAccount(data.phone)
    return { ...existing, ...updates, phone: data.phone }
  }

  const account: CustomerAccount = {
    phone: data.phone,
    restaurantId: RESTAURANT_ID,
    name: data.name && data.name.trim() ? data.name.trim().slice(0, 80) : 'Diner',
    verified: true,
    status: 'active',
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  }
  await db.doc(`customerAccounts/${data.phone}`).set(account)
  invalidateCache(`customerAccount:${data.phone}`)
  await ensureLoyaltyAccount(data.phone)
  return account
}

export async function updateCustomerLogin(phone: string): Promise<void> {
  // Throttle writes to max once per hour to minimize write load
  const now = Date.now()
  const lastUpdated = lastLoginThrottle.get(phone) || 0
  if (now - lastUpdated < 60 * 60 * 1000) return
  lastLoginThrottle.set(phone, now)
  await getDb()
    .doc(`customerAccounts/${phone}`)
    .update({ lastLoginAt: serverNow(), updatedAt: serverNow() })
    .catch(() => {})
  invalidateCache(`customerAccount:${phone}`)
}

export async function markCustomerVerified(phone: string): Promise<void> {
  await getDb()
    .doc(`customerAccounts/${phone}`)
    .update({ verified: true, updatedAt: serverNow() })
  invalidateCache(`customerAccount:${phone}`)
}

export async function setCustomerStatus(phone: string, status: CustomerAccount['status']): Promise<void> {
  await getDb().doc(`customerAccounts/${phone}`).update({ status, updatedAt: serverNow() })
  invalidateCache(`customerAccount:${phone}`)
}

export async function updateCustomerPassword(phone: string, password: string): Promise<void> {
  const { hash, salt } = hashPassword(password)
  await getDb()
    .doc(`customerAccounts/${phone}`)
    .update({ passwordHash: hash, passwordSalt: salt, updatedAt: serverNow() })
  invalidateCache(`customerAccount:${phone}`)
}

// ---------------------------------------------------------------------------
// OTP verification codes
// ---------------------------------------------------------------------------

export interface OtpRecord {
  phone: string
  /** SHA-256 of the 6-digit code. */
  codeHash: string
  purpose: 'signup' | 'login'
  attempts: number
  expiresAt: string
  createdAt: string
}

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000))
}

/** Stores a fresh OTP for the phone, replacing any previous one. */
export async function storeOtp(phone: string, purpose: 'signup' | 'login'): Promise<{ code: string }> {
  const code = generateOtp()
  const record: OtpRecord = {
    phone,
    codeHash: crypto.createHash('sha256').update(code).digest('hex'),
    purpose,
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    createdAt: serverNow(),
  }
  await getDb().doc(`customerOtps/${phone}`).set(record)
  return { code }
}

export async function verifyOtp(phone: string, code: string, purpose: 'signup' | 'login'): Promise<boolean> {
  const db = getDb()
  const ref = db.doc(`customerOtps/${phone}`)
  const snap = await ref.get()
  if (!snap.exists) return false
  const rec = snap.data() as OtpRecord
  if (rec.purpose !== purpose) return false
  if (new Date(rec.expiresAt).getTime() < Date.now()) return false
  if (rec.attempts >= OTP_MAX_ATTEMPTS) return false
  const presentedHash = crypto.createHash('sha256').update(code.replace(/\D/g, '')).digest('hex')
  if (presentedHash !== rec.codeHash) {
    await ref.update({ attempts: rec.attempts + 1 }).catch(() => {})
    return false
  }
  await ref.delete().catch(() => {})
  return true
}

/** Read-only OTP record (used by the API for resend cooldown checks). */
export async function getOtpRecord(phone: string): Promise<OtpRecord | null> {
  const snap = await getDb().doc(`customerOtps/${phone}`).get()
  if (!snap.exists) return null
  return snap.data() as OtpRecord
}

// ---------------------------------------------------------------------------
// Loyalty accounts + point buckets
// ---------------------------------------------------------------------------

function expiryDate(cfg: LoyaltyConfig, fromNow = new Date()): string | null {
  if (!cfg.expiryEnabled) return null
  return new Date(fromNow.getTime() + cfg.expiryDays * 86400_000).toISOString()
}

/** Ensures a loyalty account doc exists for the customer (creates empty). */
export async function ensureLoyaltyAccount(phone: string): Promise<LoyaltyAccount> {
  const ref = getDb().doc(`loyaltyAccounts/${phone}`)
  const snap = await ref.get()
  const now = serverNow()
  if (snap.exists) return snap.data() as LoyaltyAccount
  const account: LoyaltyAccount = {
    phone,
    restaurantId: RESTAURANT_ID,
    availablePoints: 0,
    earnedTotal: 0,
    redeemedTotal: 0,
    expiredTotal: 0,
    reversedTotal: 0,
    adjustedTotal: 0,
    buckets: [],
    createdAt: now,
    updatedAt: now,
  }
  await ref.set(account)
  return account
}

interface SweepResult {
  accountData: LoyaltyAccount
  expiredPoints: number
}

/**
 * Lazily processes expired buckets inside an existing transaction.
 * Must be called at the start of any read/redeem of loyalty points so expired
 * points can never be spent. Writes an idempotent EXPIRE ledger transaction.
 */
function sweepExpiredBuckets(tx: FirebaseFirestore.Transaction, account: LoyaltyAccount, now: Date): SweepResult {
  const data: LoyaltyAccount = { ...account, buckets: [...account.buckets] }
  let expiredPoints = 0
  let expiredBuckets = 0
  let firstExpiredAt: string | null = null
  data.buckets = data.buckets.map((b) => {
    const isExpired = b.remaining > 0 && b.expiresAt !== null && new Date(b.expiresAt).getTime() <= now.getTime()
    if (isExpired) {
      expiredPoints += b.remaining
      expiredBuckets += 1
      if (!firstExpiredAt || new Date(b.expiresAt as string) < new Date(firstExpiredAt)) {
        firstExpiredAt = b.expiresAt
      }
      return { ...b, remaining: 0 }
    }
    return b
  })
  if (expiredPoints > 0) {
    data.availablePoints = Math.max(0, data.availablePoints - expiredPoints)
    data.expiredTotal += expiredPoints
    // One consolidated EXPIRE tx per sweep (idempotent: bucket remainings are
    // zeroed, so repeated sweeps are no-ops).
    const txRef = getDb().collection('loyaltyTransactions').doc()
    tx.set(txRef, {
      id: txRef.id,
      customerId: account.phone,
      type: 'EXPIRE',
      points: expiredPoints,
      delta: -expiredPoints,
      orderId: null,
      rewardId: null,
      redemptionId: null,
      reason: `${expiredBuckets} point batch(es) reached their expiry date`,
      adminActor: null,
      expiresAt: firstExpiredAt,
      createdAt: now.toISOString(),
    } satisfies Omit<LoyaltyTransaction, 'id'> & { id: string })
  }
  return { accountData: data, expiredPoints }
}

function newEarnBucketId(phone: string, orderId: string): string {
  return `earn:${orderId}:${phone}`
}

function bucket(points: number, now: Date, expiresAt: string | null, origin: string): LoyaltyBucket {
  return {
    id: `b_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`,
    points,
    remaining: points,
    earnedAt: now.toISOString(),
    expiresAt,
    origin,
  }
}

/** FIFO spend across buckets, oldest first. Returns adjusted bucket list. */
function consumeFifo(buckets: LoyaltyBucket[], amount: number): LoyaltyBucket[] {
  let remaining = amount
  const next = buckets.map((b) => ({ ...b }))
  // Sort by expiry (never-expiring last) then earnedAt: spend points that would
  // expire first. Buckets with remaining 0 are untouched.
  next.sort((a, b) => {
    const axScore = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER
    const bxScore = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER
    if (axScore !== bxScore) return axScore - bxScore
    return a.earnedAt.localeCompare(b.earnedAt)
  })
  for (const b of next) {
    if (remaining <= 0) break
    if (b.remaining <= 0) continue
    const take = Math.min(b.remaining, remaining)
    b.remaining -= take
    remaining -= take
  }
  return next
}

export function invalidateCustomerLoyaltyCache(phone: string): void {
  invalidateCache(`loyalty:summary:${phone}`)
  invalidateCache(`loyalty:ledger:${phone}`)
  invalidateCache(`loyalty:redemptions:${phone}`)
  invalidateCache(`redemptions:count:${phone}`)
}

/**
 * Awards points for a completed, eligible order - inside a Firestore
 * transaction. Idempotent: safe to call concurrency and multiple times;
 * only one EARN transaction can ever exist per (order, customer).
 * Returns the awarded amount (0 when not eligible/already awarded).
 */
export async function awardOrderPoints(order: {
  id: string
  orderNumber: string
  totalPaise: number
  subtotalPaise?: number
  customerPhone: string
  loyaltyAwarded?: boolean
}): Promise<{ awarded: number; customerId: string | null }> {
  const db = getDb()
  const phone = order.customerPhone
  if (!phone) return { awarded: 0, customerId: null }
  const cfg = await getLoyaltyConfig()
  if (!cfg.enabled || cfg.pointsPerOrder <= 0) return { awarded: 0, customerId: phone }
  if (order.loyaltyAwarded) return { awarded: 0, customerId: phone }
  const checkAmount = order.subtotalPaise !== undefined ? order.subtotalPaise : order.totalPaise
  if (checkAmount < cfg.minOrderPaise) return { awarded: 0, customerId: phone }

  const result = await db.runTransaction(async (tx) => {
    const accRef = db.doc(`loyaltyAccounts/${phone}`)
    const custRef = db.doc(`customerAccounts/${phone}`)
    const [accSnap, custSnap] = await Promise.all([tx.get(accRef), tx.get(custRef)])

    // Customer must exist, be verified and active.
    let customer = custSnap.exists ? (custSnap.data() as CustomerAccount) : null
    if (!customer) {
      const nowStr = serverNow()
      customer = {
        phone,
        restaurantId: RESTAURANT_ID,
        name: 'VIP Diner',
        verified: true,
        status: 'active',
        lastLoginAt: nowStr,
        createdAt: nowStr,
        updatedAt: nowStr,
      }
      tx.set(custRef, customer)
    }
    // Suspended accounts cannot accrue points
    if (customer.status === 'suspended') return 0

    const account = accSnap.exists
      ? (accSnap.data() as LoyaltyAccount)
      : emptyLoyaltyAccount(phone, serverNow())

    const now = new Date()

    // Idempotency guard inside the tx: query existing EARN ledger entries.
    const earnQuery = await tx.get(
      db
        .collection('loyaltyTransactions')
        .where('customerId', '==', phone)
        .where('orderId', '==', order.id)
        .where('type', '==', 'EARN')
        .limit(1)
    )
    if (!earnQuery.empty) return 0

    const { accountData } = sweepExpiredBuckets(tx, account, now)
    const points = cfg.pointsPerOrder
    const expiresAt = expiryDate(cfg, now)
    const earnBucket = bucket(points, now, expiresAt, order.orderNumber)
    earnBucket.id = newEarnBucketId(phone, order.id)

    accountData.availablePoints += points
    accountData.earnedTotal += points
    accountData.buckets = [...accountData.buckets, earnBucket]
    accountData.updatedAt = now.toISOString()

    tx.set(accRef, accountData)
    const eventRef = db.collection('loyaltyTransactions').doc()
    tx.set(eventRef, {
      id: eventRef.id,
      customerId: phone,
      type: 'EARN',
      points,
      delta: points,
      orderId: order.id,
      orderNumber: order.orderNumber,
      rewardId: null,
      redemptionId: null,
      reason: `Order #${order.orderNumber} completed • ${points} pts per eligible order`,
      adminActor: null,
      expiresAt,
      createdAt: now.toISOString(),
    } satisfies Omit<LoyaltyTransaction, 'id'> & { id: string })

    // Mark the order so repeated transitions to SERVED can't double-award.
    tx.update(db.doc(`orders/${order.id}`), {
      loyaltyAwarded: true,
      loyaltyPointsEarned: points,
      updatedAt: now.toISOString(),
    })

    return points
  })

  invalidateCustomerLoyaltyCache(phone)
  invalidateCache(`order:${order.id}`)
  invalidateCache(`orders:phone:${phone}`)
  invalidateCache('loyalty:analytics')
  return { awarded: result, customerId: phone }
}

export function emptyLoyaltyAccount(phone: string, now: string): LoyaltyAccount {
  return {
    phone,
    restaurantId: RESTAURANT_ID,
    availablePoints: 0,
    earnedTotal: 0,
    redeemedTotal: 0,
    expiredTotal: 0,
    reversedTotal: 0,
    adjustedTotal: 0,
    buckets: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Reverses previously awarded points for an order (cancellation / refund
 * policy REVERSE). Idempotent: only one REVERSE transaction per (order, customer).
 */
export async function reverseOrderPoints(order: {
  id: string
  orderNumber: string
  customerPhone: string
  loyaltyPointsEarned?: number
}, reason: string): Promise<number> {
  const db = getDb()
  const phone = order.customerPhone
  if (!phone) return 0
  const amount = order.loyaltyPointsEarned ?? 0
  if (amount <= 0) return 0

  const reversed = await db.runTransaction(async (tx) => {
    const accRef = db.doc(`loyaltyAccounts/${phone}`)
    const accSnap = await tx.get(accRef)
    if (!accSnap.exists) return 0
    const account = accSnap.data() as LoyaltyAccount

    const query = await tx.get(
      db
        .collection('loyaltyTransactions')
        .where('customerId', '==', phone)
        .where('orderId', '==', order.id)
        .where('type', '==', 'REVERSE')
        .limit(1)
    )
    if (!query.empty) return 0

    const now = new Date()
    const { accountData } = sweepExpiredBuckets(tx, account, now)

    // Reverse FIFO: remove the earn bucket and refund any residue from that
    // bucket that has since been spent by the customer. We deduct the original
    // award from available points; if the customer already spent some, the
    // shortfall is handled explicitly below instead of corrupting the balance.
    const shortfall = Math.max(0, amount - accountData.availablePoints)
    const applied = amount - shortfall
    accountData.availablePoints -= applied
    accountData.earnedTotal -= amount
    accountData.reversedTotal += amount
    // Reduce bucket remainings reverse-FIFO (newest first) for the applied part.
    const sorted = [...accountData.buckets]
      .map((b) => ({ ...b }))
      .filter((b) => b.remaining > 0)
      .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
    let toRemove = applied
    for (const b of sorted) {
      if (toRemove <= 0) break
      const take = Math.min(b.remaining, toRemove)
      b.remaining -= take
      toRemove -= take
    }
    accountData.buckets = accountData.buckets.map((b) => sorted.find((s) => s.id === b.id) ?? b)
    accountData.updatedAt = now.toISOString()
    tx.set(accRef, accountData)

    const eventRef = db.collection('loyaltyTransactions').doc()
    tx.set(eventRef, {
      id: eventRef.id,
      customerId: phone,
      type: 'REVERSE',
      points: amount,
      delta: -applied,
      orderId: order.id,
      orderNumber: order.orderNumber,
      rewardId: null,
      redemptionId: null,
      reason:
        reason +
        (shortfall > 0 ? ` • ${shortfall} pts already spent - logged explicitly, balance floored at 0` : ''),
      adminActor: null,
      createdAt: now.toISOString(),
    } satisfies Omit<LoyaltyTransaction, 'id'> & { id: string })

    return amount
  })

  invalidateCustomerLoyaltyCache(phone)
  invalidateCache('loyalty:analytics')
  return reversed
}

// ---------------------------------------------------------------------------
// Redemption (reward) apply / cancel / fulfil
// ---------------------------------------------------------------------------

export interface RewardEligibility {
  eligible: boolean
  /** Machine-readable reason when ineligible. */
  code:
    | 'OK'
    | 'NOT_ENOUGH_POINTS'
    | 'REWARD_INACTIVE'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'OUT_OF_STOCK'
    | 'MIN_ORDER'
    | 'CUSTOMER_LIMIT'
    | 'SUSPENDED'
}

/** Read-only eligibility assessment for UI display. */
export async function getRewardEligibility(
  reward: Reward,
  ctx: {
    customerPhone: string | null
    subtotalPaise: number
    loyaltyAvailable: number
    enabled: boolean
    customer?: CustomerAccount | null
  }
): Promise<RewardEligibility> {
  if (!ctx.enabled) return { eligible: false, code: 'REWARD_INACTIVE' }
  if (!reward.active) return { eligible: false, code: 'REWARD_INACTIVE' }
  const now = Date.now()
  if (reward.startAt && new Date(reward.startAt).getTime() > now) return { eligible: false, code: 'NOT_STARTED' }
  if (reward.endAt && new Date(reward.endAt).getTime() < now) return { eligible: false, code: 'EXPIRED' }
  if (reward.stock !== null && reward.stock !== undefined && reward.stock <= 0) {
    return { eligible: false, code: 'OUT_OF_STOCK' }
  }
  if (ctx.subtotalPaise < reward.minOrderPaise) return { eligible: false, code: 'MIN_ORDER' }
  if (!ctx.customerPhone) return { eligible: false, code: 'NOT_ENOUGH_POINTS' }
  const customer = ctx.customer !== undefined ? ctx.customer : await getCustomerAccount(ctx.customerPhone)
  if (!customer || customer.status === 'suspended') return { eligible: false, code: 'SUSPENDED' }
  if (customer.verified === false) return { eligible: false, code: 'SUSPENDED' }
  if (reward.pointsCost > ctx.loyaltyAvailable) return { eligible: false, code: 'NOT_ENOUGH_POINTS' }
  if (reward.maxPerCustomer !== null && reward.maxPerCustomer !== undefined) {
    const count = await getCached(`redemptions:count:${ctx.customerPhone}:${reward.id}`, 30 * 1000, async () => {
      const snap = await getDb()
        .collection('redemptions')
        .where('customerId', '==', ctx.customerPhone)
        .where('rewardId', '==', reward.id)
        .where('status', 'in', ['APPLIED', 'FULFILLED'])
        .count()
        .get()
      return snap.data().count
    })
    if (count >= reward.maxPerCustomer) return { eligible: false, code: 'CUSTOMER_LIMIT' }
  }
  return { eligible: true, code: 'OK' }
}

/** Server-side reward discount computation (paise). */
export function computeRewardDiscount(reward: Reward, subtotalPaise: number): number {
  if (reward.type === 'FIXED_DISCOUNT' || reward.type === 'FREE_ITEM') {
    return Math.min(reward.discountPaise, subtotalPaise)
  }
  if (reward.type === 'PERCENT_DISCOUNT') {
    const raw = Math.round((subtotalPaise * reward.discountPctBps) / 10000)
    const capped = reward.discountMaxPaise > 0 ? Math.min(raw, reward.discountMaxPaise) : raw
    return Math.min(capped, subtotalPaise)
  }
  return 0 // CUSTOM rewards carry no monetary discount (handled by staff)
}

export interface ApplyRedemptionInput {
  customerPhone: string
  rewardId: string
  subtotalPaise: number
}

export interface ApplyRedemptionResult {
  redemptionId: string
  reward: Reward
  pointsUsed: number
  discountPaise: number
}

/**
 * Atomically applies a reward to an in-flight order: deducts points FIFO,
 * decrements stock, writes the REDEEM transaction and returns the discount.
 * Throws with a user-facing code when invalid. The redemption references the
 * order id once the order doc is created (bondRedemptionToOrder).
 */
export async function applyRedemptionForOrder(input: ApplyRedemptionInput): Promise<ApplyRedemptionResult> {
  const db = getDb()
  const cfg = await getLoyaltyConfig()
  if (!cfg.enabled) throw new Error('LOYALTY_DISABLED')
  const now = new Date()

  const customer = await getCustomerAccount(input.customerPhone)
  const customerVerified = customer?.verified === true && customer?.status !== 'suspended'

  const result = await db.runTransaction(async (tx) => {
    const accRef = db.doc(`loyaltyAccounts/${input.customerPhone}`)
    const rewardRef = db.doc(`rewards/${input.rewardId}`)
    const [accSnap, rewardTxSnap] = await Promise.all([tx.get(accRef), tx.get(rewardRef)])
    if (!accSnap.exists) throw new Error('NOT_ENOUGH_POINTS')
    if (!rewardTxSnap.exists) throw new Error('REWARD_NOT_FOUND')
    const liveRewardData = rewardTxSnap.data() as Reward
    if (!liveRewardData.active) throw new Error('REWARD_INACTIVE')
    if (liveRewardData.startAt && new Date(liveRewardData.startAt).getTime() > now.getTime()) throw new Error('NOT_STARTED')
    if (liveRewardData.endAt && new Date(liveRewardData.endAt).getTime() < now.getTime()) throw new Error('REWARD_EXPIRED')
    if (liveRewardData.stock !== null && liveRewardData.stock !== undefined && liveRewardData.stock <= 0) throw new Error('OUT_OF_STOCK')
    if (input.subtotalPaise < liveRewardData.minOrderPaise) throw new Error('MIN_ORDER')

    const account = accSnap.exists ? (accSnap.data() as LoyaltyAccount) : null
    if (!account || !customerVerified) throw new Error('NOT_VERIFIED')

    const sweep = sweepExpiredBuckets(tx, account, now)
    const accountData = sweep.accountData

    if (liveRewardData.pointsCost > accountData.availablePoints) throw new Error('NOT_ENOUGH_POINTS')

    if (liveRewardData.maxPerCustomer !== null && liveRewardData.maxPerCustomer !== undefined) {
      const used = await tx.get(
        db
          .collection('redemptions')
          .where('customerId', '==', input.customerPhone)
          .where('rewardId', '==', input.rewardId)
          .where('status', 'in', ['APPLIED', 'FULFILLED'])
      )
      if (used.size >= liveRewardData.maxPerCustomer) throw new Error('CUSTOMER_LIMIT')
    }

    const discount = computeRewardDiscount(liveRewardData, input.subtotalPaise)

    // Deduct points FIFO.
    accountData.buckets = consumeFifo(accountData.buckets, liveRewardData.pointsCost)
    accountData.availablePoints -= liveRewardData.pointsCost
    accountData.redeemedTotal += liveRewardData.pointsCost
    accountData.updatedAt = now.toISOString()
    if (accountData.availablePoints < 0) throw new Error('NOT_ENOUGH_POINTS')

    // Stock.
    const nextRewardData: Record<string, unknown> = { updatedAt: now.toISOString() }
    if (liveRewardData.stock !== null && liveRewardData.stock !== undefined) {
      nextRewardData.stock = liveRewardData.stock - 1
    }
    tx.update(rewardRef, nextRewardData)
    invalidateCache('loyalty:rewards')

    const redemptionRef = db.collection('redemptions').doc()
    tx.set(redemptionRef, {
      id: redemptionRef.id,
      restaurantId: RESTAURANT_ID,
      customerId: input.customerPhone,
      customerPhone: input.customerPhone,
      rewardId: liveRewardData.id,
      rewardName: liveRewardData.name,
      pointsUsed: liveRewardData.pointsCost,
      discountPaise: discount,
      orderId: null,
      orderNumber: null,
      status: 'APPLIED',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    tx.set(accRef, accountData)

    const eventRef = db.collection('loyaltyTransactions').doc()
    tx.set(eventRef, {
      id: eventRef.id,
      customerId: input.customerPhone,
      type: 'REDEEM',
      points: liveRewardData.pointsCost,
      delta: -liveRewardData.pointsCost,
      orderId: null,
      rewardId: liveRewardData.id,
      redemptionId: redemptionRef.id,
      reason: `Redeemed reward "${liveRewardData.name}" at checkout`,
      adminActor: null,
      createdAt: now.toISOString(),
    } satisfies Omit<LoyaltyTransaction, 'id'> & { id: string })

    return {
      redemptionId: redemptionRef.id,
      reward: liveRewardData,
      pointsUsed: liveRewardData.pointsCost,
      discountPaise: discount,
    }
  })
  invalidateCustomerLoyaltyCache(input.customerPhone)
  invalidateCache('loyalty:analytics')
  return result
}

/** Bonds an APPLIED redemption to its created order (after createOrder). */
export async function bondRedemptionToOrder(
  redemptionId: string,
  orderId: string,
  orderNumber: string
): Promise<void> {
  const db = getDb()
  // Update redemption doc.
  await db.doc(`redemptions/${redemptionId}`).update({ orderId, orderNumber, updatedAt: serverNow() })
  // Best-effort: update the REDEEM ledger tx referencing this redemption.
  const txs = await db
    .collection('loyaltyTransactions')
    .where('redemptionId', '==', redemptionId)
    .where('type', '==', 'REDEEM')
    .limit(1)
    .get()
  if (!txs.empty) {
    await txs.docs[0].ref.update({ orderId, orderNumber })
  }
}

/*
 * Lifecycle handlers called from the ordering module.
 */

export async function handleOrderCancelledForLoyalty(order: {
  id: string
  orderNumber: string
  customerPhone: string
  loyaltyAwarded?: boolean
  loyaltyPointsEarned?: number
  loyalty?: { redemptionId?: string | null; pointsUsed?: number } | null
  cancelledBy?: { uid: string; email?: string | null }
}): Promise<void> {
  const db = getDb()
  // 1. Restore applied redemption points + stock.
  const redemptionId = order.loyalty?.redemptionId
  if (redemptionId) {
    await cancelRedemption(redemptionId, `Order #${order.orderNumber} cancelled`)
  }
  // 2. Reverse earned points.
  if (order.loyaltyAwarded && (order.loyaltyPointsEarned ?? 0) > 0) {
    await reverseOrderPoints(
      { id: order.id, orderNumber: order.orderNumber, customerPhone: order.customerPhone, loyaltyPointsEarned: order.loyaltyPointsEarned },
      `Order #${order.orderNumber} cancelled`
    )
  }
  void db
}

export async function handleOrderFulfilledForLoyalty(order: {
  id: string
  orderNumber: string
  totalPaise: number
  subtotalPaise?: number
  customerPhone: string
  loyaltyAwarded?: boolean
  loyalty: PointsAdjustmentPayload | null
  customerVerified?: boolean
}): Promise<{ earned: number }> {
  // Award points exactly once (SERVED final state).
  const award = await awardOrderPoints({
    id: order.id,
    orderNumber: order.orderNumber,
    totalPaise: order.totalPaise,
    subtotalPaise: order.subtotalPaise,
    customerPhone: order.customerPhone,
    loyaltyAwarded: order.loyaltyAwarded,
  })
  // Mark redemption as fulfilled.
  const redemptionId = order.loyalty?.redemptionId
  if (redemptionId) {
    const ref = getDb().doc(`redemptions/${redemptionId}`)
    const snap = await ref.get()
    if (snap.exists) {
      const current = snap.data() as Redemption
      if (current.status === 'APPLIED') {
        await ref.update({ status: 'FULFILLED', updatedAt: serverNow() })
        invalidateCache('loyalty:redemptions')
      }
    }
  }
  return { earned: award.awarded }
}

interface PointsAdjustmentPayload {
  redemptionId?: string | null
  rewardId?: string | null
  rewardName?: string | null
  discountPaise?: number
  pointsUsed?: number
}

/** Refund settlement per configured policy: reverse earned points, settle reward. */
export async function handleOrderRefundForLoyalty(
  order: {
    id: string
    orderNumber: string
    customerPhone: string
    loyaltyAwarded?: boolean
    loyaltyPointsEarned?: number
    loyalty?: { redemptionId?: string | null; pointsUsed?: number } | null
  },
  refundAmountPaise: number
): Promise<void> {
  const cfg = await getLoyaltyConfig()
  // 1. Earned points reversal policy.
  if (cfg.refundPolicy === 'REVERSE' && order.loyaltyAwarded && (order.loyaltyPointsEarned ?? 0) > 0) {
    await reverseOrderPoints(
      { id: order.id, orderNumber: order.orderNumber, customerPhone: order.customerPhone, loyaltyPointsEarned: order.loyaltyPointsEarned },
      `Full refund of order #${order.orderNumber}`
    )
  }
  // 2. Redemption settlement: fully refunded order â†’ restore reward points.
  const redemptionId = order.loyalty?.redemptionId
  if (!redemptionId) return
  const db = getDb()
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`redemptions/${redemptionId}`)
    const snap = await tx.get(ref)
    if (!snap.exists) return
    const redemption = snap.data() as Redemption
    if (redemption.status !== 'APPLIED' && redemption.status !== 'FULFILLED') return
    const now = serverNow()
    // Refund reward points to the customer.
    await restoreRedemptionPoints(tx, redemption, `Refund of order #${order.orderNumber}`)
    tx.update(ref, {
      status: 'REFUNDED',
      refundNote: `Reward points restored • refund ${refundAmountPaise}p • policy ${cfg.refundPolicy}`,
      updatedAt: now,
    })
  })
  invalidateCustomerLoyaltyCache(order.customerPhone)
  invalidateCache('loyalty:redemptions')
}

/** Transaction helper: put points back (fresh expiry window per policy). */
async function restoreRedemptionPoints(
  tx: FirebaseFirestore.Transaction,
  redemption: Redemption,
  reason: string
): Promise<void> {
  const db = getDb()
  const now = new Date()
  const accRef = db.doc(`loyaltyAccounts/${redemption.customerId}`)
  const accSnap = await tx.get(accRef)
  if (!accSnap.exists) return
  const account = accSnap.data() as LoyaltyAccount
  const sweep = sweepExpiredBuckets(tx, account, now)
  const data = sweep.accountData
  const cfg = await getLoyaltyConfig()
  const restored = bucket(redemption.pointsUsed, now, expiryDate(cfg, now), reason)
  data.buckets = [...data.buckets, restored]
  data.availablePoints += redemption.pointsUsed
  data.redeemedTotal -= redemption.pointsUsed
  data.updatedAt = now.toISOString()
  tx.set(accRef, data)
  const eventRef = db.collection('loyaltyTransactions').doc()
  tx.set(eventRef, {
    id: eventRef.id,
    customerId: redemption.customerId,
    type: 'RESTORE',
    points: redemption.pointsUsed,
    delta: redemption.pointsUsed,
    orderId: redemption.orderId ?? null,
    rewardId: redemption.rewardId,
    redemptionId: redemption.id,
    reason,
    adminActor: null,
    expiresAt: restored.expiresAt,
    createdAt: now.toISOString(),
  } satisfies Omit<LoyaltyTransaction, 'id'> & { id: string })
}

/** Cancels a redemption (staff or system) and restores its points + stock. */
export async function cancelRedemption(redemptionId: string, reason: string): Promise<void> {
  const db = getDb()
  let customerId: string | null = null
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`redemptions/${redemptionId}`)
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('NOT_FOUND')
    const redemption = snap.data() as Redemption
    customerId = redemption.customerId
    if (redemption.status !== 'APPLIED' && redemption.status !== 'FULFILLED') return
    const now = serverNow()
    await restoreRedemptionPoints(tx, redemption, reason)
    tx.update(ref, { status: 'CANCELLED', refundNote: reason, updatedAt: now })
    // Restore stock if stock-limited.
    if (redemption.rewardId) {
      const rewardSnap = await tx.get(db.doc(`rewards/${redemption.rewardId}`))
      if (rewardSnap.exists) {
        const reward = rewardSnap.data() as Reward
        if (reward.stock !== null && reward.stock !== undefined && reward.stock < 1000000) {
          tx.update(db.doc(`rewards/${redemption.rewardId}`), { stock: reward.stock + 1, updatedAt: now })
          invalidateCache('loyalty:rewards')
        }
      }
    }
  })
  if (customerId) invalidateCustomerLoyaltyCache(customerId)
  invalidateCache('loyalty:redemptions')
  invalidateCache('loyalty:analytics')
}

/**
 * Manual admin point adjustment (+credit / -debit) with a mandatory reason.
 * Returns the movement summary.
 */
export async function adjustPoints(
  phone: string,
  points: number,
  reason: string,
  actor: { uid: string; email?: string | null }
): Promise<{ phone: string; points: number }> {
  const db = getDb()
  await ensureLoyaltyAccount(phone)
  const result = await db.runTransaction(async (tx) => {
    const accRef = db.doc(`loyaltyAccounts/${phone}`)
    const snap = await tx.get(accRef)
    const account = snap.exists ? (snap.data() as LoyaltyAccount) : emptyLoyaltyAccount(phone, serverNow())
    const now = new Date()
    const sweep = sweepExpiredBuckets(tx, account, now)
    const data = sweep.accountData
    let appliedDelta = points
    if (points > 0) {
      const cfg = await getLoyaltyConfig()
      const b = bucket(points, now, expiryDate(cfg, now), 'Admin adjustment')
      data.buckets = [...data.buckets, b]
      data.availablePoints += points
      data.earnedTotal += points
      data.adjustedTotal += points
    } else {
      const spend = Math.min(data.availablePoints, -points)
      data.buckets = consumeFifo(data.buckets, spend)
      data.availablePoints -= spend
      data.adjustedTotal += points // net-negative tracked
      if (spend < -points) {
        reason += ` • requested -${-points} but only ${spend} available`
      }
      appliedDelta = -spend
    }
    data.updatedAt = now.toISOString()
    tx.set(accRef, data)
    const eventRef = db.collection('loyaltyTransactions').doc()
    tx.set(eventRef, {
      id: eventRef.id,
      customerId: phone,
      type: 'ADJUST',
      points: Math.abs(appliedDelta),
      delta: appliedDelta,
      reason,
      adminActor: actor.email ?? actor.uid,
      createdAt: now.toISOString(),
    } satisfies Omit<LoyaltyTransaction, 'id'> & { id: string })
    return { phone, points: appliedDelta }
  })
  invalidateCustomerLoyaltyCache(phone)
  invalidateCache('loyalty:analytics')
  return result
}

// ---------------------------------------------------------------------------
// Reads for customer dashboard + admin
// ---------------------------------------------------------------------------

function summarize(account: LoyaltyAccount): LoyaltySnapshot {
  const live = account.buckets.filter((b) => b.remaining > 0 && (b.expiresAt === null || new Date(b.expiresAt).getTime() > Date.now()))
  const next = live
    .filter((b) => b.expiresAt !== null)
    .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())[0]
  return {
    availablePoints: Math.max(0, account.availablePoints),
    earnedTotal: account.earnedTotal,
    redeemedTotal: account.redeemedTotal,
    expiredTotal: account.expiredTotal,
    adjustedTotal: account.adjustedTotal,
    nextExpiry: next ? { points: next.remaining, expiresAt: next.expiresAt as string } : null,
  }
}

async function sweepAndSnapshot(phone: string): Promise<LoyaltySnapshot> {
  const db = getDb()
  await ensureLoyaltyAccount(phone)
  const snap = await db.runTransaction(async (tx) => {
    const ref = db.doc(`loyaltyAccounts/${phone}`)
    const doc = await tx.get(ref)
    if (!doc.exists) return null
    const sweep = sweepExpiredBuckets(tx, doc.data() as LoyaltyAccount, new Date())
    if (sweep.expiredPoints > 0) {
      tx.set(ref, { ...sweep.accountData, updatedAt: new Date().toISOString() })
      invalidateCache('loyalty:analytics')
    }
    return sweep.accountData
  })
  if (snap) invalidateCache(`loyalty:summary:${phone}`)
  return snap ? summarize(snap) : summarize(emptyLoyaltyAccount(phone, serverNow()))
}

export async function getCustomerLoyaltySnapshot(phone: string): Promise<LoyaltySnapshot> {
  return getCached(`loyalty:summary:${phone}`, 30 * 1000, async () => sweepAndSnapshot(phone))
}

export async function getCustomerLedger(phone: string, limit = 50): Promise<LoyaltyTransaction[]> {
  return getCached(`loyalty:ledger:${phone}:${limit}`, 30 * 1000, async () => {
    const snap = await getDb()
      .collection('loyaltyTransactions')
      .where('customerId', '==', phone)
      .limit(limit)
      .get()
    const list = snap.docs.map((d) => ({ ...(d.data() as LoyaltyTransaction), id: ((d.data() as LoyaltyTransaction).id as string | undefined) ?? d.id }))
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  })
}

export async function getCustomerRedemptions(phone: string, limit = 50): Promise<Redemption[]> {
  return getCached(`loyalty:redemptions:${phone}:${limit}`, 30 * 1000, async () => {
    const snap = await getDb()
      .collection('redemptions')
      .where('customerId', '==', phone)
      .limit(limit)
      .get()
    const list = snap.docs.map((d) => ({ ...(d.data() as Redemption), id: ((d.data() as Redemption).id as string | undefined) ?? d.id }))
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  })
}

// Rewards

export interface RewardWithEligibility extends Reward {
  eligibility: { eligible: boolean; code: string }
}

export async function listRewards(): Promise<Reward[]> {
  return getCached('loyalty:rewards', 15 * 60 * 1000, async () => {
    const snap = await getDb().collection('rewards').get()
    const list = snap.docs.map((d) => ({ ...(d.data() as Reward), id: ((d.data() as Reward).id as string | undefined) ?? d.id }))
    return list.sort((a, b) => a.pointsCost - b.pointsCost)
  })
}

export async function listPublicRewards(): Promise<Reward[]> {
  const all = await listRewards()
  const now = Date.now()
  return all.filter((r) => {
    if (!r.active) return false
    if (r.startAt && new Date(r.startAt).getTime() > now) return false
    if (r.endAt && new Date(r.endAt).getTime() < now) return false
    if (r.stock !== null && r.stock !== undefined && r.stock <= 0) return false
    return true
  })
}

export async function getReward(id: string): Promise<Reward | null> {
  // Fast path: find from cached rewards catalog first (0 reads)
  const rewards = await listRewards().catch(() => [])
  const found = rewards.find((r) => r.id === id)
  if (found) return found
  const snap = await getDb().doc(`rewards/${id}`).get()
  if (!snap.exists) return null
  return { ...(snap.data() as Reward), id: snap.id }
}

export async function upsertReward(data: {
  id?: string
  name: string
  description?: string
  imageUrl?: string | null
  type: RewardType
  pointsCost: number
  discountPaise?: number
  discountPctBps?: number
  discountMaxPaise?: number
  minOrderPaise?: number
  applicableItemIds?: string[]
  active?: boolean
  stock?: number | null
  startAt?: string | null
  endAt?: string | null
  maxPerCustomer?: number | null
}): Promise<Reward> {
  const db = getDb()
  const now = serverNow()
  if (data.id) {
    const rawUpdates: Record<string, unknown> = {
      updatedAt: now,
      name: data.name,
      description: data.description !== undefined ? data.description : undefined,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
      type: data.type,
      pointsCost: data.pointsCost,
      discountPaise: data.discountPaise !== undefined ? data.discountPaise : undefined,
      discountPctBps: data.discountPctBps !== undefined ? data.discountPctBps : undefined,
      discountMaxPaise: data.discountMaxPaise !== undefined ? data.discountMaxPaise : undefined,
      minOrderPaise: data.minOrderPaise !== undefined ? data.minOrderPaise : undefined,
      applicableItemIds: data.applicableItemIds !== undefined ? data.applicableItemIds : undefined,
      active: data.active !== undefined ? data.active : undefined,
      stock: data.stock !== undefined ? data.stock : undefined,
      startAt: data.startAt !== undefined ? data.startAt : undefined,
      endAt: data.endAt !== undefined ? data.endAt : undefined,
      maxPerCustomer: data.maxPerCustomer !== undefined ? data.maxPerCustomer : undefined,
    }
    const updates = stripUndefined(rawUpdates)
    await db.doc(`rewards/${data.id}`).update(updates)
    invalidateCache('loyalty:rewards')
    const snap = await db.doc(`rewards/${data.id}`).get()
    return { ...(snap.data() as Reward), id: snap.id }
  }
  const ref = db.collection('rewards').doc()
  const reward: Reward = {
    id: ref.id,
    restaurantId: RESTAURANT_ID,
    name: data.name,
    description: data.description || undefined,
    imageUrl: data.imageUrl || undefined,
    type: data.type,
    pointsCost: data.pointsCost,
    discountPaise: data.discountPaise ?? 0,
    discountPctBps: data.discountPctBps ?? 0,
    discountMaxPaise: data.discountMaxPaise ?? 0,
    minOrderPaise: data.minOrderPaise ?? 0,
    applicableItemIds: data.applicableItemIds ?? [],
    active: data.active ?? true,
    stock: data.stock ?? null,
    startAt: data.startAt ?? null,
    endAt: data.endAt ?? null,
    maxPerCustomer: data.maxPerCustomer ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await ref.set(stripUndefined(reward as unknown as Record<string, unknown>))
  invalidateCache('loyalty:rewards')
  return reward
}

export async function setRewardActive(id: string, active: boolean): Promise<void> {
  await getDb().doc(`rewards/${id}`).update({ active, updatedAt: serverNow() })
  invalidateCache('loyalty:rewards')
}

// Admin: customers, redemptions, analytics

export interface LoyaltyCustomerRow {
  phone: string
  name: string
  status: 'active' | 'suspended'
  verified: boolean
  createdAt: string
  lastLoginAt: string | null
  snapshot: LoyaltySnapshot
}

export async function listLoyaltyCustomers(limit = 200): Promise<LoyaltyCustomerRow[]> {
  const db = getDb()
  const [custSnap, accSnaps] = await Promise.all([
    db.collection('customerAccounts').limit(limit).get(),
    db.collection('loyaltyAccounts').limit(limit * 2).get(),
  ])
  const accountsByPhone = new Map(accSnaps.docs.map((d) => [d.id, d.data() as LoyaltyAccount]))
  const rows: LoyaltyCustomerRow[] = custSnap.docs.map((d) => {
    const cust = d.data() as CustomerAccount
    const acc = accountsByPhone.get(d.id)
    return {
      phone: d.id,
      name: cust.name,
      status: cust.status ?? 'active',
      verified: cust.verified ?? false,
      createdAt: cust.createdAt,
      lastLoginAt: cust.lastLoginAt ?? null,
      snapshot: acc
        ? summarize(acc)
        : summarize(emptyLoyaltyAccount(d.id, serverNow())),
    }
  })
  return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getAdminCustomerDetail(phone: string): Promise<{
  customer: Omit<CustomerAccount, 'passwordHash' | 'passwordSalt'> | null
  snapshot: LoyaltySnapshot
  transactions: LoyaltyTransaction[]
  redemptions: Redemption[]
} | null> {
  const customer = await getCustomerAccount(phone)
  if (!customer) return null
  const { passwordHash, passwordSalt, ...safe } = customer
  void passwordHash
  void passwordSalt
  const [snapshot, transactions, redemptions] = await Promise.all([
    getCustomerLoyaltySnapshot(phone),
    getCustomerLedger(phone, 100),
    getCustomerRedemptions(phone, 100),
  ])
  return { customer: safe, snapshot, transactions, redemptions }
}

export interface LoyaltyRedemptionRow extends Redemption {
  /** Optional join: order fulfilment for context. */
  orderStatus?: string | null
}

export async function listRedemptionsFilterable(status?: string, limit = 200): Promise<LoyaltyRedemptionRow[]> {
  const db = getDb()
  const q = status
    ? await db.collection('redemptions').where('status', '==', status).limit(limit).get()
    : await db.collection('redemptions').orderBy('createdAt', 'desc').limit(limit).get()
  const rows = q.docs.map((d) => ({ ...(d.data() as Redemption), id: ((d.data() as Redemption).id as string | undefined) ?? d.id })) as Redemption[]
  rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return rows
}

// ---------------------------------------------------------------------------
// Admin analytics
// ---------------------------------------------------------------------------

export interface LoyaltyAnalytics {
  enrolledCustomers: number
  pointsIssued: number
  pointsRedeemed: number
  pointsExpired: number
  pointsOutstanding: number
  redemptionsTotal: number
  redemptionsOpen: number
  popularRewards: Array<{ rewardId: string; rewardName: string; count: number; pointsSpent: number }>
  repeatCustomers: number
  redemptionCountsByStatus: Record<string, number>
  updatedAt: string
}

export async function getLoyaltyAnalytics(): Promise<LoyaltyAnalytics> {
  return getCached('loyalty:analytics', 20 * 1000, async () => {
    const db = getDb()
    const [accSnap, redSnap, earnSnap] = await Promise.all([
      db.collection('loyaltyAccounts').limit(500).get(),
      db.collection('redemptions').limit(500).get(),
      db.collection('loyaltyTransactions').where('type', '==', 'EARN').limit(500).get(),
    ])

    const accounts = accSnap.docs.map((d) => d.data() as LoyaltyAccount)
    const activeAccounts = accounts.filter((a) => a.earnedTotal > 0 || a.redeemedTotal > 0)
    const pointsIssued = activeAccounts.reduce((s, a) => s + a.earnedTotal, 0)
    const pointsRedeemed = activeAccounts.reduce((s, a) => s + a.redeemedTotal, 0)
    const pointsExpired = accounts.reduce((s, a) => s + a.expiredTotal, 0)
    const pointsOutstanding = accounts.reduce((s, a) => s + Math.max(0, a.availablePoints), 0)

    const redemptions = redSnap.docs.map((d) => d.data() as Redemption)
    const byStatus: Record<string, number> = {}
    for (const r of redemptions) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    const rewardAgg = new Map<string, { rewardName: string; count: number; pointsSpent: number }>()
    for (const r of redemptions) {
      const entry = rewardAgg.get(r.rewardId) ?? { rewardName: r.rewardName || r.rewardId, count: 0, pointsSpent: 0 }
      entry.count += 1
      entry.pointsSpent += r.pointsUsed
      rewardAgg.set(r.rewardId, entry)
    }
    const popularRewards = [...rewardAgg.entries()]
      .map(([rewardId, v]) => ({ rewardId, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Repeat customers: customers with >= 2 earn transactions (bounded read).
    const earnCounts = new Map<string, number>()
    for (const d of earnSnap.docs) {
      const t = d.data() as LoyaltyTransaction
      earnCounts.set(t.customerId, (earnCounts.get(t.customerId) ?? 0) + 1)
    }
    let repeatCustomers = 0
    for (const c of earnCounts.values()) if (c >= 2) repeatCustomers += 1

    return {
      enrolledCustomers: activeAccounts.length,
      pointsIssued,
      pointsRedeemed,
      pointsExpired,
      pointsOutstanding,
      redemptionsTotal: redemptions.length,
      redemptionsOpen: byStatus['APPLIED'] ?? 0,
      popularRewards,
      repeatCustomers,
      redemptionCountsByStatus: byStatus,
      updatedAt: serverNow(),
    }
  })
}


