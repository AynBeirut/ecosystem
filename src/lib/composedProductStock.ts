import { Recipe, RawMaterial } from '@/types/inventory';

type StockIngredient = {
  rawMaterialId?: string;
  materialId?: string;
  productId?: string;
  quantity?: number;
};

export interface StockStatus {
  available: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  canMake: number;
}

export interface StockContext {
  recipesById?: Map<string, Recipe>;
  productRecipeByProductId?: Map<string, string>;
  depth?: number;
}

function normalizeIngredientId(ingredient: StockIngredient): string {
  return String(ingredient.rawMaterialId || ingredient.materialId || '').trim();
}

function recipeIngredients(recipe: Recipe | undefined): StockIngredient[] {
  if (!recipe) return [];
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
    return recipe.ingredients as StockIngredient[];
  }
  const materials = (recipe as Recipe & { materials?: StockIngredient[] }).materials;
  if (Array.isArray(materials) && materials.length > 0) {
    return materials;
  }
  return [];
}

function recipeBatchMassKg(recipe: Recipe | undefined): number | null {
  if (!recipe) return null;
  const q = Number(recipe.outputQuantity ?? (recipe as Recipe & { yieldQuantity?: number }).yieldQuantity ?? 0);
  const u = String(recipe.outputUnit ?? (recipe as Recipe & { yieldUnit?: string }).yieldUnit ?? 'piece').toLowerCase();
  if (!q) return null;
  if (u === 'kg') return q;
  if (u === 'gram' || u === 'g') return q / 1000;
  if (u === 'piece') return q;
  return null;
}

/**
 * Calculate how many recipe batches can be made with current stock.
 * Supports nested semi-finished product ingredients via StockContext.
 */
export function calculateAvailableStock(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[],
  context: StockContext = {},
): number {
  const ingredients = recipeIngredients(recipe);
  if (ingredients.length === 0) {
    return 0;
  }

  const depth = context.depth ?? 0;
  if (depth > 12) return 0;

  const rawMaterialsMap = new Map<string, RawMaterial>();
  rawMaterials.forEach((material) => {
    if (material.id) {
      rawMaterialsMap.set(material.id, material);
    }
  });

  let minUnits = Infinity;

  for (const ingredient of ingredients) {
    const productId = String(ingredient.productId || '').trim();
    const required = Number(ingredient.quantity || 0);

    if (productId && context.recipesById && context.productRecipeByProductId) {
      const subRecipeId = context.productRecipeByProductId.get(productId);
      const subRecipe = subRecipeId ? context.recipesById.get(subRecipeId) : undefined;
      if (!subRecipe) return 0;

      const subBatchMass = recipeBatchMassKg(subRecipe);
      if (!subBatchMass || required <= 0) continue;

      const subBatches = calculateAvailableStock(subRecipe, rawMaterials, {
        ...context,
        depth: depth + 1,
      });
      const subBatchesNeeded = required / subBatchMass;
      if (subBatchesNeeded <= 0) continue;
      minUnits = Math.min(minUnits, Math.floor(subBatches / subBatchesNeeded));
      continue;
    }

    const rawMaterialId = normalizeIngredientId(ingredient);
    const rawMaterial = rawMaterialsMap.get(rawMaterialId);
    if (!rawMaterial) {
      return 0;
    }

    const availableStock = rawMaterial.currentStock || 0;
    if (required <= 0) {
      continue;
    }

    const unitsFromThisMaterial = Math.floor(availableStock / required);
    minUnits = Math.min(minUnits, unitsFromThisMaterial);
  }

  return minUnits === Infinity ? 0 : minUnits;
}

export function getComposedStockStatus(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[],
  context?: StockContext,
): StockStatus {
  const canMake = calculateAvailableStock(recipe, rawMaterials, context);

  let status: 'in-stock' | 'low-stock' | 'out-of-stock';
  if (canMake === 0) {
    status = 'out-of-stock';
  } else if (canMake < 10) {
    status = 'low-stock';
  } else {
    status = 'in-stock';
  }

  return {
    available: canMake,
    status,
    canMake,
  };
}
