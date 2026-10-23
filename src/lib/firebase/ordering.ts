import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import { getAdminFirestore } from './admin'
import { getCached, invalidateCache } from '../cache'
import { sendMobileOrderAlarm } from '../server/pushNotifier'
import { emitOrderStatusChange } from '../server/orderEvents'

// ==============================================================================
// Ordering persistence (Firestore, Admin SDK, server-only).
// Single-restaurant deployment: every doc carries restaurantId: 'default' for
// future-proofing; isolation today is per-Firebase-project.
// Money in integer paise. Timestamps are server-generated ISO strings.
// No hard-deletes for orders or payment records.
// ==============================================================================

function getDb(): Firestore {
  return getAdminFirestore()
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) clean[key] = value
  }
  return clean as T
}

const RESTAURANT_ID = 'default'
const serverNow = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// Dining tables + QR tokens
// ---------------------------------------------------------------------------

export type TableState = 'available' | 'occupied' | 'cleaning'

export interface DiningTable {
  id: string
  restaurantId: string
  label: string
  description?: string
  active: boolean
  state: TableState
  activeTokenHash: string | null
  activeTokenPrefix: string | null
  createdAt: string
  updatedAt: string
}

export interface TableQrToken {
  tokenHash: string
  tableId: string
  restaurantId: string
  /** Plaintext token — admin-only doc, never exposed publicly or logged. */
  token: string
  prefix: string
  revokedAt: string | null
  createdAt: string
}

export async function getTables(includeInactive = true): Promise<DiningTable[]> {
  const tables = await getCached('tables:all', 60 * 60 * 1000, async () => {
    const q = getDb().collection('diningTables').orderBy('label', 'asc')
    const snapshot = await q.get()
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as DiningTable)
  })

  // Auto-release tables:
  // - Tables in 'cleaning' for > 15 minutes auto-revert to 'available'
  // - Tables in 'occupied' for > 2 hours auto-revert to 'available'
  const now = Date.now()
  const staleTableIds: string[] = []

  const processed = tables.map((t) => {
    if (t.state === 'cleaning' || t.state === 'occupied') {
      const updatedMs = t.updatedAt ? new Date(t.updatedAt).getTime() : 0
      const ageMs = updatedMs > 0 ? now - updatedMs : Infinity
      const threshold = t.state === 'cleaning' ? 15 * 60 * 1000 : 2 * 60 * 60 * 1000

      if (ageMs > threshold) {
        staleTableIds.push(t.id)
        return { ...t, state: 'available' as TableState }
      }
    }
    return t
  })

  // Asynchronously sync stale tables in Firestore without blocking read response
  if (staleTableIds.length > 0) {
    Promise.allSettled(
      staleTableIds.map((id) =>
        getDb().doc(`diningTables/${id}`).update({ state: 'available', updatedAt: serverNow() })
      )
    ).catch(() => {})
    invalidateCache('tables:all')
  }

  return includeInactive ? processed : processed.filter((t) => t.active)
}

/** Reset all dining tables to available state. */
export async function freeAllTables(): Promise<number> {
  const q = getDb().collection('diningTables')
  const snap = await q.get()
  const batch = getDb().batch()
  let count = 0
  for (const doc of snap.docs) {
    const d = doc.data()
    if (d.state !== 'available') {
      batch.update(doc.ref, { state: 'available', updatedAt: serverNow() })
      count++
    }
  }
  if (count > 0) {
    await batch.commit()
    invalidateCache('tables:all')
  }
  return count
}

export async function getTable(id: string): Promise<DiningTable | null> {
  // Fast path: check cached tables list first to eliminate redundant reads (0 reads)
  const tables = await getTables(true).catch(() => [])
  const found = tables.find((t) => t.id === id)
  if (found) return found
  const snap = await getDb().doc(`diningTables/${id}`).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() } as DiningTable
}

/** Normalizes table labels (e.g. "Table 1", "table 1", "T-1", "01" -> "1") to prevent table collision. */
export function normalizeTableLabel(label: string): string {
  let clean = label.trim().toLowerCase()
  if (clean.startsWith('table')) clean = clean.slice(5).trim()
  if (clean.startsWith('t-') || clean.startsWith('t#')) clean = clean.slice(2).trim()
  else if (clean.startsWith('t') && /^t\d+$/.test(clean)) clean = clean.slice(1).trim()
  if (/^\d+$/.test(clean)) clean = String(parseInt(clean, 10))
  return clean
}

export async function createTable(data: { label: string; description?: string }): Promise<DiningTable> {
  const label = data.label.trim()
  const norm = normalizeTableLabel(label)
  const existing = await getTables(true)
  const duplicate = existing.find((t) => normalizeTableLabel(t.label) === norm)
  if (duplicate) {
    throw new Error(
      `Table "${label}" conflicts with existing Table "${duplicate.label}". Every table must have a distinct identifier.`
    )
  }

  const ref = getDb().collection('diningTables').doc()
  const now = serverNow()
  const table: Omit<DiningTable, 'id'> = {
    restaurantId: RESTAURANT_ID,
    label,
    description: data.description || undefined,
    active: true,
    state: 'available',
    activeTokenHash: null,
    activeTokenPrefix: null,
    createdAt: now,
    updatedAt: now,
  }
  await ref.set(stripUndefined({ ...table }))
  invalidateCache('tables:all')
  return { id: ref.id, ...table } as DiningTable
}

