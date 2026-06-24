import * as admin from 'firebase-admin';
import {
  calculateAvailableStock,
  StockRawMaterial,
  StockRecipe,
} from '../lib/composedProductStock';

function getDb() {
  return admin.firestore();
}

export interface PublicProductStockItem {
  productId: string;
  availableStock: number;
  inStock: boolean;
}

const MAX_PRODUCT_IDS = 100;

export async function computePublicProductStock(
  storeId: string,
  productIds: string[],
): Promise<PublicProductStockItem[]> {
  const uniqueIds = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  if (uniqueIds.length > MAX_PRODUCT_IDS) {
    throw new Error(`Too many productIds (max ${MAX_PRODUCT_IDS})`);
  }

  const storeSnap = await getDb().collection('storeProfiles').doc(storeId).get();
  if (!storeSnap.exists) {
    throw new Error('Store not found');
  }

  const [recipesSnap, rawMaterialsSnap] = await Promise.all([
    getDb().collection('recipes').where('storeId', '==', storeId).get(),
    getDb().collection('rawMaterials').where('storeId', '==', storeId).get(),
  ]);

  const recipesList: StockRecipe[] = recipesSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
    id: doc.id,
    ...(doc.data() as StockRecipe),
  }));
  const rawMaterialsList: StockRawMaterial[] = rawMaterialsSnap.docs.map(
    (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...(doc.data() as StockRawMaterial),
    }),
  );

  const results: PublicProductStockItem[] = [];

  for (const productId of uniqueIds) {
    const productSnap = await getDb().collection('products').doc(productId).get();
    if (!productSnap.exists) continue;

    const product = productSnap.data() as {
      storeId?: string;
      productType?: string;
      recipeId?: string;
      stock?: number;
      inStock?: boolean;
    };

    if (product.storeId !== storeId) continue;

    if (product.productType === 'composed' && product.recipeId) {
      const recipe = recipesList.find((r) => r.id === product.recipeId);
      const availableStock = calculateAvailableStock(recipe, rawMaterialsList);
      results.push({
        productId,
        availableStock,
        inStock: availableStock > 0,
      });
      continue;
    }

    const availableStock = Number(product.stock ?? 0);
    results.push({
      productId,
      availableStock,
      inStock: product.inStock ?? availableStock > 0,
    });
  }

  return results;
}
