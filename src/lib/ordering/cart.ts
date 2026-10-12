// Client-safe cart helpers (localStorage persistence + quote preview).
// Server remains the authority for prices/totals at checkout.
// Table-aware storage ensures no two tables share cart items or collide.

export interface CartSelection {
  groupId: string
  optionId: string
}

export interface CartLine {
  key: string
  itemId: string
  quantity: number
  selections: CartSelection[]
}

export function cartLineKey(itemId: string, selections: CartSelection[]): string {
  const sorted = [...selections].sort((a, b) =>
    a.groupId === b.groupId ? a.optionId.localeCompare(b.optionId) : a.groupId.localeCompare(b.groupId)
  )
  return `${itemId}::${sorted.map((s) => `${s.groupId}=${s.optionId}`).join(',')}`
}

/**
 * Returns a unique storage key per restaurant and table.
 * If a table is provided, the cart is isolated to that table so orders never collide.
 */
export function cartKey(slug: string, table?: string | null): string {
  if (table && table.trim()) {
    const cleanTable = table.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    return `rp_cart_${slug}_tbl_${cleanTable}`
  }
  return `rp_cart_${slug}`
}

export function loadCart(slug: string, table?: string | null): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const key = cartKey(slug, table)
    let raw = window.localStorage.getItem(key)

    // Fallback: If table-specific cart is empty, check general cart for migration
    if (!raw && table) {
      raw = window.localStorage.getItem(`rp_cart_${slug}`)
    }

    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((l) => l && typeof l.itemId === 'string' && l.quantity >= 1)
  } catch {
    return []
  }
}

export function saveCart(slug: string, lines: CartLine[], table?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    const key = cartKey(slug, table)
    window.localStorage.setItem(key, JSON.stringify(lines))
  } catch {
    // storage full / private mode — cart still works in memory
  }
}

export function clearCart(slug: string, table?: string | null): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(cartKey(slug, table))
    // Also clean up general cart if table was provided
    if (table) {
      window.localStorage.removeItem(`rp_cart_${slug}`)
    }
  } catch {
    // ignore
  }
}

export interface ActiveSession {
  orderId: string
  orderNumber?: string
  accessToken?: string
  tableLabel: string
  customerPhone?: string
  customerName?: string
  fulfilment?: string
  createdAt: string
}

/** Maximum age for an active table booking banner on the customer's device (2 hours). */
export const ACTIVE_SESSION_TTL_MS = 2 * 60 * 60 * 1000

export function getActiveOrderSession(slug: string): ActiveSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`rp_active_order_${slug}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveSession
    if (!parsed || !parsed.tableLabel || !parsed.createdAt) {
      window.localStorage.removeItem(`rp_active_order_${slug}`)
      return null
    }

    const age = Date.now() - new Date(parsed.createdAt).getTime()
    // Auto-expire after 2 hours
    if (isNaN(age) || age > ACTIVE_SESSION_TTL_MS || age < 0) {
      window.localStorage.removeItem(`rp_active_order_${slug}`)
      return null
    }

    // Auto-expire after 30 minutes if already served or cancelled
    if (
      (parsed.fulfilment === 'SERVED' || parsed.fulfilment === 'CANCELLED') &&
      age > 30 * 60 * 1000
    ) {
      window.localStorage.removeItem(`rp_active_order_${slug}`)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function saveActiveOrderSession(slug: string, session: ActiveSession): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`rp_active_order_${slug}`, JSON.stringify(session))
  } catch {
    // storage unavailable
  }
}

export function clearActiveOrderSession(slug: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(`rp_active_order_${slug}`)
  } catch {
    // ignore
  }
}