export async function updateTable(
  id: string,
  data: Partial<Pick<DiningTable, 'label' | 'description' | 'active' | 'state'>>
): Promise<void> {
  if (data.label) {
    const label = data.label.trim()
    const norm = normalizeTableLabel(label)
    const existing = await getTables(true)
    const duplicate = existing.find((t) => t.id !== id && normalizeTableLabel(t.label) === norm)
    if (duplicate) {
      throw new Error(
        `Table "${label}" conflicts with existing Table "${duplicate.label}". Every table must have a distinct identifier.`
      )
    }
  }

  await getDb()
    .doc(`diningTables/${id}`)
    .update(stripUndefined({ ...data, updatedAt: serverNow() }))
  invalidateCache('tables:all')
}

/** Delete a table, revoke its active/historical tokens, and ensure no active orders are left dangling. */
export async function deleteTable(id: string): Promise<void> {
  const db = getDb()
  const tableRef = db.doc(`diningTables/${id}`)
  const snap = await tableRef.get()
  if (!snap.exists) return

  const data = snap.data() as DiningTable

  // Check if there are active unfulfilled orders on this table
  const ordersSnap = await db.collection('orders').where('tableId', '==', id).get()
  const activeOrders = ordersSnap.docs.filter((d) => {
    const f = d.data()?.fulfilment
    return f && f !== 'SERVED' && f !== 'CANCELLED'
  })
  if (activeOrders.length > 0) {
    throw new Error(
      `Cannot delete table: Table "${data.label}" has ${activeOrders.length} active order(s) in progress. Please complete or cancel them first.`
    )
  }

  const batch = db.batch()

  // Revoke active token if one exists
  if (data?.activeTokenHash) {
    batch.update(db.doc(`tableQrTokens/${data.activeTokenHash}`), { revokedAt: serverNow() })
  }

  // Revoke any tokens associated with this table
  const tokensSnap = await db.collection('tableQrTokens').where('tableId', '==', id).get()
  tokensSnap.docs.forEach((doc) => {
    batch.update(doc.ref, { revokedAt: serverNow() })
  })

  // Delete the dining table doc
  batch.delete(tableRef)
  await batch.commit()
  invalidateCache('tables:all')
}

/** Issue (or rotate) a table QR token. Revokes the previous token, keeps history. */
export async function issueTableToken(
  tableId: string,
  token: string,
  tokenHash: string,
  prefix: string
): Promise<void> {
  const db = getDb()
  const tableRef = db.doc(`diningTables/${tableId}`)
  const tableSnap = await tableRef.get()
  if (!tableSnap.exists) throw new Error('Table not found')
  const prev = (tableSnap.data() as DiningTable).activeTokenHash

  const batch = db.batch()
  if (prev) {
    batch.update(db.doc(`tableQrTokens/${prev}`), { revokedAt: serverNow() })
    invalidateCache(`tableToken:${prev}`)
  }
  batch.set(db.doc(`tableQrTokens/${tokenHash}`), {
    tableId,
    restaurantId: RESTAURANT_ID,
    token,
    prefix,
    revokedAt: null,
    createdAt: serverNow(),
  })
  batch.update(tableRef, {
    activeTokenHash: tokenHash,
    activeTokenPrefix: prefix,
    updatedAt: serverNow(),
  })
  await batch.commit()
}

/** Revoke the active token without deleting the table or its history. */
export async function revokeTableToken(tableId: string): Promise<void> {
  const db = getDb()
  const tableRef = db.doc(`diningTables/${tableId}`)
  const tableSnap = await tableRef.get()
  if (!tableSnap.exists) throw new Error('Table not found')
  const prev = (tableSnap.data() as DiningTable).activeTokenHash
  const batch = db.batch()
  if (prev) {
    batch.update(db.doc(`tableQrTokens/${prev}`), { revokedAt: serverNow() })
    invalidateCache(`tableToken:${prev}`)
  }
  batch.update(tableRef, { activeTokenHash: null, activeTokenPrefix: null, updatedAt: serverNow() })
  await batch.commit()
}

export async function getTableTokenByHash(tokenHash: string): Promise<TableQrToken | null> {
  return getCached(`tableToken:${tokenHash}`, 5 * 60 * 1000, async () => {
    const snap = await getDb().doc(`tableQrTokens/${tokenHash}`).get()
    if (!snap.exists) return null
    return { tokenHash: snap.id, ...snap.data() } as TableQrToken
  })
}

/** Resolve a presented token to its table. Returns null for invalid/revoked/inactive. */
export async function resolveTableToken(
  tokenHash: string
): Promise<{ table: DiningTable; token: TableQrToken } | null> {
  const token = await getTableTokenByHash(tokenHash)
  if (!token || token.revokedAt) return null
  const table = await getTable(token.tableId)
  if (!table || !table.active) return null
  if (table.activeTokenHash !== token.tokenHash) return null // superseded
  return { table, token }
}

