type CacheEntry<T> = { at: number; value: T };

const DEFAULT_TTL_MS = 300_000; // 5 min
const CLIENTS_TTL_MS = 300_000;

const cache = new Map<string, CacheEntry<unknown>>();
const ttlByPrefix: Array<{ prefix: string; ttl: number }> = [
  { prefix: 'clients:', ttl: CLIENTS_TTL_MS },
  { prefix: 'clients:v2:', ttl: CLIENTS_TTL_MS },
  { prefix: 'routes:', ttl: CLIENTS_TTL_MS },
  { prefix: 'pos:', ttl: 180_000 },
];

function ttlForKey(key: string): number {
  const row = ttlByPrefix.find((r) => key.startsWith(r.prefix));
  return row?.ttl ?? DEFAULT_TTL_MS;
}

export function readCache<T>(key: string): T | null {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > ttlForKey(key)) {
    cache.delete(key);
    return null;
  }
  return row.value as T;
}

export function writeCache<T>(key: string, value: T): void {
  cache.set(key, { at: Date.now(), value });
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
