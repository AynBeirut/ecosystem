import * as admin from 'firebase-admin';
import { getFirestore, Transaction } from 'firebase-admin/firestore';

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

    const ingredients = (recipeSnap.data()?.ingredients ?? []) as Array<{
      materialId: string;
      quantity: number;
    }>;

    await db.runTransaction(async (tx: Transaction) => {
      for (const ing of ingredients) {
        const matRef = db.collection('rawMaterials').doc(ing.materialId);
        const matSnap = await tx.get(matRef);
        if (!matSnap.exists) continue;
        const current = Number(matSnap.data()?.quantity ?? 0);
        const qty = line.quantity ?? 0;
        const deductQty = ing.quantity * qty;
        tx.update(matRef, { quantity: Math.max(0, current - deductQty) });
      }
    });

    await db.collection('stores').doc(storeId).collection('kitchenDeductions').add({
      orderId,
      productId: line.productId,
      quantity: line.quantity,
      recipeId,
      deductedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    deducted += 1;
  }

  return { deducted, skipped };
}