// ---------------------------------------------------------------------------
// Ordering config (tax, charges, general-ordering switch)
// ---------------------------------------------------------------------------

export interface OrderingConfig {
  taxRateBps: number
  serviceChargePaise: number
  generalOrderingEnabled: boolean
  currency: string
  updatedAt: string
}

export async function getOrderingConfig(): Promise<OrderingConfig> {
  return getCached('order:config', 60 * 60 * 1000, async () => {
    const snap = await getDb().doc('restaurant/ordering').get()
    if (!snap.exists) {
      return {
        taxRateBps: 500,
        serviceChargePaise: 0,
        generalOrderingEnabled: true,
        currency: 'INR',
        updatedAt: serverNow(),
      }
    }
    const d = snap.data() as Partial<OrderingConfig>
    return {
      taxRateBps: d.taxRateBps ?? 500,
      serviceChargePaise: d.serviceChargePaise ?? 0,
      generalOrderingEnabled: d.generalOrderingEnabled ?? true,
      currency: d.currency ?? 'INR',
      updatedAt: d.updatedAt ?? serverNow(),
    }
  })
}

export async function saveOrderingConfig(data: {
  taxRateBps: number
  serviceChargePaise: number
  generalOrderingEnabled: boolean
}): Promise<void> {
  await getDb()
    .doc('restaurant/ordering')
    .set({ ...data, currency: 'INR', updatedAt: serverNow() }, { merge: true })
  invalidateCache('order:config')
}

// ---------------------------------------------------------------------------
// Order menu catalog (separate from feedback `menuItems`)
// ---------------------------------------------------------------------------

export interface OrderMenuCategory {
  id: string
  restaurantId: string
  name: string
  position: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomizationChoice {
  id: string
  name: string
  pricePaise: number
}

export interface CustomizationGroup {
  id: string
  name: string
  type: 'single' | 'multi'
  required: boolean
  min: number
  max: number
  choices: CustomizationChoice[]
}

export interface OrderMenuItem {
  id: string
  restaurantId: string
  categoryId: string | null
  name: string
  description?: string
  imageUrl?: string
  pricePaise: number
  available: boolean
  visible: boolean
  veg: 'veg' | 'nonveg' | 'egg' | 'none'
  featured: boolean
  position: number
  feedbackMenuItemId?: string | null
  options: CustomizationGroup[]
  createdAt: string
  updatedAt: string
}

export async function getOrderMenuCategories(): Promise<OrderMenuCategory[]> {
  return getCached('order:categories', 60 * 60 * 1000, async () => {
    const snap = await getDb().collection('orderMenuCategories').orderBy('position', 'asc').get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderMenuCategory)
  })
}

export async function upsertOrderMenuCategory(data: {
  id?: string
  name: string
  position?: number
  active?: boolean
}): Promise<OrderMenuCategory> {
  const db = getDb()
  if (data.id) {
    await db.doc(`orderMenuCategories/${data.id}`).update(
      stripUndefined({ name: data.name, position: data.position, active: data.active, updatedAt: serverNow() })
    )
    invalidateCache('order:categories')
    const snap = await db.doc(`orderMenuCategories/${data.id}`).get()
    return { id: snap.id, ...snap.data() } as OrderMenuCategory
  }
  const ref = db.collection('orderMenuCategories').doc()
  const now = serverNow()
  const existing = await getOrderMenuCategories()
  const cat: Omit<OrderMenuCategory, 'id'> = {
    restaurantId: RESTAURANT_ID,
    name: data.name,
    position: data.position ?? existing.length + 1,
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now,
  }
  await ref.set(cat)
  invalidateCache('order:categories')
  return { id: ref.id, ...cat }
}

export async function getOrderMenuItems(): Promise<OrderMenuItem[]> {
  return getCached('order:menu_items', 60 * 60 * 1000, async () => {
    const snap = await getDb().collection('orderMenuItems').orderBy('position', 'asc').get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderMenuItem)
  })
}

export async function getOrderMenuItem(id: string): Promise<OrderMenuItem | null> {
  // Fast path: check cached menu items catalog first (0 reads)
  const items = await getOrderMenuItems().catch(() => [])
  const found = items.find((i) => i.id === id)
  if (found) return found
  const snap = await getDb().doc(`orderMenuItems/${id}`).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() } as OrderMenuItem
}

/** True when any historical order references the item (deletion protection). */
export async function isMenuItemReferenced(itemId: string): Promise<boolean> {
  const snap = await getDb().collection('orders').where('itemIds', 'array-contains', itemId).limit(1).get()
  return !snap.empty
}

export async function deleteOrderMenuItem(id: string): Promise<void> {
  await getDb().doc(`orderMenuItems/${id}`).delete()
  invalidateCache('order:menu_items')
}

