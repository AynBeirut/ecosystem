export type RateCache = {
  rate: number;
  fetchedAt: number;
};

const CACHE_KEY = 'usdToLbpRate';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchRateFromOpenErApi(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error(`rate fetch failed: ${res.status}`);
  const data = await res.json();
  const rate = data?.rates?.LBP;
  if (!rate || typeof rate !== 'number') throw new Error('invalid rate response');
  return rate;
}

async function fetchRateFromExchangeRateHost(): Promise<number> {
  const accessKey = import.meta.env.VITE_EXCHANGERATE_HOST_KEY as string | undefined;
  const url = accessKey
    ? `https://api.exchangerate.host/latest?access_key=${encodeURIComponent(accessKey)}&base=USD&symbols=LBP`
    : 'https://api.exchangerate.host/latest?base=USD&symbols=LBP';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rate fetch failed: ${res.status}`);
  const data = await res.json();
  const rate = data?.rates?.LBP;
  if (!rate || typeof rate !== 'number') throw new Error('invalid rate response');
  return rate;
}

async function fetchRateFromApi(): Promise<number> {
  try {
    return await fetchRateFromOpenErApi();
  } catch (primaryErr) {
    try {
      return await fetchRateFromExchangeRateHost();
    } catch {
      throw primaryErr;
    }
  }
}

export async function fetchUsdToLbpRateFresh(): Promise<RateCache> {
  const rate = await fetchRateFromApi();
  const next: RateCache = { rate, fetchedAt: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch (e) {
    // ignore storage errors
  }
  return next;
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
