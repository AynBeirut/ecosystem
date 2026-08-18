"use strict";
/** Mirror of src/lib/composedProductStock.ts — keep stock math in sync. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIngredientId = normalizeIngredientId;
exports.recipeIngredients = recipeIngredients;
exports.calculateAvailableStock = calculateAvailableStock;
function normalizeIngredientId(ingredient) {
    return String(ingredient.rawMaterialId || ingredient.materialId || '').trim();
}
function recipeIngredients(recipe) {
    if (!recipe)
        return [];
    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
        return recipe.ingredients;
    }
    if (Array.isArray(recipe.materials) && recipe.materials.length > 0) {
        return recipe.materials;
    }
    return [];
}
function recipeBatchMassKg(recipe) {
    if (!recipe)
        return null;
    const q = Number(recipe.outputQuantity ?? recipe.yieldQuantity ?? 0);
    const u = String(recipe.outputUnit ?? recipe.yieldUnit ?? 'piece').toLowerCase();
    if (!q)
        return null;
    if (u === 'kg')
        return q;
    if (u === 'gram' || u === 'g')
        return q / 1000;
    if (u === 'piece')
        return q;
    return null;
}
function calculateAvailableStock(recipe, rawMaterials, context = {}) {
    const ingredients = recipeIngredients(recipe);
    if (ingredients.length === 0)
        return 0;
    const depth = context.depth ?? 0;
    if (depth > 12)
        return 0;
    const rawMaterialsMap = new Map();
    rawMaterials.forEach((material) => {
        if (material.id)
            rawMaterialsMap.set(material.id, material);
    });
    let minUnits = Infinity;
    for (const ingredient of ingredients) {
        const productId = String(ingredient.productId || '').trim();
        const required = Number(ingredient.quantity || 0);
        if (productId && context.recipesById && context.productRecipeByProductId) {
            const subRecipeId = context.productRecipeByProductId.get(productId);
            const subRecipe = subRecipeId ? context.recipesById.get(subRecipeId) : undefined;
            if (!subRecipe)
                return 0;
            const subBatchMass = recipeBatchMassKg(subRecipe);
            if (!subBatchMass || required <= 0)
                continue;
            const subBatches = calculateAvailableStock(subRecipe, rawMaterials, {
                ...context,
                depth: depth + 1,
            });
            const subBatchesNeeded = required / subBatchMass;
            if (subBatchesNeeded <= 0)
                continue;
            minUnits = Math.min(minUnits, Math.floor(subBatches / subBatchesNeeded));
            continue;
        }
        const rawMaterial = rawMaterialsMap.get(normalizeIngredientId(ingredient));
        if (!rawMaterial)
            return 0;
        const availableStock = Number(rawMaterial.currentStock || 0);
        if (required <= 0)
            continue;
        minUnits = Math.min(minUnits, Math.floor(availableStock / required));
    }
    return minUnits === Infinity ? 0 : minUnits;
}