export async function upsertOrderMenuItem(data: {
  id?: string
  categoryId?: string | null
  name: string
  description?: string
  imageUrl?: string | null
  pricePaise: number
  available?: boolean
  visible?: boolean
  veg?: OrderMenuItem['veg']
  featured?: boolean
  position?: number
  feedbackMenuItemId?: string | null
  options?: CustomizationGroup[]
}): Promise<OrderMenuItem> {
  const db = getDb()
  if (data.id) {
    await db.doc(`orderMenuItems/${data.id}`).update(
      stripUndefined({
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        pricePaise: data.pricePaise,
        available: data.available,
        visible: data.visible,
        veg: data.veg,
        featured: data.featured,
        position: data.position,
        feedbackMenuItemId: data.feedbackMenuItemId,
        options: data.options,
        updatedAt: serverNow(),
      })
    )
    invalidateCache('order:menu_items')
    const snap = await db.doc(`orderMenuItems/${data.id}`).get()
    return { id: snap.id, ...snap.data() } as OrderMenuItem
  }
  const ref = db.collection('orderMenuItems').doc()
  const now = serverNow()
  const existing = await getOrderMenuItems()
  const item: Omit<OrderMenuItem, 'id'> = {
    restaurantId: RESTAURANT_ID,
    categoryId: data.categoryId ?? null,
    name: data.name,
    description: data.description || undefined,
    imageUrl: data.imageUrl || undefined,
    pricePaise: data.pricePaise,
    available: data.available ?? true,
    visible: data.visible ?? true,
    veg: data.veg ?? 'none',
    featured: data.featured ?? false,
    position: data.position ?? existing.length + 1,
    feedbackMenuItemId: data.feedbackMenuItemId || undefined,
    options: data.options ?? [],
    createdAt: now,
    updatedAt: now,
  }
  await ref.set(stripUndefined({ ...item }))
  invalidateCache('order:menu_items')
  return { id: ref.id, ...item } as OrderMenuItem
}

export async function setOrderMenuItemAvailability(id: string, available: boolean): Promise<void> {
  await getDb().doc(`orderMenuItems/${id}`).update({ available, updatedAt: serverNow() })
  invalidateCache('order:menu_items')
}

