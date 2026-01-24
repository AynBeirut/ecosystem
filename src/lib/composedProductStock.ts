import { Recipe, RawMaterial } from '@/types/inventory';

/**
 * Calculate how many units of a composed product can be made
 * based on available raw material stock
 */
export function calculateAvailableStock(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[]
): number {
  if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
    return 0;
  }

  let maxUnits = Infinity;

  // For each ingredient in the recipe, calculate how many units we can make
  for (const ingredient of recipe.ingredients) {
    const material = rawMaterials.find(m => m.id === ingredient.rawMaterialId);
    
    if (!material) {
      // If any material is missing, we can't make any units
      return 0;
    }

    // Calculate how many units we can make with this material's current stock
    const unitsFromThisMaterial = Math.floor(material.currentStock / ingredient.quantity);
    
    // The maximum units we can make is limited by the ingredient with the least availability
    maxUnits = Math.min(maxUnits, unitsFromThisMaterial);
  }

  // If no limiting ingredient found, return 0
  return maxUnits === Infinity ? 0 : maxUnits;
}

/**
 * Check if a composed product is in stock
 */
export function isComposedProductInStock(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[]
): boolean {
  return calculateAvailableStock(recipe, rawMaterials) > 0;
}

/**
 * Get stock status message for composed product
 */
export function getComposedStockStatus(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[]
): { inStock: boolean; availableUnits: number; message: string } {
  const availableUnits = calculateAvailableStock(recipe, rawMaterials);
  
  if (availableUnits === 0) {
    return {
      inStock: false,
      availableUnits: 0,
      message: 'Out of stock - Insufficient raw materials'
    };
  }
  
  if (availableUnits <= 5) {
    return {
      inStock: true,
      availableUnits,
      message: `Low stock - Only ${availableUnits} units available`
    };
  }
  
  return {
    inStock: true,
    availableUnits,
    message: `In stock - ${availableUnits} units available`
  };
}

/**
 * Find which raw materials are insufficient for production
 */
export function getInsufficientMaterials(
  recipe: Recipe | undefined,
  rawMaterials: RawMaterial[]
): Array<{ materialName: string; required: number; available: number; unit: string }> {
  if (!recipe || !recipe.ingredients) {
    return [];
  }

  const insufficient: Array<{ materialName: string; required: number; available: number; unit: string }> = [];

  for (const ingredient of recipe.ingredients) {
    const material = rawMaterials.find(m => m.id === ingredient.rawMaterialId);
    
    if (!material || material.currentStock < ingredient.quantity) {
      insufficient.push({
        materialName: ingredient.materialName,
        required: ingredient.quantity,
        available: material?.currentStock || 0,
        unit: ingredient.unit
      });
    }
  }

  return insufficient;
}
