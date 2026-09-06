export type UsdLbpRateCache = {
  rate: number;
  fetchedAt: number;
};

const CACHE_KEY = 'grabioUsdToLbpRate';
const TTL_MS = 10 * 60 * 1000;

async function fetchRateFromOpenErApi(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error(`rate fetch failed: ${res.status}`);
  const data = await res.json();
  const rate = data?.rates?.LBP;
  if (!rate || typeof rate !== 'number' || !(rate > 0)) throw new Error('invalid rate response');
  return rate;
}

/** Live USD→LBP (1 USD = X LBP). Used when profile auto mode has no stored rate yet. */
export async function fetchUsdToLbpRateFresh(): Promise<UsdLbpRateCache> {
  const rate = await fetchRateFromOpenErApi();
  const next: UsdLbpRateCache = { rate, fetchedAt: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

function readCachedUsdToLbpRate(allowStale = false): UsdLbpRateCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as UsdLbpRateCache;
    if (!cached?.rate || !(cached.rate > 0)) return null;
    if (!allowStale && Date.now() - (cached.fetchedAt || 0) >= TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

export async function getUsdToLbpRateCached(): Promise<UsdLbpRateCache | null> {
  return readCachedUsdToLbpRate(false);
}

/** Cached (10 min) then live API. Display-only — never writes store profile. */
export async function resolveLiveUsdToLbpRate(): Promise<number | undefined> {
  const cached = readCachedUsdToLbpRate(false);
  if (cached) return cached.rate;
  try {
    const fresh = await fetchUsdToLbpRateFresh();
    return fresh.rate;
  } catch {
    return readCachedUsdToLbpRate(true)?.rate;
  }
}
