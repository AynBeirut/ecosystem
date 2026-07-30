import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import {
  syncAllRecipeCostsForStore,
  syncRecipeCostForRecipeDoc,
  syncRecipeCostsUsingMaterial,
} from '../services/recipeCostSync';

export const onRecipeWrittenSyncCost = onDocumentWritten(
  { document: 'recipes/{recipeId}', region: 'us-central1' },
  async (event) => {
    const after = event.data?.after;
    const data = after?.data() as Record<string, unknown> | undefined;
    if (!after || !data) return;
    await syncRecipeCostForRecipeDoc(after.ref, data);
  },
);

export const onRawMaterialWrittenSyncRecipes = onDocumentWritten(
  { document: 'rawMaterials/{materialId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before?.data() as { storeId?: unknown } | undefined;
    const after = event.data?.after?.data() as { storeId?: unknown } | undefined;
    const storeIds = new Set<string>();
    if (before?.storeId) storeIds.add(String(before.storeId));
    if (after?.storeId) storeIds.add(String(after.storeId));

    const materialId = String(event.params.materialId || '').trim();
    if (!materialId) return;

    await Promise.all([...storeIds].map((storeId) => syncRecipeCostsUsingMaterial(storeId, materialId)));
  },
);

// Backfill-friendly callable for scripts and one-off repairs.
export { syncAllRecipeCostsForStore };