export async function setOrderMenuItemVisibility(id: string, visible: boolean): Promise<void> {
  await getDb().doc(`orderMenuItems/${id}`).update({ visible, updatedAt: serverNow() })
  invalidateCache('order:menu_items')
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type FulfilmentStatus = 'RECEIVED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'
export type PaymentMethod = 'COUNTER'

export interface OrderItemSnapshot {
  itemId: string
  itemName: string
  unitPricePaise: number
  quantity: number
  options: Array<{
    groupId: string
    groupName: string
    optionId: string
    optionName: string
    pricePaise: number
  }>
  lineTotalPaise: number
}

export interface Order {
  id: string
  restaurantId: string
  orderNumber: string
  tableId: string | null
  tableLabel: string | null
  customerName: string
  customerPhone: string
  items: OrderItemSnapshot[]
  subtotalPaise: number
  taxPaise: number
  chargePaise: number
  totalPaise: number
  fulfilment: FulfilmentStatus
  paymentStatus: string
  paymentMethod: PaymentMethod
  paidPaise: number
  refundedPaise: number
  notes?: string
  idempotencyKey: string
  accessTokenHash: string
  /** Denormalized item IDs for reference-protection queries. */
  itemIds: string[]
  /** Loyalty: order may carry a checkout reward redemption. */
  loyalty?: {
    redemptionId: string | null
    rewardId: string | null
    rewardName: string | null
    discountPaise: number
    pointsUsed: number
  } | null
  /** Loyalty earn flags (set exactly once when the order completes). */
  loyaltyAwarded?: boolean
  loyaltyPointsEarned?: number
  createdAt: string
  updatedAt: string
}

export async function getOrderByIdempotencyKey(key: string): Promise<Order | null> {
  const snap = await getDb().collection('orders').where('idempotencyKey', '==', key).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Order
}

export async function getOrder(id: string): Promise<Order | null> {
  const now = Date.now()
  // Fast path 1: check in-memory active orders cache ONLY IF fresh (< 4s)
  if (activeOrdersCache.fetchedAt > 0 && now - activeOrdersCache.fetchedAt < 4000) {
    const inMemory = activeOrdersCache.orders.find((o) => o.id === id)
    if (inMemory) return inMemory
  }

  // Fast path 2: cached order read with request coalescing (3s TTL)
  return getCached(`order:${id}`, 3000, async () => {
    const snap = await getDb().doc(`orders/${id}`).get()
    if (!snap.exists) return null
    return { id: snap.id, ...snap.data() } as Order
  })
}

// ==============================================================================
// Active Orders In-Memory Cache with Request Coalescing
// Eliminates repetitive Firestore queries from high-frequency dashboard polling.
// Serves concurrent polls from memory with 0 Firestore reads.
// Automatically invalidated immediately on any order creation or status change.
// ==============================================================================
interface ActiveOrdersCacheState {
  orders: Order[]
  fetchedAt: number
  inFlight: Promise<Order[]> | null
  etag: string
}

declare global {
  var __rp_activeOrdersCache: ActiveOrdersCacheState | undefined
}

const activeOrdersCache: ActiveOrdersCacheState = (globalThis.__rp_activeOrdersCache ??= {
  orders: [],
  fetchedAt: 0,
  inFlight: null,
  etag: '',
})

export function computeOrdersEtag(list: Order[]): string {
  if (!list || list.length === 0) return 'W/"ao-empty"'
  let sig = `${list.length}`
  for (let i = 0; i < list.length; i++) {
    const o = list[i]
    sig += `|${o.id}:${o.fulfilment}:${o.paymentStatus}:${o.updatedAt || o.createdAt || ''}`
  }
  let hash = 5381
  for (let i = 0; i < sig.length; i++) {
    hash = (hash * 33) ^ sig.charCodeAt(i)
  }
  return `W/"ao-${(hash >>> 0).toString(36)}-${list.length}"`
}

export function invalidateActiveOrdersCache(): void {
  activeOrdersCache.fetchedAt = 0
  activeOrdersCache.inFlight = null
  activeOrdersCache.etag = `W/"ao-${Date.now()}"`
  invalidateCache('orders:')
  invalidateCache('order:')
}

export function getActiveOrdersEtag(): string {
  return activeOrdersCache.etag || computeOrdersEtag(activeOrdersCache.orders)
}

export async function getOrders(limit = 100): Promise<Order[]> {
  const snap = await getDb().collection('orders').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
}

/** 
 * Query only currently active kitchen/service orders in real-time.
 * Uses 4-second in-memory coalesced cache to protect Firestore from polling spikes.
 */
export async function getActiveOrders(limit = 50, forceFresh = false): Promise<Order[]> {
  const now = Date.now()
  const TTL_MS = 4000 // 4 seconds: shields Firestore against high-frequency polling bursts

  // 1. Fast-path: Return fresh in-memory data if valid and not forced
  if (
    !forceFresh &&
    activeOrdersCache.fetchedAt > 0 &&
    now - activeOrdersCache.fetchedAt < TTL_MS
  ) {
    return activeOrdersCache.orders.slice(0, limit)
  }

  // 2. Request coalescing: If a query is already running, await it instead of executing duplicate Firestore queries
  if (activeOrdersCache.inFlight) {
    try {
      const list = await activeOrdersCache.inFlight
      return list.slice(0, limit)
    } catch {
      // Fall through to query if coalesced promise failed
    }
  }

  // 3. Authoritative Firestore query with explicit limit
  const fetchPromise = (async () => {
    try {
      const snap = await getDb()
        .collection('orders')
        .where('fulfilment', 'in', ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'])
        .limit(60)
        .get()

      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

      activeOrdersCache.orders = list
      activeOrdersCache.fetchedAt = Date.now()

      activeOrdersCache.etag = computeOrdersEtag(list)

      return list
    } finally {
      activeOrdersCache.inFlight = null
    }
  })()

  activeOrdersCache.inFlight = fetchPromise
  const result = await fetchPromise
  return result.slice(0, limit)
}

/** Query orders by specific fulfilment status (e.g. SERVED, CANCELLED) with indexing. */
export async function getOrdersByFulfilment(status: FulfilmentStatus, limit = 50): Promise<Order[]> {
  const snap = await getDb()
    .collection('orders')
    .where('fulfilment', '==', status)
    .limit(limit)
    .get()
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
  docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return docs.slice(0, limit)
}

/** Efficient query for active orders at a specific table (reads max 5 docs instead of entire history). */
export async function getActiveOrdersByTable(tableId: string): Promise<Order[]> {
  const now = Date.now()
  // If active orders cache is warm, filter directly from memory for 0 Firestore reads!
  if (activeOrdersCache.fetchedAt > 0 && now - activeOrdersCache.fetchedAt < 4000) {
    return activeOrdersCache.orders
      .filter((o) => o.tableId === tableId)
      .slice(0, 5)
  }

  const snap = await getDb()
    .collection('orders')
    .where('tableId', '==', tableId)
    .where('fulfilment', 'in', ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'])
    .limit(5)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
}

export async function getOrdersByTable(tableId: string, limit = 20): Promise<Order[]> {
  const snap = await getDb()
    .collection('orders')
    .where('tableId', '==', tableId)
    .limit(limit)
    .get()
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

/** Recent orders placed by a customer phone (loyalty account area). */
export async function getOrdersByPhone(phone: string, limit = 30): Promise<Order[]> {
  const digits = phone.replace(/\D/g, '').replace(/^91/, '').slice(-10)
  const variants = Array.from(new Set([digits, `+91${digits}`, `91${digits}`, phone])).filter(Boolean)
  return getCached(`orders:phone:${digits || phone}:${limit}`, 15 * 1000, async () => {
    const db = getDb()
    const snap = await db
      .collection('orders')
      .where('customerPhone', 'in', variants)
      .limit(limit)
      .get()
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)
    return docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  })
}

/** Allocate the next human-readable order number atomically. */
export async function allocateOrderNumber(): Promise<{ seq: number; orderNumber: string }> {
  const seq = await getDb().runTransaction(async (tx) => {
    const ref = getDb().doc('counters/orderNumber')
    const snap = await tx.get(ref)
    const next = ((snap.exists ? (snap.data()?.seq as number) : 0) || 0) + 1
    tx.set(ref, { seq: next, updatedAt: serverNow() }, { merge: true })
    return next
  })
  return { seq, orderNumber: `ORD-${String(seq).padStart(6, '0')}` }
}

export async function createOrder(data: Omit<Order, 'id'>): Promise<Order> {
  const ref = getDb().collection('orders').doc()
  await ref.set(stripUndefined({ ...data }))
  if (data.tableId) {
    await getDb()
      .doc(`diningTables/${data.tableId}`)
      .update({ state: 'occupied', updatedAt: serverNow() })
      .catch(() => {})
    invalidateCache('tables:all')
  }
  invalidateActiveOrdersCache()
  invalidateCache(`order:${ref.id}`)
  if (data.customerPhone) {
    invalidateCache(`orders:phone:${data.customerPhone}`)
  }

  // Trigger loud mobile push alarm (ntfy / Swiggy style alert)
  sendMobileOrderAlarm({
    orderNumber: data.orderNumber,
    tableLabel: data.tableLabel,
    totalPaise: data.totalPaise,
    items: data.items,
  }).catch((err) => {
    console.warn('[PushNotifier] Error sending mobile alarm:', err)
  })

  return { id: ref.id, ...data } as Order
}

/** Validated fulfilment transition inside a transaction + audit event. */
export async function transitionOrderStatus(
  orderId: string,
  to: FulfilmentStatus,
  actor: { uid: string; email?: string | null },
  reason?: string
): Promise<Order> {
  const db = getDb()
  const allowed: Record<string, string[]> = {
    RECEIVED: ['ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'],
    ACCEPTED: ['PREPARING', 'READY', 'SERVED', 'CANCELLED', 'RECEIVED'],
    PREPARING: ['READY', 'SERVED', 'CANCELLED', 'ACCEPTED', 'RECEIVED'],
    READY: ['SERVED', 'PREPARING', 'ACCEPTED', 'CANCELLED'],
    SERVED: ['READY', 'PREPARING', 'ACCEPTED', 'CANCELLED'],
    CANCELLED: ['RECEIVED', 'ACCEPTED'],
  }
  const updated = await db.runTransaction(async (tx) => {
    const ref = db.doc(`orders/${orderId}`)
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('NOT_FOUND')
    const order = { id: snap.id, ...snap.data() } as Order
    if (!allowed[order.fulfilment]?.includes(to)) throw new Error('INVALID_TRANSITION')
    tx.update(ref, { fulfilment: to, updatedAt: serverNow() })
    const eventRef = db.collection('orderEvents').doc()
    tx.set(eventRef, {
      orderId,
      restaurantId: RESTAURANT_ID,
      type: 'STATUS',
      actorUid: actor.uid,
      actorEmail: actor.email || null,
      prev: order.fulfilment,
      next: to,
      reason: reason || null,
      createdAt: serverNow(),
    })
    return { ...order, fulfilment: to }
  })

  // Table state management: if order is served or cancelled, check if table has any remaining active orders
  if ((to === 'SERVED' || to === 'CANCELLED') && updated.tableId) {
    try {
      const remainingSnap = await db
        .collection('orders')
        .where('tableId', '==', updated.tableId)
        .limit(25)
        .get()
      const hasActiveOrders = remainingSnap.docs.some(
        (d) => d.id !== orderId && ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'].includes(d.data().fulfilment)
      )
      if (!hasActiveOrders) {
        await db
          .doc(`diningTables/${updated.tableId}`)
          .update({ state: to === 'SERVED' ? 'cleaning' : 'available', updatedAt: serverNow() })
          .catch(() => {})
        invalidateCache('tables:all')
      }
    } catch {
      // Non-critical background state sync
    }
  }

  // Loyalty lifecycle: award exactly once on completion; reverse/cancel on
  // cancellation. Failures here must never break the kitchen flow.
  try {
    const loyalty = await import('./loyalty')
    if (to === 'SERVED') {
      await loyalty.handleOrderFulfilledForLoyalty({
        id: updated.id,
        orderNumber: updated.orderNumber,
        totalPaise: updated.totalPaise,
        subtotalPaise: updated.subtotalPaise,
        customerPhone: updated.customerPhone,
        loyaltyAwarded: updated.loyaltyAwarded,
        loyalty: updated.loyalty
          ? {
              redemptionId: updated.loyalty.redemptionId,
              pointsUsed: updated.loyalty.pointsUsed,
            }
          : null,
      })
      invalidateActiveOrdersCache()
    } else if (to === 'CANCELLED') {
      await loyalty.handleOrderCancelledForLoyalty({
        id: updated.id,
        orderNumber: updated.orderNumber,
        customerPhone: updated.customerPhone,
        loyaltyAwarded: updated.loyaltyAwarded,
        loyaltyPointsEarned: updated.loyaltyPointsEarned,
        loyalty: updated.loyalty ? { redemptionId: updated.loyalty.redemptionId } : null,
      })
      invalidateActiveOrdersCache()
    }
  } catch (err) {
    console.error(`[Loyalty] lifecycle hook failed for order ${orderId}:`, err)
  }

  // Update in-memory active orders cache immediately so concurrent getOrder calls see the new status
  const existingIdx = activeOrdersCache.orders.findIndex((o) => o.id === orderId)
  if (existingIdx !== -1) {
    if (to === 'SERVED' || to === 'CANCELLED') {
      activeOrdersCache.orders.splice(existingIdx, 1)
    } else {
      activeOrdersCache.orders[existingIdx] = {
        ...activeOrdersCache.orders[existingIdx],
        fulfilment: to,
        updatedAt: serverNow(),
      }
    }
  }

  invalidateActiveOrdersCache()
  invalidateCache(`order:${orderId}`)
  if (updated.customerPhone) {
    invalidateCache(`orders:phone:${updated.customerPhone}`)
  }

  // Broadcast instant real-time event for zero-latency customer updates
  emitOrderStatusChange(orderId, {
    orderId,
    orderNumber: updated.orderNumber,
    fulfilment: to,
    paymentStatus: updated.paymentStatus,
    tableLabel: updated.tableLabel,
    updatedAt: serverNow(),
  })

  return updated
}

/** Update order details (table, notes, customer, status). */
export async function updateOrder(
  orderId: string,
  updates: {
    tableId?: string | null
    tableLabel?: string | null
    customerName?: string
    customerPhone?: string
    notes?: string | null
    fulfilment?: FulfilmentStatus
  },
  actor: { uid: string; email?: string | null }
): Promise<Order> {
  const db = getDb()
  const ref = db.doc(`orders/${orderId}`)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('NOT_FOUND')
  const prev = { id: snap.id, ...snap.data() } as Order

  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverNow(),
  }

  if (updates.tableId !== undefined) {
    cleanUpdates.tableId = updates.tableId
    cleanUpdates.tableLabel = updates.tableLabel ?? null
  }
  if (updates.customerName !== undefined) cleanUpdates.customerName = updates.customerName.trim()
  if (updates.customerPhone !== undefined) cleanUpdates.customerPhone = updates.customerPhone.trim()
  if (updates.notes !== undefined) cleanUpdates.notes = updates.notes ? updates.notes.trim() : null
  if (updates.fulfilment !== undefined) cleanUpdates.fulfilment = updates.fulfilment

  await ref.update(cleanUpdates)

  // Audit event
  const eventRef = db.collection('orderEvents').doc()
  await eventRef.set({
    orderId,
    restaurantId: RESTAURANT_ID,
    type: 'UPDATE',
    actorUid: actor.uid,
    actorEmail: actor.email || null,
    reason: 'Manager updated order details',
    createdAt: serverNow(),
  })

  // Table state management if table changed
  if (updates.tableId !== undefined && updates.tableId !== prev.tableId) {
    if (updates.tableId) {
      await db.doc(`diningTables/${updates.tableId}`).update({ state: 'occupied', updatedAt: serverNow() }).catch(() => {})
    }
  }

  invalidateActiveOrdersCache()
  invalidateCache(`order:${orderId}`)
  const changedPhone = updates.customerPhone || prev.customerPhone
  if (changedPhone) {
    invalidateCache(`orders:phone:${changedPhone}`)
  }
  const updatedSnap = await ref.get()
  return { id: updatedSnap.id, ...updatedSnap.data() } as Order
}

/** Record a collection/refund inside a transaction. Prevents over-collection. */
export async function recordPaymentEntry(data: {
  orderId: string
  kind: 'collection' | 'refund'
  amountPaise: number
  method: string
  staffUid: string
  staffEmail?: string | null
  reference?: string
}): Promise<Order> {
  const db = getDb()
  const updated = await db.runTransaction(async (tx) => {
    const ref = db.doc(`orders/${data.orderId}`)
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('NOT_FOUND')
    const order = { id: snap.id, ...snap.data() } as Order
    if (order.fulfilment === 'CANCELLED') throw new Error('ORDER_CANCELLED')

    let paid = order.paidPaise
    let refunded = order.refundedPaise
    if (data.kind === 'collection') {
      if (paid + data.amountPaise > order.totalPaise) throw new Error('OVER_COLLECTION')
      paid += data.amountPaise
    } else {
      if (refunded + data.amountPaise > paid) throw new Error('REFUND_EXCEEDS_PAID')
      refunded += data.amountPaise
    }
    // Derive payment status (refund status requires a recorded refund — enforced here).
    let paymentStatus = 'UNPAID'
    if (refunded >= paid && paid > 0) paymentStatus = 'REFUNDED'
    else if (refunded > 0) paymentStatus = 'PARTIALLY_REFUNDED'
    else if (paid >= order.totalPaise) paymentStatus = 'PAID'
    else if (paid > 0) paymentStatus = 'PARTIALLY_PAID'

    tx.update(ref, { paidPaise: paid, refundedPaise: refunded, paymentStatus, updatedAt: serverNow() })
    const entryRef = db.collection('paymentEntries').doc()
    tx.set(entryRef, {
      orderId: data.orderId,
      restaurantId: RESTAURANT_ID,
      kind: data.kind,
      amountPaise: data.amountPaise,
      method: data.method,
      staffUid: data.staffUid,
      staffEmail: data.staffEmail || null,
      reference: data.reference || null,
      createdAt: serverNow(),
    })
    const eventRef = db.collection('orderEvents').doc()
    tx.set(eventRef, {
      orderId: data.orderId,
      restaurantId: RESTAURANT_ID,
      type: data.kind === 'collection' ? 'PAYMENT_COLLECTED' : 'REFUND_RECORDED',
      actorUid: data.staffUid,
      actorEmail: data.staffEmail || null,
      prev: order.paymentStatus,
      next: paymentStatus,
      reason: data.reference || null,
      createdAt: serverNow(),
    })
    return { ...order, paidPaise: paid, refundedPaise: refunded, paymentStatus }
  })
  invalidateActiveOrdersCache()
  invalidateCache('payments:recent')
  invalidateCache(`order:${data.orderId}`)

  // Loyalty: on a FULL refund, settle earned points + redemption per policy.
  if (updated.paymentStatus === 'REFUNDED') {
    try {
      const loyalty = await import('./loyalty')
      await loyalty.handleOrderRefundForLoyalty(
        {
          id: updated.id,
          orderNumber: updated.orderNumber,
          customerPhone: updated.customerPhone,
          loyaltyAwarded: updated.loyaltyAwarded,
          loyaltyPointsEarned: updated.loyaltyPointsEarned,
          loyalty: updated.loyalty ? { redemptionId: updated.loyalty.redemptionId } : null,
        },
        data.amountPaise
      )
    } catch (err) {
      console.error(`[Loyalty] refund settlement failed for order ${data.orderId}:`, err)
    }
  }
  return updated
}

export interface OrderEvent {
  id: string
  orderId: string
  type: string
  actorUid?: string
  actorEmail?: string | null
  prev?: string | null
  next?: string | null
  reason?: string | null
  createdAt: string
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const snap = await getDb()
    .collection('orderEvents')
    .where('orderId', '==', orderId)
    .limit(20)
    .get()
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrderEvent)
  return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}

export interface PaymentEntry {
  id: string
  orderId: string
  kind: 'collection' | 'refund'
  amountPaise: number
  method: string
  staffUid: string
  staffEmail?: string | null
  reference?: string | null
  createdAt: string
}

export async function getPaymentEntries(orderId: string): Promise<PaymentEntry[]> {
  const snap = await getDb()
    .collection('paymentEntries')
    .where('orderId', '==', orderId)
    .get()
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentEntry)
  return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}

