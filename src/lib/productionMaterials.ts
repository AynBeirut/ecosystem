import type { Recipe, RawMaterial } from '@/types/inventory';

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type ProductionMaterialLine = {
  rawMaterialId: string;
  materialName: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
};

export type ResolveProductionMaterialsResult = {
  lines: ProductionMaterialLine[];
  totalCost: number;
  rawMaterialUsageMap: Map<string, number>;
  zeroCostMaterials: string[];
  insufficientStock?: { materialName: string; need: number; available: number };
};

export function sumMaterialCost(lines: ProductionMaterialLine[]): number {
  return round2(lines.reduce((sum, line) => sum + round2(line.totalCost), 0));
}

export function productionVarianceCost(costStart: number, costActual: number): number {
  return round2(costActual - costStart);
}

export function materialUsageDelta(
  atStart: ProductionMaterialLine[],
  atComplete: ProductionMaterialLine[],
): Map<string, number> {
  const startMap = new Map<string, number>();
  for (const line of atStart) {
    startMap.set(line.rawMaterialId, round3((startMap.get(line.rawMaterialId) || 0) + line.quantityUsed));
  }
  const delta = new Map<string, number>();
  for (const line of atComplete) {
    const prev = startMap.get(line.rawMaterialId) || 0;
    const diff = round3(line.quantityUsed - prev);
    if (Math.abs(diff) >= 0.000001) {
      delta.set(line.rawMaterialId, diff);
    }
    startMap.delete(line.rawMaterialId);
  }
  for (const [rawMaterialId, qty] of startMap.entries()) {
    delta.set(rawMaterialId, round3(-qty));
  }
  return delta;
}

type RecipeLike = Recipe & {
  outputQuantity?: number;
  yieldQuantity?: number;
  materials?: Recipe['ingredients'];
};

export async function resolveProductionMaterials(
  recipe: RecipeLike,
  batchQuantity: number,
  loadRawMaterial: (rawMaterialId: string) => Promise<RawMaterial | null>,
): Promise<ResolveProductionMaterialsResult> {
  const recipeOutputQty = Number(recipe.outputQuantity || recipe.yieldQuantity || 1);
  const safeRecipeOutputQty = recipeOutputQty > 0 ? recipeOutputQty : 1;
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : (Array.isArray(recipe.materials) ? recipe.materials : []);

  const lines: ProductionMaterialLine[] = [];
  const rawMaterialUsageMap = new Map<string, number>();
  const zeroCostMaterials: string[] = [];

  for (const ingredient of ingredients) {
    const rawMaterialId = String(ingredient?.rawMaterialId || '').trim();
    const ingredientQty = Number(ingredient?.quantity || 0);
    if (!rawMaterialId || ingredientQty <= 0 || batchQuantity <= 0) continue;

    const rawMaterial = await loadRawMaterial(rawMaterialId);
    if (!rawMaterial) continue;

    const quantityNeeded = round3((ingredientQty * batchQuantity) / safeRecipeOutputQty);
    const currentStock = Number(rawMaterial.currentStock || 0);
    const alreadyPlanned = rawMaterialUsageMap.get(rawMaterialId) || 0;
    const totalPlanned = round3(alreadyPlanned + quantityNeeded);

    if (!rawMaterial.costPerUnit || rawMaterial.costPerUnit === 0) {
      zeroCostMaterials.push(rawMaterial.name);
    }

    if (currentStock < totalPlanned) {
      return {
        lines,
        totalCost: 0,
        rawMaterialUsageMap,
        zeroCostMaterials,
        insufficientStock: {
          materialName: rawMaterial.name,
          need: totalPlanned,
          available: currentStock,
        },
      };
    }

    const materialCost = round2((rawMaterial.costPerUnit || 0) * quantityNeeded);
    rawMaterialUsageMap.set(rawMaterialId, totalPlanned);
    lines.push({
      rawMaterialId,
      materialName: rawMaterial.name,
      quantityUsed: quantityNeeded,
      unitCost: rawMaterial.costPerUnit || 0,
      totalCost: materialCost,
    });
  }

  return {
    lines,
    totalCost: sumMaterialCost(lines),
    rawMaterialUsageMap,
    zeroCostMaterials,
  };
}

export function isWipEnabledBatch(batch: { wipGlStartedAt?: string | null }): boolean {
  return Boolean(batch.wipGlStartedAt);
}
