export type RateCache = {
  rate: number;
  fetchedAt: number;
};

const CACHE_KEY = 'usdToLbpRate';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchRateFromApi(): Promise<number> {
  // Public, no-key endpoint. If your project requires a paid provider, swap this here.
  const url = 'https://api.exchangerate.host/latest?base=USD&symbols=LBP';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rate fetch failed: ${res.status}`);
  const data = await res.json();
  const rate = data?.rates?.LBP;
  if (!rate || typeof rate !== 'number') throw new Error('invalid rate response');
  return rate;
}

export async function getUsdToLbpRate(): Promise<RateCache> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached: RateCache = JSON.parse(raw);
      if (Date.now() - (cached.fetchedAt || 0) < TTL_MS) {
        return cached;
      }
    }

    const rate = await fetchRateFromApi();
    const next: RateCache = { rate, fetchedAt: Date.now() };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch (e) {
      // ignore storage errors
    }
    return next;
  } catch (err) {
    // On failure, return cached value if present, otherwise fallback to 1
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw) as RateCache;
    } catch (e) {
      // ignore
    }
    return { rate: 1, fetchedAt: Date.now() };
  }
}

export function formatLbp(amountUsd: number, rate: number) {
  const lbp = Math.round(amountUsd * rate);
  // Format with thousands separator
  return lbp.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' LBP';
}
