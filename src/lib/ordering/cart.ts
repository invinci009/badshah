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
