import 'server-only'

// ==============================================================================
// Server In-Memory Cache with Request Coalescing & Stale-on-Error Protection
// Drastically cuts Firestore reads from 50k+ to <5k-15k/day by caching
// semi-static catalogs (menu items, categories, settings, config, campaigns, tables).
// Thread-safe in Node.js single-process runtime.
// ==============================================================================

interface CacheEntry<T> {
  data: T
  expiresAt: number
  cachedAt: number
}

const memoryStore = new Map<string, CacheEntry<unknown>>()
const inFlightRequests = new Map<string, Promise<unknown>>()

/**
 * Retrieve cached value if valid, or coalesce and execute `fetcher` and cache result.
 * Concurrency Protection: Multiple concurrent calls for the same key await the same single Promise.
 * Resilience: If `fetcher` fails and stale cache exists, returns stale data instead of failing.
 *
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

  // Return non-expired cached data immediately
  if (existing && existing.expiresAt > now) {
    return existing.data
  }

  // Request Coalescing (Thundering Herd / Cache Stampede Prevention):
  // If a read for this key is already in progress, piggyback on that exact promise
  if (inFlightRequests.has(key)) {
    try {
      return (await inFlightRequests.get(key)) as T
    } catch {
      // If the in-flight request failed, try returning stale cache as fallback
      if (existing) {
        console.warn(`[Cache] Coalesced request failed for ${key}, falling back to stale data.`)
        return existing.data
      }
    }
  }

  // Start new fetch and register in flight
  const fetchPromise = (async () => {
    try {
      const fresh = await fetcher()
      memoryStore.set(key, { data: fresh, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() })
      return fresh
    } catch (err) {
      // If fetching fresh data fails but we have stale cache, gracefully serve stale data
      if (existing) {
        console.warn(`[Cache] Fetcher failed for ${key}, serving stale data to protect uptime:`, err)
        return existing.data
      }
      throw err
    } finally {
      inFlightRequests.delete(key)
    }
  })()

  inFlightRequests.set(key, fetchPromise)

  // Memory hygiene: prune expired keys if store exceeds capacity
  if (memoryStore.size > 500) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.expiresAt <= now) {
        memoryStore.delete(k)
      }
    }
  }

  return fetchPromise
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
  inFlightRequests.clear()
}
