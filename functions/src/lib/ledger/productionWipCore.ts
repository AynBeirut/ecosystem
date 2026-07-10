const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type ProductionMaterialLine = {
  rawMaterialId: string;
  materialName: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
};

export function sumMaterialCost(lines: ProductionMaterialLine[]): number {
  return round2(lines.reduce((sum, line) => sum + round2(line.totalCost), 0));
}

/**
 * True-up rule (qty + cost variance between start and complete):
 * - costStart: materials at planned qty (posted at start: Dr WIP / Cr Raw)
 * - costActual: materials at actual qty using unit costs at complete time
 * - variance = costActual - costStart
 *   - variance > 0: Dr WIP / Cr Raw (extra issuance)
 *   - variance < 0: Dr Raw / Cr WIP (return unused to raw)
 * - complete: Dr FG / Cr WIP for costActual → WIP net zero
 */
export function productionVarianceCost(costStart: number, costActual: number): number {
  return round2(costActual - costStart);
}

export function hasMaterialVariance(costStart: number, costActual: number): boolean {
  return Math.abs(productionVarianceCost(costStart, costActual)) >= 0.01;
}

export function materialUsageDelta(
  atStart: ProductionMaterialLine[],
  atComplete: ProductionMaterialLine[],
): Map<string, number> {
  const startMap = new Map<string, number>();
  for (const line of atStart) {
    startMap.set(line.rawMaterialId, round2((startMap.get(line.rawMaterialId) || 0) + line.quantityUsed));
  }
  const delta = new Map<string, number>();
  for (const line of atComplete) {
    const prev = startMap.get(line.rawMaterialId) || 0;
    const diff = round2(line.quantityUsed - prev);
    if (Math.abs(diff) >= 0.000001) {
      delta.set(line.rawMaterialId, diff);
    }
    startMap.delete(line.rawMaterialId);
  }
  for (const [rawMaterialId, qty] of startMap.entries()) {
    delta.set(rawMaterialId, round2(-qty));
  }
  return delta;
}
