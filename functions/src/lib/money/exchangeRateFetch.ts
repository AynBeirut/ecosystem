/** Server-side USD→LBP fetch (multi-currency Phase 4). No silent 1:1 fallback. */

export async function fetchUsdToLbpRateFromApi(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) {
    throw new Error(`open.er-api.com failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data?.rates?.LBP;
  if (typeof rate !== 'number' || !(rate > 0)) {
    throw new Error('open.er-api.com returned invalid LBP rate');
  }
  return rate;
}
