import { Recipe, RawMaterial } from '@/types/inventory';

export interface StockStatus {
  available: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  canMake: number;
}

/**
 * Calculate how many units of a composed product can be made with current raw material stock
 */
export function calculateAvailableStock(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[]
): number {
  if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
    return 0;
  }

  const rawMaterialsMap = new Map<string, RawMaterial>();
  
  rawMaterials.forEach(material => {
    if (material.id) {
      rawMaterialsMap.set(material.id, material);
    }
  });

  // Calculate minimum units that can be made based on each ingredient
  let minUnits = Infinity;

  for (const ingredient of recipe.ingredients) {
    const rawMaterial = rawMaterialsMap.get(ingredient.rawMaterialId);
    
    if (!rawMaterial) {
      return 0; // Material not found
    }

    const availableStock = rawMaterial.currentStock || 0;
    const requiredPerUnit = ingredient.quantity || 0;

    if (requiredPerUnit === 0) {
      continue;
    }

    const unitsFromThisMaterial = Math.floor(availableStock / requiredPerUnit);
    minUnits = Math.min(minUnits, unitsFromThisMaterial);
  }

  return minUnits === Infinity ? 0 : minUnits;
}

/**
 * Get stock status for a composed product based on recipe and raw materials
 */
export function getComposedStockStatus(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[]
): StockStatus {
  const canMake = calculateAvailableStock(recipe, rawMaterials);

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
    canMake
  };
}
