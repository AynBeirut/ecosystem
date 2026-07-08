/**
 * In-memory TTL cache for anonymous/public Firestore reads (L1 cost guardrail).
 * Reduces repeat getDocs/getDoc traffic during a single browser session.
 */

const DEFAULT_TTL_MS = 60_000;

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getPublicReadCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

export function setPublicReadCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidatePublicReadCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function cachedPublicRead<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = getPublicReadCache<T>(key);
  if (hit !== null) return hit;
  const fresh = await fetcher();
  setPublicReadCache(key, fresh, ttlMs);
  return fresh;
}
