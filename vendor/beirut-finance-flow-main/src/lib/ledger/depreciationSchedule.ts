import type { FixedAsset, DepreciationLinePreview, DepreciationRunPreview } from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function monthEndDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function depreciableBase(asset: FixedAsset): number {
  return round2(Math.max(0, (Number(asset.cost) || 0) - (Number(asset.salvageValue) || 0)));
}

export function monthlyStraightLineAmount(asset: FixedAsset): number {
  const months = Math.max(1, Math.floor(Number(asset.usefulLifeMonths) || 0));
  return round2(depreciableBase(asset) / months);
}

export function remainingDepreciation(asset: FixedAsset): number {
  return round2(Math.max(0, depreciableBase(asset) - (Number(asset.accumulatedDepreciation) || 0)));
}

/** Amount to book for calendar month (straight-line), or 0 if not in service / fully depreciated. */
export function depreciationForMonth(asset: FixedAsset, year: number, month: number): number {
  if (asset.status === 'retired' || asset.status === 'fully_depreciated') return 0;
  const end = monthEndDate(year, month);
  const inService = String(asset.inServiceDate || '').slice(0, 10);
  if (!inService || inService > end) return 0;

  const remaining = remainingDepreciation(asset);
  if (remaining <= 0) return 0;

  const monthly = monthlyStraightLineAmount(asset);
  return round2(Math.min(monthly, remaining));
}

export function buildDepreciationRunPreview(
  assets: FixedAsset[],
  year: number,
  month: number,
  options?: { periodLocked?: boolean; currency?: string },
): DepreciationRunPreview {
  const postDate = monthEndDate(year, month);
  const periodLabel = `${year}-${String(month).padStart(2, '0')}`;
  const currency = options?.currency || assets[0]?.currency || 'USD';

  if (options?.periodLocked) {
    return {
      periodYear: year,
      periodMonth: month,
      periodLabel,
      postDate,
      currency,
      lines: [],
      totalDepreciation: 0,
      canPost: false,
      blockReason: 'This period is closed — reopen before posting depreciation.',
    };
  }

  const lines: DepreciationLinePreview[] = assets
    .filter((a) => a.status === 'active')
    .map((a) => {
      const amount = depreciationForMonth(a, year, month);
      if (amount <= 0) {
        return {
          assetId: a.id,
          assetName: a.name,
          amount: 0,
          skippedReason: 'Not in service this month or fully depreciated',
        };
      }
      return { assetId: a.id, assetName: a.name, amount };
    });

  const totalDepreciation = round2(lines.reduce((s, l) => s + l.amount, 0));

  return {
    periodYear: year,
    periodMonth: month,
    periodLabel,
    postDate,
    currency,
    lines,
    totalDepreciation,
    canPost: totalDepreciation > 0,
    blockReason: totalDepreciation <= 0 ? 'No depreciation due for active assets this month.' : undefined,
  };
}

export function depreciationSourceId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
