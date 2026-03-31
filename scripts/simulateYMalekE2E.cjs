#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function nowIso() {
  return new Date().toISOString();
}

function round(value, digits = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function addAuditLog(db, payload) {
  await db.collection('auditLogs').add({
    ...payload,
    timestamp: payload.timestamp || nowIso(),
    createdAt: payload.createdAt || nowIso(),
  });
}

function weightedCost(currentStock, currentCost, receivedQty, receivedCost) {
  if (currentStock === 0) return receivedCost;
  const newStock = currentStock + receivedQty;
  if (newStock <= 0) return receivedCost;
  const currentValue = currentStock * currentCost;
  const newValue = receivedQty * receivedCost;
  return (currentValue + newValue) / newStock;
}

async function main() {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error('serviceAccountKey.json not found in workspace root');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'market-flow-7b074',
    });
  }

  const functionsAdmin = require('../functions/node_modules/firebase-admin');
  if (!functionsAdmin.apps.length) {
    functionsAdmin.initializeApp({
      credential: functionsAdmin.credential.cert(serviceAccount),
      projectId: 'market-flow-7b074',
    });
  }

  const db = admin.firestore();
  const { applyPaidOrderInventoryDeduction } = require('../functions/lib/services/orderInventory');

  const testRunId = `ymalek-e2e-${Date.now()}`;
  const storeId = `test-${testRunId}`;
  const actor = {
    userId: `tester-${testRunId}`,
    userName: 'test.e2e.ymalek',
    userRole: 'admin',
    storeId,
    testRunId,
  };

  const raw = {
    paper: db.collection('rawMaterials').doc(),
    ext40110: db.collection('rawMaterials').doc(),
    int500: db.collection('rawMaterials').doc(),
  };

  const productRef = db.collection('products').doc();
  const recipeRef = db.collection('recipes').doc();
  const fgRef = db.collection('finishedGoodsInventory').doc();

  const model = {
    raw: {
      [raw.paper.id]: { name: '14 GSM 2PLY 80CM', stock: 500, cost: 1.55 },
      [raw.ext40110.id]: { name: 'External Bag with Hand 40*110', stock: 20, cost: 1.9 },
      [raw.int500.id]: { name: '500g Facial INTERNAL Bag', stock: 100, cost: 2.6 },
    },
    fg: {
      productId: productRef.id,
      manufactured: 0,
      sold: 0,
      balance: 0,
      costPrice: 0,
      totalValue: 0,
      transactions: [],
    },
    sales: {
      ordersCount: 0,
      totalUnits: 0,
      grossRevenue: 0,
    },
  };

  const recipe = {
    outputQuantity: 22,
    ingredients: [
      { rawMaterialId: raw.paper.id, quantity: 108.9 },
      { rawMaterialId: raw.ext40110.id, quantity: 0.88 },
      { rawMaterialId: raw.int500.id, quantity: 1.54 },
    ],
  };

  const seedNow = nowIso();
  const seed = db.batch();

  Object.entries(model.raw).forEach(([id, item]) => {
    seed.set(db.collection('rawMaterials').doc(id), {
      storeId,
      testRunId,
      name: item.name,
      unit: 'kg',
      currentStock: item.stock,
      costPerUnit: item.cost,
      minimumStock: 0,
      reorderPoint: 0,
      createdBy: actor.userId,
      createdAt: seedNow,
      updatedAt: seedNow,
    });
  });

  seed.set(recipeRef, {
    storeId,
    testRunId,
    outputQuantity: recipe.outputQuantity,
    ingredients: recipe.ingredients,
    createdBy: actor.userId,
    createdAt: seedNow,
    updatedAt: seedNow,
  });

  seed.set(productRef, {
    storeId,
    testRunId,
    name: 'All Care 2 Ply Facial 5Kg (E2E TEST)',
    productType: 'composed',
    recipeId: recipeRef.id,
    price: 15,
    costPrice: 0,
    createdBy: actor.userId,
    createdAt: seedNow,
    updatedAt: seedNow,
  });

  seed.set(fgRef, {
    storeId,
    testRunId,
    itemCode: `FG-${Date.now().toString().slice(-6)}`,
    productId: productRef.id,
    composedProductId: productRef.id,
    recipeId: recipeRef.id,
    description: 'All Care 2 Ply Facial 5Kg (E2E TEST)',
    productName: 'All Care 2 Ply Facial 5Kg (E2E TEST)',
    unit: 'units',
    openingBalance: 0,
    quantityManufactured: 0,
    quantitySold: 0,
    quantityAdjusted: 0,
    currentBalance: 0,
    costPrice: 0,
    totalValue: 0,
    valuationMethod: 'FIFO',
    transactions: [],
    batchQueue: [],
    createdBy: actor.userId,
    createdAt: seedNow,
    updatedAt: seedNow,
  });

  await seed.commit();

  await addAuditLog(db, {
    ...actor,
    action: 'test_seed',
    entityType: 'inventoryE2E',
    entityId: testRunId,
    newValue: {
      rawMaterialIds: Object.keys(model.raw),
      productId: productRef.id,
      recipeId: recipeRef.id,
      fgId: fgRef.id,
    },
  });

  // Purchase operation 1 (weighted avg cost path)
  const purchase1 = {
    id: db.collection('purchases').doc().id,
    items: [
      { rawMaterialId: raw.paper.id, materialName: model.raw[raw.paper.id].name, receivedQuantity: 120, unitCost: 1.7 },
      { rawMaterialId: raw.ext40110.id, materialName: model.raw[raw.ext40110.id].name, receivedQuantity: 30, unitCost: 2.1 },
    ],
  };

  for (const item of purchase1.items) {
    const state = model.raw[item.rawMaterialId];
    const newStock = state.stock + item.receivedQuantity;
    const newCost = weightedCost(state.stock, state.cost, item.receivedQuantity, item.unitCost);
    state.stock = round(newStock);
    state.cost = round(newCost);
  }

  const p1Now = nowIso();
  const p1Batch = db.batch();
  for (const item of purchase1.items) {
    const state = model.raw[item.rawMaterialId];
    p1Batch.update(db.collection('rawMaterials').doc(item.rawMaterialId), {
      currentStock: state.stock,
      costPerUnit: state.cost,
      updatedAt: p1Now,
    });
  }
  p1Batch.set(db.collection('purchases').doc(purchase1.id), {
    storeId,
    testRunId,
    status: 'received',
    supplierName: 'Supplier A',
    supplierId: 'SUP-A',
    invoiceNumber: `PUR-${Date.now().toString().slice(-6)}`,
    items: purchase1.items,
    orderDate: p1Now,
    receivedDate: p1Now,
    createdBy: actor.userId,
    createdAt: p1Now,
    updatedAt: p1Now,
  });
  await p1Batch.commit();

  await addAuditLog(db, {
    ...actor,
    action: 'update',
    entityType: 'purchase',
    entityId: purchase1.id,
    newValue: { status: 'received', items: purchase1.items },
  });

  // Production operation 1 (22 units)
  async function produce(quantity, batchNumberLabel) {
    const usage = [];
    let totalMaterialCost = 0;

    for (const ing of recipe.ingredients) {
      const need = round((ing.quantity * quantity) / recipe.outputQuantity);
      const state = model.raw[ing.rawMaterialId];
      assert(state.stock >= need, `Insufficient raw stock for ${state.name}`);
      state.stock = round(state.stock - need);
      const lineCost = round(need * state.cost);
      totalMaterialCost = round(totalMaterialCost + lineCost);
      usage.push({
        rawMaterialId: ing.rawMaterialId,
        materialName: state.name,
        quantityUsed: need,
        unitCost: state.cost,
        totalCost: lineCost,
      });
    }

    const newCostPerUnit = round(totalMaterialCost / quantity);
    const oldQty = model.fg.balance;
    const oldCost = model.fg.costPrice;
    const totalQty = oldQty + quantity;
    const weightedCostPrice = totalQty > 0 ? round(((oldQty * oldCost) + (quantity * newCostPerUnit)) / totalQty) : newCostPerUnit;

    model.fg.manufactured = round(model.fg.manufactured + quantity);
    model.fg.balance = round(model.fg.balance + quantity);
    model.fg.costPrice = weightedCostPrice;
    model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);
    model.fg.transactions.push({ actionType: 'manufactured', quantity, unitCost: newCostPerUnit, totalCost: round(newCostPerUnit * quantity) });

    const opNow = nowIso();
    const opBatchRef = db.collection('productionBatches').doc();
    const opBatch = db.batch();

    Object.entries(model.raw).forEach(([id, state]) => {
      opBatch.update(db.collection('rawMaterials').doc(id), {
        currentStock: state.stock,
        updatedAt: opNow,
      });
    });

    opBatch.update(fgRef, {
      quantityManufactured: model.fg.manufactured,
      currentBalance: model.fg.balance,
      costPrice: model.fg.costPrice,
      totalValue: model.fg.totalValue,
      transactions: admin.firestore.FieldValue.arrayUnion({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: opNow,
        actionType: 'manufactured',
        quantity,
        unitCost: newCostPerUnit,
        totalCost: round(newCostPerUnit * quantity),
        referenceId: opBatchRef.id,
        referenceNumber: batchNumberLabel,
        userId: actor.userId,
        userName: actor.userName,
      }),
      updatedAt: opNow,
    });

    opBatch.set(opBatchRef, {
      storeId,
      testRunId,
      productId: productRef.id,
      composedProductId: productRef.id,
      recipeId: recipeRef.id,
      productName: 'All Care 2 Ply Facial 5Kg (E2E TEST)',
      quantity,
      actualQuantity: quantity,
      batchNumber: batchNumberLabel,
      status: 'completed',
      materialsCost: totalMaterialCost,
      totalCost: round(newCostPerUnit * quantity),
      costPerUnit: newCostPerUnit,
      materialsUsed: usage,
      scheduledDate: '2026-03-18',
      completionDate: opNow,
      createdAt: opNow,
      updatedAt: opNow,
      createdBy: actor.userId,
    });

    await opBatch.commit();

    await addAuditLog(db, {
      ...actor,
      action: 'update',
      entityType: 'productionBatch',
      entityId: opBatchRef.id,
      oldValue: { status: 'in_progress' },
      newValue: { status: 'completed', actualQuantity: quantity, materialsUsed: usage },
    });
  }

  await produce(22, 'BATCH-E2E-001');

  // Purchase operation 2
  const purchase2 = {
    id: db.collection('purchases').doc().id,
    items: [
      { rawMaterialId: raw.int500.id, materialName: model.raw[raw.int500.id].name, receivedQuantity: 50, unitCost: 2.9 },
      { rawMaterialId: raw.paper.id, materialName: model.raw[raw.paper.id].name, receivedQuantity: 80, unitCost: 1.6 },
    ],
  };

  for (const item of purchase2.items) {
    const state = model.raw[item.rawMaterialId];
    const newStock = state.stock + item.receivedQuantity;
    const newCost = weightedCost(state.stock, state.cost, item.receivedQuantity, item.unitCost);
    state.stock = round(newStock);
    state.cost = round(newCost);
  }

  const p2Now = nowIso();
  const p2Batch = db.batch();
  for (const item of purchase2.items) {
    const state = model.raw[item.rawMaterialId];
    p2Batch.update(db.collection('rawMaterials').doc(item.rawMaterialId), {
      currentStock: state.stock,
      costPerUnit: state.cost,
      updatedAt: p2Now,
    });
  }
  p2Batch.set(db.collection('purchases').doc(purchase2.id), {
    storeId,
    testRunId,
    status: 'received',
    supplierName: 'Supplier B',
    supplierId: 'SUP-B',
    invoiceNumber: `PUR-${Date.now().toString().slice(-6)}`,
    items: purchase2.items,
    orderDate: p2Now,
    receivedDate: p2Now,
    createdBy: actor.userId,
    createdAt: p2Now,
    updatedAt: p2Now,
  });
  await p2Batch.commit();

  await addAuditLog(db, {
    ...actor,
    action: 'update',
    entityType: 'purchase',
    entityId: purchase2.id,
    newValue: { status: 'received', items: purchase2.items },
  });

  // Production operation 2 (another run)
  await produce(33, 'BATCH-E2E-002');

  // Sales: create paid orders and run function inventory deduction
  async function sell(orderQty, unitPrice, invoiceNo) {
    const orderRef = db.collection('orders').doc();
    const now = nowIso();
    const orderData = {
      storeId,
      testRunId,
      status: 'delivered',
      paymentStatus: 'paid',
      invoiceNumber: invoiceNo,
      totalAmount: round(orderQty * unitPrice),
      items: [
        {
          productId: productRef.id,
          quantity: orderQty,
          unitPrice,
        },
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userId,
    };

    await orderRef.set(orderData);
    const result = await applyPaidOrderInventoryDeduction(orderRef.id, 'manual');

    model.sales.ordersCount += 1;
    model.sales.totalUnits += orderQty;
    model.sales.grossRevenue = round(model.sales.grossRevenue + (orderQty * unitPrice));
    model.fg.sold = round(model.fg.sold + orderQty);
    model.fg.balance = round(Math.max(0, model.fg.balance - orderQty));
    model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);

    await addAuditLog(db, {
      ...actor,
      action: 'sales_deduction_run',
      entityType: 'order',
      entityId: orderRef.id,
      newValue: {
        result,
        orderQty,
        invoiceNumber: invoiceNo,
      },
    });

    return { orderId: orderRef.id, result };
  }

  const sale1 = await sell(12, 15, 'INV-E2E-001');
  const sale2 = await sell(14, 15, 'INV-E2E-002');

  const readRawActual = async () => {
    const rawActualMap = {};
    for (const id of Object.keys(model.raw)) {
      const snap = await db.collection('rawMaterials').doc(id).get();
      const data = snap.data() || {};
      rawActualMap[id] = {
        name: data.name,
        stock: round(num(data.currentStock)),
        cost: round(num(data.costPerUnit)),
      };
    }
    return rawActualMap;
  };

  const readFgActual = async () => {
    const fgSnap = await fgRef.get();
    assert(fgSnap.exists, 'Finished goods document missing');
    const fgData = fgSnap.data() || {};
    return {
      manufactured: round(num(fgData.quantityManufactured)),
      sold: round(num(fgData.quantitySold)),
      balance: round(num(fgData.currentBalance)),
      costPrice: round(num(fgData.costPrice)),
      totalValue: round(num(fgData.totalValue)),
      transactionsCount: Array.isArray(fgData.transactions) ? fgData.transactions.length : 0,
    };
  };

  const buildCoreChecks = (expectedRaw, expectedFg, actualRaw, actualFg) => {
    const localChecks = [];

    Object.entries(expectedRaw).forEach(([id, expected]) => {
      const actual = actualRaw[id];
      localChecks.push({
        type: 'rawStock',
        id,
        name: expected.name,
        expected: round(expected.stock),
        actual: round(actual.stock),
        pass: Math.abs(round(expected.stock - actual.stock)) <= 0.000001,
      });
      localChecks.push({
        type: 'rawCost',
        id,
        name: expected.name,
        expected: round(expected.cost),
        actual: round(actual.cost),
        pass: Math.abs(round(expected.cost - actual.cost)) <= 0.000001,
      });
    });

    localChecks.push({
      type: 'fgManufactured',
      expected: round(expectedFg.manufactured),
      actual: actualFg.manufactured,
      pass: Math.abs(round(expectedFg.manufactured - actualFg.manufactured)) <= 0.000001,
    });
    localChecks.push({
      type: 'fgSold',
      expected: round(expectedFg.sold),
      actual: actualFg.sold,
      pass: Math.abs(round(expectedFg.sold - actualFg.sold)) <= 0.000001,
    });
    localChecks.push({
      type: 'fgBalance',
      expected: round(expectedFg.balance),
      actual: actualFg.balance,
      pass: Math.abs(round(expectedFg.balance - actualFg.balance)) <= 0.000001,
    });
    localChecks.push({
      type: 'fgTotalValue',
      expected: round(expectedFg.totalValue),
      actual: actualFg.totalValue,
      pass: Math.abs(round(expectedFg.totalValue - actualFg.totalValue)) <= 0.000001,
    });

    return localChecks;
  };

  const expectedRawAfterScenario1 = Object.fromEntries(
    Object.entries(model.raw).map(([id, v]) => [id, { name: v.name, stock: round(v.stock), cost: round(v.cost) }])
  );
  const expectedFgAfterScenario1 = {
    manufactured: round(model.fg.manufactured),
    sold: round(model.fg.sold),
    balance: round(model.fg.balance),
    costPrice: round(model.fg.costPrice),
    totalValue: round(model.fg.totalValue),
  };

  const rawActualScenario1 = await readRawActual();
  const fgActualScenario1 = await readFgActual();
  const checksScenario1 = buildCoreChecks(expectedRawAfterScenario1, expectedFgAfterScenario1, rawActualScenario1, fgActualScenario1);
  const failedScenario1 = checksScenario1.filter((c) => !c.pass);

  // Scenario 2: edit delivered order quantity then void payment, verify rollback and idempotency.
  const preEdgeSnapshot = {
    raw: JSON.parse(JSON.stringify(rawActualScenario1)),
    fg: JSON.parse(JSON.stringify(fgActualScenario1)),
  };

  const edgeOrderRef = db.collection('orders').doc();
  const edgeOrderQtyOriginal = 8;
  const edgeOrderQtyEdited = 5;
  const edgeOrderNow = nowIso();

  await edgeOrderRef.set({
    storeId,
    testRunId,
    status: 'delivered',
    paymentStatus: 'paid',
    amountPaid: round(edgeOrderQtyOriginal * 15),
    invoiceNumber: 'INV-E2E-EDGE-001',
    totalAmount: round(edgeOrderQtyOriginal * 15),
    items: [{ productId: productRef.id, quantity: edgeOrderQtyOriginal, unitPrice: 15 }],
    createdBy: actor.userId,
    createdAt: edgeOrderNow,
    updatedAt: edgeOrderNow,
  });

  const edgeApplyFirst = await applyPaidOrderInventoryDeduction(edgeOrderRef.id, 'manual');
  const edgeApplySecond = await applyPaidOrderInventoryDeduction(edgeOrderRef.id, 'manual');

  // Reflect first paid-order consume in expected model
  model.fg.sold = round(model.fg.sold + edgeOrderQtyOriginal);
  model.fg.balance = round(Math.max(0, model.fg.balance - edgeOrderQtyOriginal));
  model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);

  // Simulate delivered-order edit rollback path (8 -> 5, diff = -3 => restore 3)
  const editDiff = edgeOrderQtyEdited - edgeOrderQtyOriginal;
  if (editDiff !== 0) {
    const fgSnapBeforeEdit = await fgRef.get();
    const fgBeforeEdit = fgSnapBeforeEdit.data() || {};
    const balanceBefore = num(fgBeforeEdit.currentBalance);
    const soldBefore = num(fgBeforeEdit.quantitySold);
    const costPrice = num(fgBeforeEdit.costPrice);
    const txs = Array.isArray(fgBeforeEdit.transactions) ? fgBeforeEdit.transactions : [];

    const newBalance = Math.max(0, balanceBefore - editDiff);
    const newSold = Math.max(0, soldBefore + editDiff);
    const editTx = {
      id: `TXN-EDIT-${Date.now()}-${productRef.id}`,
      date: nowIso(),
      actionType: editDiff > 0 ? 'sold' : 'return',
      quantity: -editDiff,
      unitCost: costPrice,
      totalCost: Math.abs(editDiff) * costPrice,
      reason: `Order edit edge test: qty ${edgeOrderQtyOriginal} -> ${edgeOrderQtyEdited}`,
      referenceId: edgeOrderRef.id,
      referenceNumber: 'INV-E2E-EDGE-001',
      userId: actor.userId,
      userName: actor.userName,
      idempotencyKey: `order-edit:${edgeOrderRef.id}:${productRef.id}:${edgeOrderQtyOriginal}->${edgeOrderQtyEdited}`,
    };

    await fgRef.update({
      currentBalance: round(newBalance),
      quantitySold: round(newSold),
      totalValue: round(newBalance * costPrice),
      transactions: [...txs, editTx],
      updatedAt: nowIso(),
    });

    await edgeOrderRef.update({
      items: [{ productId: productRef.id, quantity: edgeOrderQtyEdited, unitPrice: 15 }],
      totalAmount: round(edgeOrderQtyEdited * 15),
      updatedAt: nowIso(),
    });

    model.fg.sold = round(model.fg.sold + editDiff);
    model.fg.balance = round(Math.max(0, model.fg.balance - editDiff));
    model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);
  }

  // Simulate payment void rollback path (restore remaining edited quantity)
  {
    const fgSnapBeforeVoid = await fgRef.get();
    const fgBeforeVoid = fgSnapBeforeVoid.data() || {};
    const balanceBefore = num(fgBeforeVoid.currentBalance);
    const soldBefore = num(fgBeforeVoid.quantitySold);
    const costPrice = num(fgBeforeVoid.costPrice);
    const txs = Array.isArray(fgBeforeVoid.transactions) ? fgBeforeVoid.transactions : [];

    const newBalance = balanceBefore + edgeOrderQtyEdited;
    const newSold = Math.max(0, soldBefore - edgeOrderQtyEdited);
    const voidTx = {
      id: `TXN-VOID-${Date.now()}-${productRef.id}`,
      date: nowIso(),
      actionType: 'return',
      quantity: edgeOrderQtyEdited,
      unitCost: costPrice,
      totalCost: edgeOrderQtyEdited * costPrice,
      reason: `Payment void edge test for INV-E2E-EDGE-001`,
      referenceId: edgeOrderRef.id,
      referenceNumber: 'INV-E2E-EDGE-001',
      userId: actor.userId,
      userName: actor.userName,
      idempotencyKey: `payment-void:${edgeOrderRef.id}:${productRef.id}`,
    };

    await fgRef.update({
      currentBalance: round(newBalance),
      quantitySold: round(newSold),
      totalValue: round(newBalance * costPrice),
      transactions: [...txs, voidTx],
      updatedAt: nowIso(),
    });

    await edgeOrderRef.update({
      paymentStatus: 'unpaid',
      amountPaid: 0,
      paymentHistory: [],
      paymentVoidStockRestored: true,
      updatedAt: nowIso(),
    });

    model.fg.sold = round(model.fg.sold - edgeOrderQtyEdited);
    model.fg.balance = round(model.fg.balance + edgeOrderQtyEdited);
    model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);
  }

  const rawActualScenario2 = await readRawActual();
  const fgActualScenario2 = await readFgActual();
  const checksScenario2 = [];

  Object.keys(preEdgeSnapshot.raw).forEach((id) => {
    checksScenario2.push({
      type: 'edgeRawStockUnchanged',
      id,
      expected: preEdgeSnapshot.raw[id].stock,
      actual: rawActualScenario2[id].stock,
      pass: Math.abs(round(preEdgeSnapshot.raw[id].stock - rawActualScenario2[id].stock)) <= 0.000001,
    });
    checksScenario2.push({
      type: 'edgeRawCostUnchanged',
      id,
      expected: preEdgeSnapshot.raw[id].cost,
      actual: rawActualScenario2[id].cost,
      pass: Math.abs(round(preEdgeSnapshot.raw[id].cost - rawActualScenario2[id].cost)) <= 0.000001,
    });
  });

  checksScenario2.push({
    type: 'edgeFgSoldRestored',
    expected: preEdgeSnapshot.fg.sold,
    actual: fgActualScenario2.sold,
    pass: Math.abs(round(preEdgeSnapshot.fg.sold - fgActualScenario2.sold)) <= 0.000001,
  });
  checksScenario2.push({
    type: 'edgeFgBalanceRestored',
    expected: preEdgeSnapshot.fg.balance,
    actual: fgActualScenario2.balance,
    pass: Math.abs(round(preEdgeSnapshot.fg.balance - fgActualScenario2.balance)) <= 0.000001,
  });
  checksScenario2.push({
    type: 'edgeFgTotalValueRestored',
    expected: preEdgeSnapshot.fg.totalValue,
    actual: fgActualScenario2.totalValue,
    pass: Math.abs(round(preEdgeSnapshot.fg.totalValue - fgActualScenario2.totalValue)) <= 0.000001,
  });
  checksScenario2.push({
    type: 'edgeIdempotencySecondRun',
    expected: 'updated=0, skippedAlreadyApplied=1',
    actual: `updated=${edgeApplySecond.updated}, skippedAlreadyApplied=${edgeApplySecond.skippedAlreadyApplied}`,
    pass: edgeApplySecond.updated === 0 && edgeApplySecond.skippedAlreadyApplied === 1,
  });

  const failedScenario2 = checksScenario2.filter((c) => !c.pass);

  // Scenario 3: status rollback (delivered -> pending) and order deletion rollback.
  const preScenario3Snapshot = {
    raw: JSON.parse(JSON.stringify(rawActualScenario2)),
    fg: JSON.parse(JSON.stringify(fgActualScenario2)),
  };

  // 3A) Delivered -> pending rollback
  const statusOrderRef = db.collection('orders').doc();
  const statusOrderQty = 6;
  const statusOrderNow = nowIso();

  await statusOrderRef.set({
    storeId,
    testRunId,
    status: 'delivered',
    paymentStatus: 'paid',
    amountPaid: round(statusOrderQty * 15),
    invoiceNumber: 'INV-E2E-ROLLBACK-001',
    totalAmount: round(statusOrderQty * 15),
    items: [{ productId: productRef.id, quantity: statusOrderQty, unitPrice: 15 }],
    createdBy: actor.userId,
    createdAt: statusOrderNow,
    updatedAt: statusOrderNow,
  });

  const statusOrderApply = await applyPaidOrderInventoryDeduction(statusOrderRef.id, 'manual');

  // reflect consume in expected model
  model.fg.sold = round(model.fg.sold + statusOrderQty);
  model.fg.balance = round(Math.max(0, model.fg.balance - statusOrderQty));
  model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);

  // rollback delivered -> pending (restore)
  {
    const fgSnap = await fgRef.get();
    const fgData = fgSnap.data() || {};
    const balanceBefore = num(fgData.currentBalance);
    const soldBefore = num(fgData.quantitySold);
    const costPrice = num(fgData.costPrice);
    const txs = Array.isArray(fgData.transactions) ? fgData.transactions : [];

    const newBalance = balanceBefore + statusOrderQty;
    const newSold = Math.max(0, soldBefore - statusOrderQty);

    const rollbackTx = {
      id: `TXN-ROLLBACK-${Date.now()}-${productRef.id}`,
      date: nowIso(),
      actionType: 'return',
      quantity: statusOrderQty,
      unitCost: costPrice,
      totalCost: statusOrderQty * costPrice,
      reason: 'Status rollback edge test: delivered -> pending',
      referenceId: statusOrderRef.id,
      referenceNumber: 'INV-E2E-ROLLBACK-001',
      userId: actor.userId,
      userName: actor.userName,
      idempotencyKey: `status-rollback:${statusOrderRef.id}:${productRef.id}:delivered->pending`,
    };

    await fgRef.update({
      currentBalance: round(newBalance),
      quantitySold: round(newSold),
      totalValue: round(newBalance * costPrice),
      transactions: [...txs, rollbackTx],
      updatedAt: nowIso(),
    });

    await statusOrderRef.update({ status: 'pending', updatedAt: nowIso() });

    model.fg.sold = round(model.fg.sold - statusOrderQty);
    model.fg.balance = round(model.fg.balance + statusOrderQty);
    model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);
  }

  // 3B) Delivered order deletion rollback
  const deleteOrderRef = db.collection('orders').doc();
  const deleteOrderQty = 4;
  const deleteOrderNow = nowIso();

  await deleteOrderRef.set({
    storeId,
    testRunId,
    status: 'delivered',
    paymentStatus: 'paid',
    amountPaid: round(deleteOrderQty * 15),
    invoiceNumber: 'INV-E2E-DELETE-001',
    totalAmount: round(deleteOrderQty * 15),
    items: [{ productId: productRef.id, quantity: deleteOrderQty, unitPrice: 15 }],
    createdBy: actor.userId,
    createdAt: deleteOrderNow,
    updatedAt: deleteOrderNow,
  });

  const deleteOrderApply = await applyPaidOrderInventoryDeduction(deleteOrderRef.id, 'manual');

  // reflect consume in expected model
  model.fg.sold = round(model.fg.sold + deleteOrderQty);
  model.fg.balance = round(Math.max(0, model.fg.balance - deleteOrderQty));
  model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);

  // delete rollback (restore then delete order)
  {
    const fgSnap = await fgRef.get();
    const fgData = fgSnap.data() || {};
    const balanceBefore = num(fgData.currentBalance);
    const soldBefore = num(fgData.quantitySold);
    const costPrice = num(fgData.costPrice);
    const txs = Array.isArray(fgData.transactions) ? fgData.transactions : [];

    const newBalance = balanceBefore + deleteOrderQty;
    const newSold = Math.max(0, soldBefore - deleteOrderQty);

    const reverseTx = {
      id: `TXN-REVERSE-${Date.now()}-${productRef.id}`,
      date: nowIso(),
      actionType: 'return',
      quantity: deleteOrderQty,
      unitCost: costPrice,
      totalCost: deleteOrderQty * costPrice,
      reason: 'Order deletion edge test reversal',
      referenceId: deleteOrderRef.id,
      referenceNumber: 'INV-E2E-DELETE-001',
      userId: actor.userId,
      userName: actor.userName,
      idempotencyKey: `order-delete:${deleteOrderRef.id}:${productRef.id}:delivered`,
    };

    await fgRef.update({
      currentBalance: round(newBalance),
      quantitySold: round(newSold),
      totalValue: round(newBalance * costPrice),
      transactions: [...txs, reverseTx],
      updatedAt: nowIso(),
    });

    await deleteOrderRef.delete();

    model.fg.sold = round(model.fg.sold - deleteOrderQty);
    model.fg.balance = round(model.fg.balance + deleteOrderQty);
    model.fg.totalValue = round(model.fg.balance * model.fg.costPrice);
  }

  const rawActualScenario3 = await readRawActual();
  const fgActualScenario3 = await readFgActual();
  const checksScenario3 = [];

  Object.keys(preScenario3Snapshot.raw).forEach((id) => {
    checksScenario3.push({
      type: 'scenario3RawStockUnchanged',
      id,
      expected: preScenario3Snapshot.raw[id].stock,
      actual: rawActualScenario3[id].stock,
      pass: Math.abs(round(preScenario3Snapshot.raw[id].stock - rawActualScenario3[id].stock)) <= 0.000001,
    });
    checksScenario3.push({
      type: 'scenario3RawCostUnchanged',
      id,
      expected: preScenario3Snapshot.raw[id].cost,
      actual: rawActualScenario3[id].cost,
      pass: Math.abs(round(preScenario3Snapshot.raw[id].cost - rawActualScenario3[id].cost)) <= 0.000001,
    });
  });

  checksScenario3.push({
    type: 'scenario3FgSoldRestored',
    expected: preScenario3Snapshot.fg.sold,
    actual: fgActualScenario3.sold,
    pass: Math.abs(round(preScenario3Snapshot.fg.sold - fgActualScenario3.sold)) <= 0.000001,
  });
  checksScenario3.push({
    type: 'scenario3FgBalanceRestored',
    expected: preScenario3Snapshot.fg.balance,
    actual: fgActualScenario3.balance,
    pass: Math.abs(round(preScenario3Snapshot.fg.balance - fgActualScenario3.balance)) <= 0.000001,
  });
  checksScenario3.push({
    type: 'scenario3FgTotalValueRestored',
    expected: preScenario3Snapshot.fg.totalValue,
    actual: fgActualScenario3.totalValue,
    pass: Math.abs(round(preScenario3Snapshot.fg.totalValue - fgActualScenario3.totalValue)) <= 0.000001,
  });
  checksScenario3.push({
    type: 'scenario3StatusOrderApplied',
    expected: 'updated=1',
    actual: `updated=${statusOrderApply.updated}`,
    pass: statusOrderApply.updated === 1,
  });
  checksScenario3.push({
    type: 'scenario3DeleteOrderApplied',
    expected: 'updated=1',
    actual: `updated=${deleteOrderApply.updated}`,
    pass: deleteOrderApply.updated === 1,
  });

  const deleteOrderCheck = await deleteOrderRef.get();
  checksScenario3.push({
    type: 'scenario3DeleteOrderRemoved',
    expected: 'missing',
    actual: deleteOrderCheck.exists ? 'exists' : 'missing',
    pass: !deleteOrderCheck.exists,
  });

  const failedScenario3 = checksScenario3.filter((c) => !c.pass);

  const matrix = [
    {
      scenario: 'Scenario 1 - Purchase + Production + Sales',
      status: failedScenario1.length === 0 ? 'PASS' : 'FAIL',
      failedChecks: failedScenario1.length,
    },
    {
      scenario: 'Scenario 2 - Edit Delivered + Void Payment + Idempotency',
      status: failedScenario2.length === 0 ? 'PASS' : 'FAIL',
      failedChecks: failedScenario2.length,
    },
    {
      scenario: 'Scenario 3 - Status Rollback + Order Deletion',
      status: failedScenario3.length === 0 ? 'PASS' : 'FAIL',
      failedChecks: failedScenario3.length,
    },
  ];

  const summary = {
    testRunId,
    storeId,
    status: matrix.every((m) => m.status === 'PASS') ? 'PASS' : 'FAIL',
    matrix,
    scenario1: {
      scenario: {
        purchases: 2,
        productions: 2,
        salesOrders: 2,
      },
      sales: {
        ordersCount: model.sales.ordersCount,
        totalUnits: model.sales.totalUnits,
        grossRevenue: model.sales.grossRevenue,
        saleResults: [sale1, sale2],
      },
      expected: {
        raw: expectedRawAfterScenario1,
        finishedGoods: expectedFgAfterScenario1,
      },
      actual: {
        raw: rawActualScenario1,
        finishedGoods: fgActualScenario1,
      },
      checks: checksScenario1,
      failedChecks: failedScenario1,
    },
    scenario2: {
      edgeOrder: {
        orderId: edgeOrderRef.id,
        firstApplyResult: edgeApplyFirst,
        secondApplyResult: edgeApplySecond,
        quantityOriginal: edgeOrderQtyOriginal,
        quantityEdited: edgeOrderQtyEdited,
      },
      beforeEdge: preEdgeSnapshot,
      afterEdge: {
        raw: rawActualScenario2,
        finishedGoods: fgActualScenario2,
      },
      checks: checksScenario2,
      failedChecks: failedScenario2,
    },
    scenario3: {
      statusRollback: {
        orderId: statusOrderRef.id,
        applyResult: statusOrderApply,
        quantity: statusOrderQty,
      },
      orderDeletion: {
        orderId: deleteOrderRef.id,
        applyResult: deleteOrderApply,
        quantity: deleteOrderQty,
      },
      beforeScenario3: preScenario3Snapshot,
      afterScenario3: {
        raw: rawActualScenario3,
        finishedGoods: fgActualScenario3,
      },
      checks: checksScenario3,
      failedChecks: failedScenario3,
    },
    note: 'PASS means base operations are numerically consistent and edge-case rollback/edit/idempotency keeps inventory consistent.',
  };

  const reportDir = path.join(process.cwd(), 'scripts', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${testRunId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

  await addAuditLog(db, {
    ...actor,
    action: 'test_run_report',
    entityType: 'inventoryE2E',
    entityId: testRunId,
    newValue: {
      status: summary.status,
      failedChecks: failedScenario1.length + failedScenario2.length + failedScenario3.length,
      reportPath: `scripts/reports/${testRunId}.json`,
    },
  });

  console.log(JSON.stringify({ ...summary, reportPath }, null, 2));
}

main().catch((error) => {
  console.error('E2E simulation failed:', error);
  process.exit(1);
});
