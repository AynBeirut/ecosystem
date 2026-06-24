/** Mirror of src/lib/composedProductStock.ts — keep stock math in sync. */

export interface StockIngredient {
  rawMaterialId: string;
  quantity?: number;
}

export interface StockRecipe {
  id?: string;
  ingredients?: StockIngredient[];
  materials?: StockIngredient[];
}

export interface StockRawMaterial {
  id?: string;
  currentStock?: number;
}

export function recipeIngredients(recipe: StockRecipe | undefined): StockIngredient[] {
  if (!recipe) return [];
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
    return recipe.ingredients;
  }
  if (Array.isArray(recipe.materials) && recipe.materials.length > 0) {
    return recipe.materials;
  }
  return [];
}

export function calculateAvailableStock(
  recipe: StockRecipe | undefined,
  rawMaterials: StockRawMaterial[],
): number {
  const ingredients = recipeIngredients(recipe);
  if (ingredients.length === 0) return 0;

  const rawMaterialsMap = new Map<string, StockRawMaterial>();
  rawMaterials.forEach((material) => {
    if (material.id) rawMaterialsMap.set(material.id, material);
  });

  let minUnits = Infinity;
  for (const ingredient of ingredients) {
    const rawMaterial = rawMaterialsMap.get(ingredient.rawMaterialId);
    if (!rawMaterial) return 0;

    const availableStock = Number(rawMaterial.currentStock || 0);
    const requiredPerUnit = Number(ingredient.quantity || 0);
    if (requiredPerUnit === 0) continue;

    minUnits = Math.min(minUnits, Math.floor(availableStock / requiredPerUnit));
  }

  return minUnits === Infinity ? 0 : minUnits;
}
