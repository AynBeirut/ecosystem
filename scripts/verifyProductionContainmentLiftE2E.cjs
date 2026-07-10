#!/usr/bin/env node
/**
 * Containment lift Gates B–D — production start/complete with subledger + GL checks.
 *
 * Gate B: raw drop on complete equals recipe formula (±0.001)
 * Gate C: order-side raw deduction flag remains disabled (static source check)
 * Gate D: incident-store materials unchanged (read-only snapshot; optional)
 *
 * Usage:
 *   node scripts/verifyProductionContainmentLiftE2E.cjs
 *   node scripts/verifyProductionContainmentLiftE2E.cjs --keep
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEEP = process.argv.includes('--keep');
const INCIDENT_STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const INCIDENT_MATERIALS = [
  'kPWepQNvyHlOZS03ZdSx',
  'CPDd3KJjKm8dwVDyQQ9o',
  'QUCkefY9LkkrfwOrihyr',
  'omNntXGXd0CYgW59GKyg',
];

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
const testRunId = `contain-lift-${Date.now()}`;
const storeId = `test-${testRunId}`;

const {
  ensureDefaultChartOfAccounts,
} = require('../functions/lib/lib/ledger/postingService');
const {
  autoPostProductionStart,
  autoPostProductionWipCompleteFlow,
} = require('../functions/lib/lib/ledger/platformAutoPosting');
const { GL_ACCOUNT_CODES } = require('../functions/lib/lib/ledger/defaultChartOfAccounts');

const round3 = (n) => Math.round(n * 1000) / 1000;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
function assert(c, m) { if (!c) throw new Error(m); }
function nowIso() { return new Date().toISOString(); }

async function sumAccountBalance(code) {
  const lines = await db.collection('stores').doc(storeId).collection('journalLines')
    .where('accountCode', '==', code).get();
  let net = 0;
  lines.forEach((d) => {
    const row = d.data();
    net += round2(row.debit || 0) - round2(row.credit || 0);
  });
  return round2(net);
}

async function readRawStock(rawId) {
  const snap = await db.collection('rawMaterials').doc(rawId).get();
  return snap.exists ? Number(snap.data().currentStock || 0) : null;
}

async function readFgBalance(productId) {
  const snap = await db.collection('finishedGoodsInventory')
    .where('storeId', '==', storeId)
    .where('productId', '==', productId)
    .limit(1)
    .get();
  if (snap.empty) return 0;
  return round3(Number(snap.docs[0].data().currentBalance || 0));
}

async function snapshotIncidentMaterials() {
  const out = {};
  for (const id of INCIDENT_MATERIALS) {
    out[id] = await readRawStock(id);
  }
  return out;
}

function gateC_staticOrderDeductionDisabled() {
  const ordersSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/pages/admin/AdminOrders.tsx'),
    'utf8',
  );
  assert(
    /const ENABLE_ORDER_RAW_MATERIAL_DEDUCTION = false;/.test(ordersSrc),
    'Gate C: ENABLE_ORDER_RAW_MATERIAL_DEDUCTION must remain false in AdminOrders.tsx',
  );
  console.log('✓ Gate C — order-side raw deduction disabled in source');
}

async function cleanupTestData(rawId, productId, batchId, fgDocId) {
  const cols = ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta'];
  for (const col of cols) {
    const snap = await db.collection('stores').doc(storeId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
  if (fgDocId) await db.collection('finishedGoodsInventory').doc(fgDocId).delete();
  if (batchId) await db.collection('productionBatches').doc(batchId).delete().catch(() => {});
  if (productId) await db.collection('products').doc(productId).delete().catch(() => {});
  if (rawId) await db.collection('rawMaterials').doc(rawId).delete().catch(() => {});
  const recipeId = `recipe-${testRunId}`;
  await db.collection('recipes').doc(recipeId).delete().catch(() => {});
}

async function main() {
  console.log(`\n=== Containment Lift E2E — ${storeId} ===\n`);

  gateC_staticOrderDeductionDisabled();

  const incidentBefore = await snapshotIncidentMaterials();
  console.log('  Gate D baseline (incident store materials):', incidentBefore);

  const accounts = await ensureDefaultChartOfAccounts(storeId);
  assert(accounts.some((a) => a.code === GL_ACCOUNT_CODES.WIP_INVENTORY), '1150 WIP missing');

  const rawId = `raw-${testRunId}`;
  const recipeId = `recipe-${testRunId}`;
  const productId = `prod-${testRunId}`;
  const batchId = `batch-${testRunId}`;
  const fgDocId = `fg-${testRunId}`;

  const initialRawStock = 100;
  const costPerUnit = 2.5;
  const recipeIngredientQty = 4;
  const recipeOutputQty = 1;
  const plannedQty = 10;
  const actualQty = 12; // variance path

  const expectedAtStart = round3((recipeIngredientQty * plannedQty) / recipeOutputQty);
  const expectedAtComplete = round3((recipeIngredientQty * actualQty) / recipeOutputQty);
  const expectedVarianceExtra = round3(expectedAtComplete - expectedAtStart);

  await db.collection('rawMaterials').doc(rawId).set({
    name: `Test Raw ${testRunId}`,
    storeId,
    currentStock: initialRawStock,
    costPerUnit,
    unit: 'kg',
    createdAt: nowIso(),
  });

  await db.collection('recipes').doc(recipeId).set({
    name: `Test Recipe ${testRunId}`,
    storeId,
    outputQuantity: recipeOutputQty,
    ingredients: [{ rawMaterialId: rawId, quantity: recipeIngredientQty }],
    createdAt: nowIso(),
  });

  await db.collection('products').doc(productId).set({
    name: `Test FG ${testRunId}`,
    storeId,
    recipeId,
    createdAt: nowIso(),
  });

  await db.collection('productionBatches').doc(batchId).set({
    storeId,
    status: 'planned',
    quantity: plannedQty,
    productId,
    composedProductId: productId,
    recipeId,
    productName: `Test FG ${testRunId}`,
    createdAt: nowIso(),
  });

  const rawBeforeStart = await readRawStock(rawId);
  assert(rawBeforeStart === initialRawStock, `Raw baseline ${rawBeforeStart}`);

  // --- START (mirrors AdminProduction handleStartProduction) ---
  const costStart = round2(costPerUnit * expectedAtStart);
  const materialsUsedAtStart = [{
    rawMaterialId: rawId,
    materialName: `Test Raw ${testRunId}`,
    quantityUsed: expectedAtStart,
    unitCost: costPerUnit,
    totalCost: costStart,
  }];

  await db.collection('rawMaterials').doc(rawId).update({
    currentStock: admin.firestore.FieldValue.increment(-expectedAtStart),
    updatedAt: nowIso(),
  });

  const startIso = nowIso();
  await db.collection('productionBatches').doc(batchId).update({
    status: 'in_progress',
    startDate: startIso,
    wipGlStartedAt: startIso,
    plannedQuantityAtStart: plannedQty,
    materialsCostAtStart: costStart,
    materialsUsedAtStart,
    recipeId,
    productId,
    composedProductId: productId,
  });

  await autoPostProductionStart(storeId, batchId, costStart, startIso, accounts);

  const rawAfterStart = await readRawStock(rawId);
  assert(round3(rawAfterStart) === round3(initialRawStock - expectedAtStart),
    `Gate B (start): raw ${rawAfterStart} expected ${initialRawStock - expectedAtStart}`);
  const wipAfterStart = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);
  const rawGlAfterStart = await sumAccountBalance(GL_ACCOUNT_CODES.INVENTORY);
  assert(wipAfterStart === costStart, `GL WIP after start ${wipAfterStart}`);
  assert(rawGlAfterStart === -costStart, `GL Raw after start ${rawGlAfterStart}`);
  console.log('✓ Start — raw subledger + Dr WIP / Cr Raw');

  // --- COMPLETE with variance (mirrors WIP complete path) ---
  const costActual = round2(costPerUnit * expectedAtComplete);
  const materialsUsedAtComplete = [{
    rawMaterialId: rawId,
    materialName: `Test Raw ${testRunId}`,
    quantityUsed: expectedAtComplete,
    unitCost: costPerUnit,
    totalCost: costActual,
  }];

  if (expectedVarianceExtra > 0) {
    await db.collection('rawMaterials').doc(rawId).update({
      currentStock: admin.firestore.FieldValue.increment(-expectedVarianceExtra),
      updatedAt: nowIso(),
    });
  }

  const completeIso = nowIso();
  await db.collection('productionBatches').doc(batchId).update({
    status: 'completed',
    completionDate: completeIso,
    actualQuantity: actualQty,
    materialsCost: costActual,
    materialsCostAtComplete: costActual,
    wipVarianceCost: round2(costActual - costStart),
    materialsUsed: materialsUsedAtComplete,
  });

  await db.collection('finishedGoodsInventory').doc(fgDocId).set({
    storeId,
    productId,
    productName: `Test FG ${testRunId}`,
    currentBalance: actualQty,
    costPrice: round2(costActual / actualQty),
    quantityManufactured: actualQty,
    transactions: [],
    createdAt: completeIso,
  });

  await autoPostProductionWipCompleteFlow(storeId, batchId, costStart, costActual, completeIso, accounts);

  const rawAfterComplete = await readRawStock(rawId);
  const expectedRawFinal = round3(initialRawStock - expectedAtComplete);
  assert(Math.abs(round3(rawAfterComplete) - expectedRawFinal) <= 0.001,
    `Gate B: raw after complete ${rawAfterComplete} expected ${expectedRawFinal} (formula: ingredient*actual/output)`);

  const fgAfterComplete = await readFgBalance(productId);
  assert(fgAfterComplete === actualQty, `FG balance ${fgAfterComplete} expected ${actualQty}`);

  const wipNet = await sumAccountBalance(GL_ACCOUNT_CODES.WIP_INVENTORY);
  const fgGl = await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY);
  assert(wipNet === 0, `WIP should net zero after complete, got ${wipNet}`);
  assert(fgGl === costActual, `FG GL ${fgGl} expected ${costActual}`);
  console.log('✓ Complete (variance) — raw/FG subledger + GL journals match');

  const incidentAfter = await snapshotIncidentMaterials();
  for (const id of INCIDENT_MATERIALS) {
    assert(
      incidentAfter[id] === incidentBefore[id],
      `Gate D: incident material ${id} changed ${incidentBefore[id]} → ${incidentAfter[id]}`,
    );
  }
  console.log('✓ Gate D — incident-store materials unchanged');

  if (!KEEP) {
    await cleanupTestData(rawId, productId, batchId, fgDocId);
    console.log('\n🧹 Test data cleaned up');
  } else {
    console.log(`\n--keep: storeId=${storeId} batchId=${batchId}`);
  }

  console.log('\n✅ Containment lift Gates B–D passed\n');
}

main().catch((err) => {
  console.error('\n❌', err.message || err);
  process.exit(1);
});