export async function getRecentPaymentEntries(limit = 300): Promise<PaymentEntry[]> {
  return getCached(`payments:recent:${limit}`, 3 * 60 * 1000, async () => {
    const snap = await getDb().collection('paymentEntries').orderBy('createdAt', 'desc').limit(limit).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentEntry)
  })
}

// ---------------------------------------------------------------------------
// Service requests (call staff)
// ---------------------------------------------------------------------------

export interface ServiceRequest {
  id: string
  restaurantId: string
  tableId: string
  tableLabel: string
  type: string
  note?: string
  status: 'OPEN' | 'ACK' | 'RESOLVED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
}

export async function createServiceRequest(data: {
  tableId: string
  tableLabel: string
  type: string
  note?: string
}): Promise<ServiceRequest> {
  const ref = getDb().collection('serviceRequests').doc()
  const now = serverNow()
  const req: Omit<ServiceRequest, 'id'> = {
    restaurantId: RESTAURANT_ID,
    tableId: data.tableId,
    tableLabel: data.tableLabel,
    type: data.type,
    note: data.note || undefined,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  }
  await ref.set(stripUndefined({ ...req }))
  invalidateCache('serviceRequests')
  return { id: ref.id, ...req } as ServiceRequest
}

export async function getServiceRequests(status?: string, limit = 50): Promise<ServiceRequest[]> {
  const cacheKey = status ? `serviceRequests:${status}` : 'serviceRequests:all'
  const list = await getCached(cacheKey, 6000, async () => {
    if (status) {
      const snap = await getDb()
        .collection('serviceRequests')
        .where('status', '==', status)
        .limit(50)
        .get()
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest)
      return docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    }
    const snap = await getDb().collection('serviceRequests').orderBy('createdAt', 'desc').limit(50).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceRequest)
  })
  return list.slice(0, limit)
}

export async function updateServiceRequest(id: string, status: ServiceRequest['status']): Promise<void> {
  const updates: Record<string, unknown> = { status, updatedAt: serverNow() }
  if (status === 'RESOLVED' || status === 'CANCELLED') updates.resolvedAt = serverNow()
  await getDb().doc(`serviceRequests/${id}`).update(updates)
  invalidateCache('serviceRequests')
}
