import { describe, expect, it } from 'vitest';
import { buildDepreciationRunPreview, depreciationForMonth } from '@/lib/ledger/depreciationSchedule';
import type { FixedAsset } from '@/types/generalLedger';

const baseAsset = (): FixedAsset => ({
  id: 'FA-1',
  storeId: 's1',
  name: 'Oven',
  inServiceDate: '2026-01-01',
  cost: 1200,
  salvageValue: 0,
  usefulLifeMonths: 12,
  assetAccountCode: '155',
  accumDeprAccountCode: '156',
  expenseAccountCode: '710',
  accumulatedDepreciation: 0,
  status: 'active',
  currency: 'USD',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('depreciationSchedule', () => {
  it('straight-line monthly amount', () => {
    expect(depreciationForMonth(baseAsset(), 2026, 7)).toBe(100);
  });

  it('caps last month at remaining depreciable base', () => {
    const a = { ...baseAsset(), accumulatedDepreciation: 1150 };
    expect(depreciationForMonth(a, 2026, 7)).toBe(50);
  });

  it('preview totals active assets', () => {
    const preview = buildDepreciationRunPreview([baseAsset()], 2026, 7);
    expect(preview.totalDepreciation).toBe(100);
    expect(preview.canPost).toBe(true);
    expect(preview.postDate).toBe('2026-07-31');
  });
});
