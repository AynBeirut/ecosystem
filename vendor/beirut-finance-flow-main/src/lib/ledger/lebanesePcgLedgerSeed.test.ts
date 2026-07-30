import { describe, expect, it } from 'vitest';
import { buildLebanesePcgCoaSeedRows, LEBANESE_PCG_CHART_ACCOUNT_COUNT } from '@/lib/ledger/lebanesePcgLedgerSeed';
import { buildDefaultLedgerAccounts } from '@/lib/ledger/defaultChartOfAccounts';

describe('lebanesePcgLedgerSeed', () => {
  it('builds one seed row per Excel PCG account', () => {
    expect(buildLebanesePcgCoaSeedRows()).toHaveLength(LEBANESE_PCG_CHART_ACCOUNT_COUNT);
    expect(LEBANESE_PCG_CHART_ACCOUNT_COUNT).toBe(522);
  });

  it('marks group headers inactive and detail rows active', () => {
    const rows = buildLebanesePcgCoaSeedRows();
    const cash = rows.find((r) => r.code === '5300');
    const capital = rows.find((r) => r.code === '1010');
    expect(cash?.defaultActive).toBe(true);
    expect(cash?.isPcgChart).toBe(true);
    expect(capital?.defaultActive).toBe(false);
    expect(capital?.pcgKind).toBe('G');
  });

  it('merges operational Grabio accounts with full PCG chart for lebanese mode', () => {
    const merged = buildDefaultLedgerAccounts('test-store', 'lebanese');
    expect(merged.length).toBeGreaterThanOrEqual(522 + 60);
    expect(merged.some((r) => r.code === '102')).toBe(true);
    expect(merged.some((r) => r.code === '5300')).toBe(true);
  });
});
