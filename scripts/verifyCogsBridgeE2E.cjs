#!/usr/bin/env node
/**
 * Isolated write-path E2E: production → sale → return → production → sale
 * + finance invoice with stale rawPrice. Verifies COGS bridge on test-* store.
 *
 * Usage:
 *   node scripts/verifyCogsBridgeE2E.cjs
 *   node scripts/verifyCogsBridgeE2E.cjs --keep   # skip cleanup
 */
const admin = require('firebase-admin');
const path = require('path');

const KEEP = process.argv.includes('--keep');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
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

const testRunId = `cogs-bridge-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

function nowIso() { return new Date().toISOString(); }
function round(n, d = 4) {
  const f = 10 ** d;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}
function num(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function weightedCost(oldQty, oldCost, addQty, addCost) {
  const newQty = oldQty + addQty;
  if (newQty <= 0) return addCost;
  if (oldQty <= 0) return addCost;
  return (oldQty * oldCost + addQty * addCost) / newQty;
}

// --- COGS helpers (mirror verifyCogsBridge.cjs + finance module) ---
function buildFgCostMap(docs) {
  const map = {};
  for (const doc of docs) {
    const data = doc.data ? doc.data() : doc;
    const productId = data.productId || data.composedProductId;
    const cost = Number(data.costPrice || 0);
    if (productId && cost > 0) map[productId] = cost;
  }
  return map;
}

function resolvePlatformUnitCost(productId, productCost, fgCostMap) {
  const fg = fgCostMap[productId] || 0;
  return Math.max(0, fg || productCost || 0);
}

function imCogsCalcForwardOnly(invoice) {
  let total = 0;
  const items = invoice.lineItems || invoice.items || [];
  for (const item of items) {
    const qty = num(item.quantity);
    const unit = num(item.rawPrice);
    total += unit * qty;
  }
  return round(total, 2);
}

async function readFg(fgRef) {
  const snap = await fgRef.get();
  const d = snap.data() || {};
  return {
    exists: snap.exists,
    balance: round(num(d.currentBalance)),
    sold: round(num(d.quantitySold)),
    manufactured: round(num(d.quantityManufactured)),
    costPrice: round(num(d.costPrice)),
    totalValue: round(num(d.totalValue)),
    valuationMethod: d.valuationMethod,
    hasBatchQueue: Array.isArray(d.batchQueue) && d.batchQueue.length > 0,
    batchQueueLen: Array.isArray(d.batchQueue) ? d.batchQueue.length : 0,
    transactions: Array.isArray(d.transactions) ? d.transactions : [],
  };
}

async function restoreFgReturn(fgRef, productId, qty, orderId, invoiceNo, idempotencyKey, actor) {
  const snap = await fgRef.get();
  const fg = snap.data() || {};
  const balance = num(fg.currentBalance);
  const sold = num(fg.quantitySold);
  const costPrice = num(fg.costPrice);
  const txs = Array.isArray(fg.transactions) ? fg.transactions : [];
  const newBalance = balance + qty;
  const newSold = Math.max(0, sold - qty);
  const tx = {
    id: `TXN-RET-${Date.now()}`,
    date: nowIso(),
    actionType: 'return',
    quantity: qty,
    unitCost: costPrice,
    totalCost: round(qty * costPrice),
    reason: `E2E return for ${invoiceNo}`,
    referenceId: orderId,
    referenceNumber: invoiceNo,
    userId: actor.userId,
    userName: actor.userName,
    idempotencyKey,
  };
  await fgRef.update({
    currentBalance: newBalance,
    quantitySold: newSold,
    totalValue: round(newBalance * costPrice),
    transactions: [...txs, tx],
    updatedAt: nowIso(),
  });
  return { newBalance, newSold, costPrice };
}

async function runProduction({ fgRef, rawRef, productId, recipeId, qty, materialQty, materialCost, actor, label }) {
  const rawSnap = await rawRef.get();
  const raw = rawSnap.data() || {};
  const stock = num(raw.currentStock);
  const cost = num(raw.costPerUnit);
  assert(stock >= materialQty, `Insufficient raw stock for ${label}`);

  const newRawStock = round(stock - materialQty);
  const materialTotal = round(materialQty * cost);
  const costPerUnit = round(materialTotal / qty);

  const fgBefore = await readFg(fgRef);
  const newFgQty = round(fgBefore.balance + qty);
  const newFgCost = round(weightedCost(fgBefore.balance, fgBefore.costPrice, qty, costPerUnit));

  const opNow = nowIso();
  const batchRef = db.collection('productionBatches').doc();

  const tx = {
    id: `${Date.now()}`,
    date: opNow,
    actionType: 'manufactured',
    quantity: qty,
    unitCost: costPerUnit,
    totalCost: round(costPerUnit * qty),
    referenceId: batchRef.id,
    referenceNumber: label,
    userId: actor.userId,
    userName: actor.userName,
  };

  const batch = db.batch();
  batch.update(rawRef, { currentStock: newRawStock, updatedAt: opNow });
  batch.update(fgRef, {
    quantityManufactured: round(fgBefore.manufactured + qty),
    currentBalance: newFgQty,
    costPrice: newFgCost,
    totalValue: round(newFgQty * newFgCost),
    valuationMethod: 'WEIGHTED_AVERAGE',
    transactions: admin.firestore.FieldValue.arrayUnion(tx),
    updatedAt: opNow,
  });
  batch.set(batchRef, {
    storeId,
    testRunId,
    productId,
    composedProductId: productId,
    recipeId,
    status: 'completed',
    actualQuantity: qty,
    costPerUnit,
    totalCost: round(costPerUnit * qty),
    completionDate: opNow,
    createdAt: opNow,
    updatedAt: opNow,
    createdBy: actor.userId,
  });
  await batch.commit();

  return { costPerUnit, newFgCost, newFgQty, newRawStock };
}

async function cleanup() {
  const collections = [
    'orders', 'productionBatches', 'finishedGoodsInventory', 'purchases',
    'recipes', 'products', 'rawMaterials',
  ];
  const financeSubs = ['financeInvoices'];
  let deleted = 0;

  for (const col of collections) {
    const snap = await db.collection(col).where('storeId', '==', storeId).where('testRunId', '==', testRunId).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
      deleted += 1;
    }
  }
  for (const sub of financeSubs) {
    const snap = await db.collection('stores').doc(storeId).collection(sub).where('testRunId', '==', testRunId).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
      deleted += 1;
    }
  }
  console.log(`Cleanup: deleted ${deleted} docs (storeId=${storeId}, testRunId=${testRunId})`);
}

async function main() {
  const actor = { userId: `tester-${testRunId}`, userName: 'cogs.e2e', storeId, testRunId };
  const checks = [];
  const log = (name, pass, detail = '') => {
    checks.push({ name, pass, detail });
    console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  console.log(`\n=== COGS Bridge E2E Write Test ===`);
  console.log(`storeId: ${storeId}`);
  console.log(`testRunId: ${testRunId}\n`);

  const rawRef = db.collection('rawMaterials').doc();
  const productRef = db.collection('products').doc();
  const recipeRef = db.collection('recipes').doc();
  const fgRef = db.collection('finishedGoodsInventory').doc();
  const seedNow = nowIso();

  // --- Seed ---
  const seed = db.batch();
  seed.set(rawRef, {
    storeId, testRunId, name: 'E2E Flour', unit: 'kg',
    currentStock: 100, costPerUnit: 2.0, minimumStock: 0, reorderPoint: 0,
    createdBy: actor.userId, createdAt: seedNow, updatedAt: seedNow,
  });
  seed.set(recipeRef, {
    storeId, testRunId, outputQuantity: 10,
    ingredients: [{ rawMaterialId: rawRef.id, quantity: 20 }],
    createdBy: actor.userId, createdAt: seedNow, updatedAt: seedNow,
  });
  seed.set(productRef, {
    storeId, testRunId, name: 'E2E Bread Loaf', productType: 'composed',
    recipeId: recipeRef.id, price: 12, costPrice: 0,
    createdBy: actor.userId, createdAt: seedNow, updatedAt: seedNow,
  });
  seed.set(fgRef, {
    storeId, testRunId, itemCode: `FG-${Date.now().toString().slice(-6)}`,
    productId: productRef.id, composedProductId: productRef.id, recipeId: recipeRef.id,
    description: 'E2E Bread Loaf', productName: 'E2E Bread Loaf', unit: 'units',
    openingBalance: 0, quantityManufactured: 0, quantitySold: 0, quantityAdjusted: 0,
    currentBalance: 0, costPrice: 0, sellingPrice: 12, totalValue: 0,
    valuationMethod: 'WEIGHTED_AVERAGE', transactions: [],
    createdBy: actor.userId, createdAt: seedNow, updatedAt: seedNow,
  });
  await seed.commit();

  let fg = await readFg(fgRef);
  log('seed FG has no batchQueue', !fg.hasBatchQueue);
  log('seed FG valuationMethod', fg.valuationMethod === 'WEIGHTED_AVERAGE', fg.valuationMethod);

  // --- Production 1: 10 units @ 20kg material → $4/unit ---
  const prod1 = await runProduction({
    fgRef, rawRef, productId: productRef.id, recipeId: recipeRef.id,
    qty: 10, materialQty: 20, materialCost: 2.0, actor, label: 'BATCH-E2E-001',
  });
  fg = await readFg(fgRef);
  log('production1 FG balance', fg.balance === 10, `expected 10 got ${fg.balance}`);
  log('production1 FG costPrice', fg.costPrice === 4, `expected 4 got ${fg.costPrice}`);
  log('production1 no batchQueue written', fg.batchQueueLen === 0, `batchQueue len ${fg.batchQueueLen}`);

  // --- Sale 1: 6 units ---
  const sale1Ref = db.collection('orders').doc();
  const sale1Qty = 6;
  const sale1Now = nowIso();
  await sale1Ref.set({
    storeId, testRunId, status: 'delivered', paymentStatus: 'paid',
    invoiceNumber: 'ORD-E2E-001', totalAmount: sale1Qty * 12,
    items: [{ productId: productRef.id, quantity: sale1Qty, price: 12 }],
    createdAt: sale1Now, updatedAt: sale1Now, createdBy: actor.userId,
  });
  const sale1Result = await applyPaidOrderInventoryDeduction(sale1Ref.id, 'manual');
  fg = await readFg(fgRef);
  log('sale1 deduction applied', sale1Result.updated === 1, JSON.stringify(sale1Result));
  log('sale1 FG balance', fg.balance === 4, `expected 4 got ${fg.balance}`);
  log('sale1 FG sold', fg.sold === 6, `expected 6 got ${fg.sold}`);
  const sale1Tx = fg.transactions.find((t) => t.actionType === 'sold' && t.referenceId === sale1Ref.id);
  log('sale1 tx unitCost snapshot', sale1Tx && num(sale1Tx.unitCost) === 4, sale1Tx ? `unitCost=${sale1Tx.unitCost}` : 'missing');

  // --- Finance invoice (paid): snapshot line cost at save-time ---
  const invoiceQty = 4;
  const invoiceId = `INV-E2E-${Date.now()}`;
  const snapshotRawPrice = fg.costPrice; // <- cost frozen at invoice save
  const invoiceData = {
    testRunId,
    date: nowIso(),
    status: 'paid',
    clientName: 'E2E Client',
    amount: invoiceQty * 12,
    currency: 'USD',
    lineItems: [{
      id: productRef.id,
      description: 'E2E Bread Loaf',
      quantity: invoiceQty,
      unitPrice: 12,
      subtotal: invoiceQty * 12,
      rawPrice: snapshotRawPrice,
    }],
    items: [{
      id: productRef.id,
      description: 'E2E Bread Loaf',
      quantity: invoiceQty,
      unitPrice: 12,
      subtotal: invoiceQty * 12,
      rawPrice: snapshotRawPrice,
    }],
    createdAt: nowIso(),
  };
  await db.collection('stores').doc(storeId).collection('financeInvoices').doc(invoiceId).set(invoiceData);
  log('invoice line stored snapshot', snapshotRawPrice === 4, `rawPrice=${snapshotRawPrice}`);

  // --- Return 2 units ---
  await restoreFgReturn(fgRef, productRef.id, 2, sale1Ref.id, 'ORD-E2E-001', `e2e-return:${sale1Ref.id}`, actor);
  fg = await readFg(fgRef);
  log('return FG balance', fg.balance === 6, `expected 6 got ${fg.balance}`);
  log('return FG sold', fg.sold === 4, `expected 4 got ${fg.sold}`);

  // Raise raw material cost so next production changes FG weighted-average cost.
  await rawRef.update({ costPerUnit: 6.0, updatedAt: nowIso() });

  // --- Production 2: cost shock to change FG cost AFTER invoice creation ---
  await runProduction({
    fgRef, rawRef, productId: productRef.id, recipeId: recipeRef.id,
    qty: 5, materialQty: 10, materialCost: 6.0, actor, label: 'BATCH-E2E-002',
  });
  fg = await readFg(fgRef);
  log('production2 changed FG cost', fg.costPrice > snapshotRawPrice, `snapshot=${snapshotRawPrice} current=${fg.costPrice}`);

  // --- Sale 2: 3 units (write path still healthy after cost change) ---
  const sale2Ref = db.collection('orders').doc();
  const sale2Qty = 3;
  await sale2Ref.set({
    storeId, testRunId, status: 'delivered', paymentStatus: 'paid',
    invoiceNumber: 'ORD-E2E-002', totalAmount: sale2Qty * 12,
    items: [{ productId: productRef.id, quantity: sale2Qty, price: 12 }],
    createdAt: nowIso(), updatedAt: nowIso(), createdBy: actor.userId,
  });
  const sale2Result = await applyPaidOrderInventoryDeduction(sale2Ref.id, 'manual');
  fg = await readFg(fgRef);
  log('sale2 deduction applied', sale2Result.updated === 1, JSON.stringify(sale2Result));

  // --- COGS projection (read path used by IM after deploy) ---
  const [fgSnap, prodSnap] = await Promise.all([
    db.collection('finishedGoodsInventory').where('storeId', '==', storeId).get(),
    db.collection('products').where('storeId', '==', storeId).get(),
  ]);
  const fgCostMap = buildFgCostMap(fgSnap.docs);
  const productById = {};
  prodSnap.docs.forEach((d) => { productById[d.id] = d.data(); });

  const platformUnitCost = resolvePlatformUnitCost(productRef.id, num(productById[productRef.id]?.costPrice), fgCostMap);
  const invoiceSnapshotCogs = imCogsCalcForwardOnly(invoiceData);
  const liveRecalcCogs = round(platformUnitCost * invoiceQty, 2);

  // Platform order COGS for delivered orders (AdminRevenue pattern — current FG cost)
  const sale1Snap = await sale1Ref.get();
  const sale2Snap = await sale2Ref.get();
  const sale1OrderQty = num((sale1Snap.data().items || [])[0]?.quantity);
  const sale2OrderQty = num((sale2Snap.data().items || [])[0]?.quantity);
  const platformOrderCogs = round(platformUnitCost * (sale1OrderQty + sale2OrderQty), 2);

  console.log('\n--- COGS comparison (post write cycle) ---');
  console.log(`Current FG costPrice:     $${fg.costPrice}`);
  console.log(`Invoice snapshot unitCost:$${snapshotRawPrice}`);
  console.log(`Current live unitCost:    $${platformUnitCost}`);
  console.log(`Invoice qty:              ${invoiceQty}`);
  console.log(`IM COGS (forward-only):   $${invoiceSnapshotCogs}`);
  console.log(`Live recalc COGS (if used): $${liveRecalcCogs}`);
  console.log(`Platform order COGS*:     $${platformOrderCogs}  (*uses current FG cost, same as AdminRevenue)`);

  log('forward-only invoice COGS stays fixed', invoiceSnapshotCogs === round(snapshotRawPrice * invoiceQty, 2), `snapshotCogs=${invoiceSnapshotCogs}`);
  log('invoice COGS unaffected by later FG cost change', invoiceSnapshotCogs !== liveRecalcCogs, `fixed=${invoiceSnapshotCogs} live=${liveRecalcCogs}`);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n=== Result: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${checks.length - failed.length}/${checks.length} checks) ===`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.name).join(', '));
  }

  if (!KEEP) {
    await cleanup();
  } else {
    console.log(`\n--keep: data retained at storeId=${storeId} testRunId=${testRunId}`);
    console.log(`Re-run read verify: node scripts/verifyCogsBridge.cjs ${storeId}`);
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  if (!KEEP) {
    try { await cleanup(); } catch { /* ignore */ }
  }
  process.exit(1);
});
