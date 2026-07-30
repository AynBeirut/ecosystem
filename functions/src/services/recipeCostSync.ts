import * as admin from 'firebase-admin';

const RECIPE_COST_SYNC_VERSION = '2026-07-19-v1';

type RecipeLine = {
  rawMaterialId?: unknown;
  materialId?: unknown;
  quantity?: unknown;
};

type RecipeDoc = {
  storeId?: unknown;
  ingredients?: unknown;
  materials?: unknown;
  totalCost?: unknown;
  costPerUnit?: unknown;
  outputQuantity?: unknown;
  outputYield?: unknown;
  yieldQuantity?: unknown;
};

type RawMaterialDoc = {
  costPerUnit?: unknown;
};

function getDb() {
  return admin.firestore();
}

function round3(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0005;
}

function recipeLines(recipe: RecipeDoc): RecipeLine[] {
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
    return recipe.ingredients as RecipeLine[];
  }
  if (Array.isArray(recipe.materials) && recipe.materials.length > 0) {
    return recipe.materials as RecipeLine[];
  }
  return [];
}

function recipeOutputQuantity(recipe: RecipeDoc): number {
  const raw = Number(recipe.outputQuantity ?? recipe.outputYield ?? recipe.yieldQuantity ?? 1);
  return raw > 0 ? raw : 1;
}

function recipeMaterialId(line: RecipeLine): string {
  return String(line.rawMaterialId || line.materialId || '').trim();
}

function recipeTotals(recipe: RecipeDoc, rawMaterialsById: Map<string, RawMaterialDoc>) {
  const lines = recipeLines(recipe);
  if (lines.length === 0) {
    return {
      lineCount: 0,
      totalCost: 0,
      costPerUnit: 0,
    };
  }

  let totalCost = 0;
  for (const line of lines) {
    const materialId = recipeMaterialId(line);
    if (!materialId) continue;
    const quantity = Number(line.quantity || 0);
    const unitCost = Number(rawMaterialsById.get(materialId)?.costPerUnit || 0);
    totalCost += quantity * unitCost;
  }

  const outputQuantity = recipeOutputQuantity(recipe);
  return {
    lineCount: lines.length,
    totalCost: round3(totalCost),
    costPerUnit: round3(totalCost / outputQuantity),
  };
}

async function loadRawMaterialsById(storeId: string): Promise<Map<string, RawMaterialDoc>> {
  const snap = await getDb().collection('rawMaterials').where('storeId', '==', storeId).get();
  return new Map(
    snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => [doc.id, doc.data() as RawMaterialDoc]),
  );
}

async function updateRecipeCostIfNeeded(
  recipeRef: FirebaseFirestore.DocumentReference,
  recipeData: RecipeDoc,
  rawMaterialsById: Map<string, RawMaterialDoc>,
): Promise<boolean> {
  const computed = recipeTotals(recipeData, rawMaterialsById);
  if (computed.lineCount === 0) return false;

  const currentTotal = round3(Number(recipeData.totalCost || 0));
  const currentCpu = round3(Number(recipeData.costPerUnit || 0));
  const currentVersion = String((recipeData as { recipeCostSyncVersion?: unknown }).recipeCostSyncVersion || '');

  if (
    approxEqual(currentTotal, computed.totalCost) &&
    approxEqual(currentCpu, computed.costPerUnit) &&
    currentVersion === RECIPE_COST_SYNC_VERSION
  ) {
    return false;
  }

  await recipeRef.set(
    {
      totalCost: computed.totalCost,
      costPerUnit: computed.costPerUnit,
      recipeCostSyncVersion: RECIPE_COST_SYNC_VERSION,
      recipeCostSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return true;
}

export async function syncRecipeCostForRecipeDoc(
  recipeRef: FirebaseFirestore.DocumentReference,
  recipeData: RecipeDoc,
): Promise<boolean> {
  const storeId = String(recipeData.storeId || '').trim();
  if (!storeId) return false;
  const rawMaterialsById = await loadRawMaterialsById(storeId);
  return updateRecipeCostIfNeeded(recipeRef, recipeData, rawMaterialsById);
}

export async function syncRecipeCostsUsingMaterial(storeId: string, materialId: string): Promise<number> {
  const normalizedStoreId = String(storeId || '').trim();
  const normalizedMaterialId = String(materialId || '').trim();
  if (!normalizedStoreId || !normalizedMaterialId) return 0;

  const [recipesSnap, rawMaterialsById] = await Promise.all([
    getDb().collection('recipes').where('storeId', '==', normalizedStoreId).get(),
    loadRawMaterialsById(normalizedStoreId),
  ]);

  let updated = 0;
  for (const doc of recipesSnap.docs) {
    const data = doc.data() as RecipeDoc;
    const usesMaterial = recipeLines(data).some((line) => recipeMaterialId(line) === normalizedMaterialId);
    if (!usesMaterial) continue;
    if (await updateRecipeCostIfNeeded(doc.ref, data, rawMaterialsById)) {
      updated += 1;
    }
  }
  return updated;
}

export async function syncAllRecipeCostsForStore(storeId: string): Promise<number> {
  const normalizedStoreId = String(storeId || '').trim();
  if (!normalizedStoreId) return 0;

  const [recipesSnap, rawMaterialsById] = await Promise.all([
    getDb().collection('recipes').where('storeId', '==', normalizedStoreId).get(),
    loadRawMaterialsById(normalizedStoreId),
  ]);

  let updated = 0;
  for (const doc of recipesSnap.docs) {
    if (await updateRecipeCostIfNeeded(doc.ref, doc.data() as RecipeDoc, rawMaterialsById)) {
      updated += 1;
    }
  }
  return updated;
}
