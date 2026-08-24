/** Session cache for V·POS / V·Buy catalogs + trial skip flags. Survives SPA remounts via sessionStorage. */

const TTL_MS = 30 * 60 * 1000;
const SS_PREFIX = 'grabio:vops:';

type Entry<T> = { at: number; data: T };

const mem = new Map<string, Entry<unknown>>();

function ssKey(key: string): string {
  return `${SS_PREFIX}${key}`;
}

function readSession<T>(key: string): Entry<T> | null {
  try {
    const raw = sessionStorage.getItem(ssKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(ssKey(key));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, entry: Entry<T>): void {
  try {
    sessionStorage.setItem(ssKey(key), JSON.stringify(entry));
  } catch {
    // quota / private mode — memory cache still works
  }
}

export function vOpsCacheGet<T>(key: string): T | null {
  const hit = mem.get(key);
  if (hit) {
    if (Date.now() - hit.at > TTL_MS) {
      mem.delete(key);
    } else {
      return hit.data as T;
    }
  }
  const fromSs = readSession<T>(key);
  if (!fromSs) return null;
  mem.set(key, fromSs);
  return fromSs.data;
}

export function vOpsCacheSet<T>(key: string, data: T): void {
  const entry: Entry<T> = { at: Date.now(), data };
  mem.set(key, entry);
  writeSession(key, entry);
}

export function vOpsCacheKey(kind: string, storeId: string): string {
  return `vops:${kind}:${storeId}`;
}

/** Remember non-trial stores so save skips the trial Firestore transaction. */
export function markStoreNotTrial(storeId: string): void {
  vOpsCacheSet(vOpsCacheKey('notTrial', storeId), true);
}

export function isStoreMarkedNotTrial(storeId: string): boolean {
  return vOpsCacheGet<boolean>(vOpsCacheKey('notTrial', storeId)) === true;
}

/** Module-level route gate cache — ProtectedRoute remounts on every admin path. */
const gateSubAllowed = new Set<string>();
const gateIpAllowed = new Set<string>();

export function gateSubscriptionAllowed(storeId: string): boolean {
  return Boolean(storeId && gateSubAllowed.has(storeId));
}

export function markGateSubscriptionAllowed(storeId: string): void {
  if (storeId) gateSubAllowed.add(storeId);
}

export function gateIpAllowedFor(storeId: string): boolean {
  return Boolean(storeId && gateIpAllowed.has(storeId));
}

export function markGateIpAllowed(storeId: string): void {
  if (storeId) gateIpAllowed.add(storeId);
}
