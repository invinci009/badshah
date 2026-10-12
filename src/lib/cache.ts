import 'server-only'

// ==============================================================================
// Server In-Memory Cache for Firestore Read Optimization
// Drastically cuts Firestore reads from 50k+ to <5k-15k/day by caching
// semi-static catalogs (menu items, categories, settings, config, campaigns, tables).
// Thread-safe in Node.js single-process runtime.
// ==============================================================================

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const memoryStore = new Map<string, CacheEntry<unknown>>()

/**
 * Retrieve cached value if valid, or execute `fetcher` and cache result.
 * @param key Cache identifier
 * @param ttlMs Time-to-live in milliseconds
 * @param fetcher Async function that performs the authoritative database read
 */
export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const existing = memoryStore.get(key) as CacheEntry<T> | undefined

  if (existing && existing.expiresAt > now) {
    return existing.data
  }

  const fresh = await fetcher()
  memoryStore.set(key, { data: fresh, expiresAt: now + ttlMs })

  // Memory hygiene: prune expired keys if store gets large
  if (memoryStore.size > 500) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.expiresAt <= now) {
        memoryStore.delete(k)
      }
    }
  }

  return fresh
}

/**
 * Invalidate all cache entries matching a prefix or exact key.
 * Call whenever an administrative mutation happens (save settings, edit menu, etc.).
 */
export function invalidateCache(keyPrefix: string): void {
  for (const key of memoryStore.keys()) {
    if (key === keyPrefix || key.startsWith(`${keyPrefix}:`) || key.startsWith(keyPrefix)) {
      memoryStore.delete(key)
    }
  }
}

/** Clear entire in-memory cache */
export function clearAllCache(): void {
  memoryStore.clear()
}
