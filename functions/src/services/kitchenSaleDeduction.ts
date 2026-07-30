import * as admin from 'firebase-admin';
import { getFirestore, Transaction } from 'firebase-admin/firestore';
import { normalizeIngredientId, recipeIngredients, type StockIngredient, type StockRecipe } from '../lib/composedProductStock';

const db = getFirestore();

type OrderLine = {
  productId?: string;
  sku?: string;
  quantity?: number;
  productType?: string;
};

/**
 * Live kitchen recipe deduction on platform sale (Phase 4).
 * Invoked from order completion trigger when businessWorkflow=live_kitchen.
 */
export async function deductComposedIngredientsOnSale(
  storeId: string,
  orderId: string,
  lines: OrderLine[],
): Promise<{ deducted: number; skipped: number }> {
  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  const profile = profileSnap.data();
  if (profile?.businessWorkflow !== 'live_kitchen') {
    return { deducted: 0, skipped: lines.length };
  }
  if (profile?.composedProductSource === 'pos') {
    return { deducted: 0, skipped: lines.length };
  }

  let deducted = 0;
  let skipped = 0;

  for (const line of lines) {
    if (!line.productId || !line.quantity) {
      skipped += 1;
      continue;
    }
    const productSnap = await db.collection('products').doc(line.productId).get();
    if (!productSnap.exists) {
      skipped += 1;
      continue;
    }
    const product = productSnap.data();
    if (product?.type !== 'composed' && product?.productType !== 'composed') {
      skipped += 1;
      continue;
    }

    const recipeId = product.recipeId as string | undefined;
    if (!recipeId) {
      skipped += 1;
      continue;
    }

    const recipeSnap = await db.collection('recipes').doc(recipeId).get();
    if (!recipeSnap.exists) {
      skipped += 1;
      continue;
    }

    const recipeData = (recipeSnap.data() ?? {}) as StockRecipe;

    const ingredients = recipeIngredients(recipeData)
      .map((ing) => ({
        rawMaterialId: normalizeIngredientId(ing as StockIngredient),
        quantity: Number(ing.quantity ?? 0),
      }))
      .filter((ing) => ing.rawMaterialId && ing.quantity > 0);

    if (ingredients.length === 0) {
      skipped += 1;
      continue;
    }

    // A recipe's ingredient quantities produce `outputQuantity` (or yieldQuantity)
    // units. Deduct per sold unit = ingredientQty / yield.
    const yieldQty = Number(recipeData.outputQuantity ?? recipeData.yieldQuantity ?? 1) || 1;
    const soldQty = line.quantity ?? 0;

    // Idempotent per order+product so re-fired triggers never double-deduct.
    const deductionRef = db
      .collection('stores')
      .doc(storeId)
      .collection('kitchenDeductions')
      .doc(`${orderId}_${line.productId}`);

    const applied = await db.runTransaction(async (tx: Transaction) => {
      const existing = await tx.get(deductionRef);
      if (existing.exists) return false;

      const matRefs = ingredients.map((ing) => db.collection('rawMaterials').doc(ing.rawMaterialId));
      const matSnaps = await Promise.all(matRefs.map((ref) => tx.get(ref)));

      matSnaps.forEach((matSnap, idx) => {
        if (!matSnap.exists) return;
        const data = matSnap.data() ?? {};
        const current = Number(data.currentStock ?? data.quantity ?? 0);
        const deductQty = (ingredients[idx].quantity / yieldQty) * soldQty;
        tx.update(matRefs[idx], {
          currentStock: Math.max(0, current - deductQty),
          updatedAt: new Date().toISOString(),
        });
      });

      tx.set(deductionRef, {
        orderId,
        productId: line.productId,
        quantity: soldQty,
        recipeId,
        deductedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return true;
    });

    if (applied) {
      deducted += 1;
    } else {
      skipped += 1;
    }
  }

  return { deducted, skipped };
}
