/**
 * Minimal stock unit typing — discrete (whole units) vs continuous (weight/volume).
 * Used by refund restore; other inventory paths follow up separately.
 */

export type StockUnitType = 'discrete' | 'continuous';

/** Same vocabulary as rawMaterials.unit */
export const STOCK_UNITS = ['kg', 'liter', 'piece', 'meter', 'gram', 'ml'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

const DISCRETE_FG_UNIT_LABELS = new Set([
  'piece',
  'pieces',
  'pcs',
  'pc',
  'unit',
  'units',
  'each',
  'ea',
]);

const CONTINUOUS_STOCK_UNITS = new Set<StockUnit>(['kg', 'liter', 'meter', 'gram', 'ml']);

export function resolveProductStockUnitType(product: {
  stockUnitType?: StockUnitType;
  stockUnit?: StockUnit | string;
}): StockUnitType {
  if (product.stockUnitType === 'discrete' || product.stockUnitType === 'continuous') {
    return product.stockUnitType;
  }
  const unit = String(product.stockUnit || '').trim().toLowerCase();
  if (unit && CONTINUOUS_STOCK_UNITS.has(unit as StockUnit)) {
    return 'continuous';
  }
  if (unit === 'piece') {
    return 'discrete';
  }
  return 'discrete';
}

/** Infer discrete vs continuous from finishedGoodsInventory.unit label. */
export function resolveFinishedGoodsStockUnitType(unit: string | undefined | null): StockUnitType {
  const normalized = String(unit || '').trim().toLowerCase();
  if (!normalized) {
    return 'discrete';
  }
  if (DISCRETE_FG_UNIT_LABELS.has(normalized)) {
    return 'discrete';
  }
  if (CONTINUOUS_STOCK_UNITS.has(normalized as StockUnit)) {
    return 'continuous';
  }
  return 'continuous';
}

export type RefundRestoreQtyDecision = {
  restoreQty: number;
  skippedFractionalQty: number;
  manualAdjustmentRequired: boolean;
};

export function decideRefundRestoreQuantity(
  proportionalQty: number,
  unitType: StockUnitType,
  roundQty: (n: number) => number,
): RefundRestoreQtyDecision {
  const qty = roundQty(proportionalQty);
  if (qty <= 0) {
    return { restoreQty: 0, skippedFractionalQty: 0, manualAdjustmentRequired: false };
  }

  if (unitType === 'continuous') {
    return { restoreQty: qty, skippedFractionalQty: 0, manualAdjustmentRequired: false };
  }

  const wholeUnits = Math.floor(qty + 1e-9);
  const skippedFractionalQty = roundQty(Math.max(0, qty - wholeUnits));

  if (wholeUnits < 1) {
    return {
      restoreQty: 0,
      skippedFractionalQty: qty,
      manualAdjustmentRequired: true,
    };
  }

  return {
    restoreQty: wholeUnits,
    skippedFractionalQty,
    manualAdjustmentRequired: skippedFractionalQty > 0,
  };
}
