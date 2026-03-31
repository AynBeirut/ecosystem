#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function nowIso() {
  return new Date().toISOString();
}

function round(value, digits = 6) {
  const factor = Math.pow(10, digits);
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function addAuditLog(db, payload) {
  await db.collection('auditLogs').add({
    ...payload,
    timestamp: payload.timestamp || nowIso(),
    createdAt: payload.createdAt || nowIso(),
  });
}

async function main() {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error('serviceAccountKey.json not found in workspace root');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });

  const db = admin.firestore();
  const testRunId = `ymalek-sim-${Date.now()}`;
  const storeId = `test-${testRunId}`;
  const actor = {
    userId: `tester-${testRunId}`,
    userName: 'test.y.malek.sim',
    userRole: 'admin',
    storeId,
    testRunId,
  };

  const external40x90Ref = db.collection('rawMaterials').doc();
  const external40110Ref = db.collection('rawMaterials').doc();
  const internal500Ref = db.collection('rawMaterials').doc();
  const paper14gsmRef = db.collection('rawMaterials').doc();

  const rawMaterials = [
    {
      ref: external40x90Ref,
      name: 'External Bag with Hand 40x90',
      currentStock: 46.717,
      unit: 'kg',
      costPerUnit: 2.2,
    },
    {
      ref: external40110Ref,
      name: 'External Bag with Hand 40*110',
      currentStock: 22.5,
      unit: 'kg',
      costPerUnit: 1.9,
    },
    {
      ref: internal500Ref,
      name: '500g Facial INTERNAL Bag',
      currentStock: 120,
      unit: 'kg',
      costPerUnit: 2.6,
    },
    {
      ref: paper14gsmRef,
      name: '14 GSM 2PLY 80CM',
      currentStock: 600,
      unit: 'kg',
      costPerUnit: 1.55,
    },
  ];

  const products = [
    {
      ref: db.collection('products').doc(),
      name: 'All Care 2 Ply Facial 3Kg (TEST)',
      batchQty: 49,
      recipeKey: 'recipeA',
      price: 12,
      costPrice: 5.1522305,
    },
    {
      ref: db.collection('products').doc(),
      name: 'All Care 2 Ply Facial 5Kg (TEST)',
      batchQty: 22,
      recipeKey: 'recipeB',
      price: 15,
      costPrice: 8.5581105,
    },
  ];

  const recipes = {
    recipeA: {
      ref: db.collection('recipes').doc(),
      outputQuantity: 49,
      ingredients: [
        { rawMaterialRef: paper14gsmRef, quantity: 220 },
        { rawMaterialRef: external40x90Ref, quantity: 1.2 },
      ],
    },
    recipeB: {
      ref: db.collection('recipes').doc(),
      outputQuantity: 22,
      ingredients: [
        { rawMaterialRef: paper14gsmRef, quantity: 108.9 },
        { rawMaterialRef: external40110Ref, quantity: 0.88 },
        { rawMaterialRef: internal500Ref, quantity: 1.54 },
      ],
    },
  };

  const now = nowIso();

  const seedBatch = db.batch();

  rawMaterials.forEach((material) => {
    seedBatch.set(material.ref, {
      storeId,
      testRunId,
      name: material.name,
      currentStock: material.currentStock,
      unit: material.unit,
      costPerUnit: material.costPerUnit,
      minStock: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    });
  });

  products.forEach((product) => {
    const recipeId = recipes[product.recipeKey].ref.id;
    seedBatch.set(product.ref, {
      storeId,
      testRunId,
      name: product.name,
      productType: 'composed',
      recipeId,
      price: product.price,
      costPrice: product.costPrice,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    });
  });

  Object.values(recipes).forEach((recipe) => {
    seedBatch.set(recipe.ref, {
      storeId,
      testRunId,
      outputQuantity: recipe.outputQuantity,
      ingredients: recipe.ingredients.map((item) => ({
        rawMaterialId: item.rawMaterialRef.id,
        quantity: item.quantity,
      })),
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    });
  });

  await seedBatch.commit();

  const batchARef = db.collection('productionBatches').doc();
  const batchBRef = db.collection('productionBatches').doc();

  const batchAData = {
    productId: products[0].ref.id,
    composedProductId: products[0].ref.id,
    recipeId: recipes.recipeA.ref.id,
    productName: products[0].name,
    quantity: products[0].batchQty,
    scheduledDate: '2026-03-18',
    priority: 'normal',
    notes: '',
    batchNumber: 'BATCH-150116-TEST',
    quantityProduced: 0,
    status: 'planned',
    actualQuantity: 0,
    materialsCost: 252.4592945,
    totalCost: 0,
    costPerUnit: 5.1522305,
    storeId,
    testRunId,
    createdAt: now,
    createdBy: actor.userId,
  };

  const batchBData = {
    productId: products[1].ref.id,
    composedProductId: products[1].ref.id,
    recipeId: recipes.recipeB.ref.id,
    productName: products[1].name,
    quantity: products[1].batchQty,
    scheduledDate: '2026-03-18',
    priority: 'normal',
    notes: '',
    batchNumber: 'BATCH-167875-TEST',
    quantityProduced: 0,
    status: 'planned',
    actualQuantity: 0,
    materialsCost: 188.278431,
    totalCost: 0,
    costPerUnit: 8.5581105,
    storeId,
    testRunId,
    createdAt: now,
    createdBy: actor.userId,
  };

  await Promise.all([
    batchARef.set(batchAData),
    batchBRef.set(batchBData),
    addAuditLog(db, {
      ...actor,
      action: 'create',
      entityType: 'productionBatch',
      entityId: batchARef.id,
      newValue: batchAData,
    }),
    addAuditLog(db, {
      ...actor,
      action: 'create',
      entityType: 'productionBatch',
      entityId: batchBRef.id,
      newValue: batchBData,
    }),
  ]);

  const trackedRawMaterialIds = [paper14gsmRef.id, external40110Ref.id, internal500Ref.id, external40x90Ref.id];
  const stockBefore = {};
  for (const id of trackedRawMaterialIds) {
    const snap = await db.collection('rawMaterials').doc(id).get();
    stockBefore[id] = round(toNum(snap.data()?.currentStock));
  }

  const completionBatchSnap = await batchBRef.get();
  assert(completionBatchSnap.exists, 'Completion batch not found');
  const completionBatch = completionBatchSnap.data();
  assert(completionBatch.status !== 'completed', 'Batch unexpectedly already completed');

  const recipeSnap = await db.collection('recipes').doc(completionBatch.recipeId).get();
  assert(recipeSnap.exists, 'Recipe missing for completion batch');
  const recipe = recipeSnap.data();

  const actualQty = Number(completionBatch.quantity);
  const recipeOutputQty = Number(recipe.outputQuantity || 1);
  const safeOutputQty = recipeOutputQty > 0 ? recipeOutputQty : 1;

  const materialsUsed = [];
  const usageMap = new Map();
  let totalMaterialCost = 0;

  for (const ingredient of recipe.ingredients || []) {
    const rawMaterialId = String(ingredient.rawMaterialId || '').trim();
    if (!rawMaterialId) continue;

    const rawSnap = await db.collection('rawMaterials').doc(rawMaterialId).get();
    assert(rawSnap.exists, `Raw material missing: ${rawMaterialId}`);
    const rawData = rawSnap.data();

    const quantityNeeded = (Number(ingredient.quantity || 0) * actualQty) / safeOutputQty;
    const used = round(quantityNeeded);
    const costPerUnit = toNum(rawData.costPerUnit);
    totalMaterialCost += used * costPerUnit;

    usageMap.set(rawMaterialId, round((usageMap.get(rawMaterialId) || 0) + used));
    materialsUsed.push({
      rawMaterialId,
      materialName: rawData.name,
      quantityUsed: used,
      unitCost: costPerUnit,
      totalCost: round(used * costPerUnit),
    });
  }

  const completionTime = nowIso();
  const completeWrite = db.batch();

  for (const [rawMaterialId, quantityUsed] of usageMap.entries()) {
    completeWrite.update(db.collection('rawMaterials').doc(rawMaterialId), {
      currentStock: admin.firestore.FieldValue.increment(-quantityUsed),
      updatedAt: completionTime,
    });
  }

  const fgRef = db.collection('finishedGoodsInventory').doc();
  const totalCostPerUnit = round(totalMaterialCost / actualQty);
  completeWrite.set(fgRef, {
    itemCode: `FG-${Date.now().toString().slice(-6)}`,
    productId: completionBatch.productId,
    composedProductId: completionBatch.composedProductId,
    recipeId: completionBatch.recipeId,
    description: completionBatch.productName,
    productName: completionBatch.productName,
    unit: 'units',
    openingBalance: 0,
    quantityManufactured: actualQty,
    quantitySold: 0,
    quantityAdjusted: 0,
    currentBalance: actualQty,
    costPrice: totalCostPerUnit,
    totalValue: round(actualQty * totalCostPerUnit),
    valuationMethod: 'FIFO',
    transactions: [
      {
        id: `${Date.now()}`,
        date: completionTime,
        actionType: 'manufactured',
        quantity: actualQty,
        unitCost: totalCostPerUnit,
        totalCost: round(totalCostPerUnit * actualQty),
        referenceId: batchBRef.id,
        referenceNumber: completionBatch.batchNumber,
        userId: actor.userId,
        userName: actor.userName,
      },
    ],
    batchQueue: [
      {
        batchId: batchBRef.id,
        batchNumber: completionBatch.batchNumber,
        quantity: actualQty,
        costPerUnit: totalCostPerUnit,
        remainingQuantity: actualQty,
        productionDate: completionTime,
      },
    ],
    storeId,
    testRunId,
    createdBy: actor.userId,
    createdAt: completionTime,
    updatedAt: completionTime,
  });

  completeWrite.update(batchBRef, {
    status: 'completed',
    completionDate: completionTime,
    actualQuantity: actualQty,
    materialsCost: round(totalMaterialCost),
    totalCost: round(totalCostPerUnit * actualQty),
    costPerUnit: totalCostPerUnit,
    materialsUsed,
    updatedAt: completionTime,
  });

  await completeWrite.commit();

  await addAuditLog(db, {
    ...actor,
    action: 'update',
    entityType: 'productionBatch',
    entityId: batchBRef.id,
    oldValue: { status: 'in_progress' },
    newValue: { status: 'completed', actualQuantity: actualQty, materialsUsed },
  });

  const stockAfterCompletion = {};
  for (const id of trackedRawMaterialIds) {
    const snap = await db.collection('rawMaterials').doc(id).get();
    stockAfterCompletion[id] = round(toNum(snap.data()?.currentStock));
  }

  const deleteSnapshot = await batchBRef.get();
  assert(deleteSnapshot.exists, 'Completed batch missing before deletion');
  const deleteData = deleteSnapshot.data();

  const deleteTime = nowIso();
  const deleteWrite = db.batch();

  for (const item of deleteData.materialsUsed || []) {
    if (!item.rawMaterialId || !item.quantityUsed) continue;
    deleteWrite.update(db.collection('rawMaterials').doc(item.rawMaterialId), {
      currentStock: admin.firestore.FieldValue.increment(Number(item.quantityUsed)),
      updatedAt: deleteTime,
    });
  }

  const fgSnap = await db.collection('finishedGoodsInventory')
    .where('storeId', '==', storeId)
    .where('productId', '==', deleteData.productId)
    .where('testRunId', '==', testRunId)
    .limit(1)
    .get();

  if (!fgSnap.empty) {
    const fgDoc = fgSnap.docs[0];
    const fgData = fgDoc.data();
    const newManufactured = Math.max(0, toNum(fgData.quantityManufactured) - toNum(deleteData.actualQuantity));
    const newBalance = Math.max(0, toNum(fgData.currentBalance) - toNum(deleteData.actualQuantity));

    deleteWrite.update(fgDoc.ref, {
      quantityManufactured: newManufactured,
      currentBalance: newBalance,
      totalValue: round(newBalance * toNum(fgData.costPrice)),
      updatedAt: deleteTime,
    });

    const fgTxnRef = db.collection('finishedGoodsTransactions').doc();
    deleteWrite.set(fgTxnRef, {
      storeId,
      testRunId,
      productId: deleteData.productId,
      productName: deleteData.productName,
      type: 'production_batch_deletion',
      quantity: -toNum(deleteData.actualQuantity),
      relatedBatchId: batchBRef.id,
      createdAt: deleteTime,
      createdBy: actor.userId,
      createdByName: actor.userName,
    });
  }

  deleteWrite.delete(batchBRef);
  await deleteWrite.commit();

  await addAuditLog(db, {
    ...actor,
    action: 'delete',
    entityType: 'productionBatch',
    entityId: batchBRef.id,
    oldValue: deleteData,
    reversedFinishedGoods: toNum(deleteData.actualQuantity),
    restoredRawMaterials: (deleteData.materialsUsed || []).length,
  });

  const stockAfterDelete = {};
  for (const id of trackedRawMaterialIds) {
    const snap = await db.collection('rawMaterials').doc(id).get();
    stockAfterDelete[id] = round(toNum(snap.data()?.currentStock));
  }

  const materialNameById = {};
  rawMaterials.forEach((item) => {
    materialNameById[item.ref.id] = item.name;
  });

  const driftReport = trackedRawMaterialIds.map((id) => ({
    rawMaterialId: id,
    materialName: materialNameById[id],
    before: stockBefore[id],
    afterCompletion: stockAfterCompletion[id],
    afterDelete: stockAfterDelete[id],
    netDriftAfterDelete: round(stockAfterDelete[id] - stockBefore[id]),
  }));

  const nonZeroDrift = driftReport.filter((item) => Math.abs(item.netDriftAfterDelete) > 0.000001);

  const output = {
    testRunId,
    storeId,
    status: nonZeroDrift.length === 0 ? 'PASS' : 'FAIL',
    operations: {
      createdBatches: [batchARef.id, batchBRef.id],
      completedBatch: batchBRef.id,
      deletedBatch: batchBRef.id,
    },
    driftReport,
    nonZeroDrift,
    note: 'PASS means raw-material stock returned to initial values after complete + delete replay.',
  };

  const reportDir = path.join(process.cwd(), 'scripts', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${testRunId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(output, null, 2));

  await addAuditLog(db, {
    ...actor,
    action: 'test_run_report',
    entityType: 'inventoryIntegrityTest',
    entityId: testRunId,
    newValue: {
      reportPath: `scripts/reports/${testRunId}.json`,
      result: output.status,
      nonZeroDriftCount: nonZeroDrift.length,
    },
  });

  console.log(JSON.stringify({
    message: 'Y.Malek-like simulation completed',
    ...output,
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});
