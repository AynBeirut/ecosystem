/**
 * audit14GSM_v2.cjs — Full stock reconstruction for 14 GSM 2PLY 80CM (NIPCO)
 * Uses correct field names: materialsUsed[].quantityUsed
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
initializeApp({ credential: cert(require(path.join(__dirname, '../serviceAccountKey.json'))) });
const db = getFirestore();

const MAT_ID   = 'kPWepQNvyHlOZS03ZdSx';
const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

function fmt(n) { return (n || 0).toFixed(3); }

async function main() {
  const matDoc = await db.collection('rawMaterials').doc(MAT_ID).get();
  const mat = matDoc.data();

  console.log('=== 14 GSM 2PLY 80CM Stock Audit ===');
  console.log(`currentStock      : ${mat.currentStock}`);
  console.log(`lastPhysicalCount : ${mat.lastPhysicalCount}  (date: ${mat.lastPhysicalCountDate})`);
  console.log(`costPerUnit       : ${mat.costPerUnit}`);
  console.log('');

  const lastCountDate = mat.lastPhysicalCountDate || '1970-01-01';
  const lastCount     = mat.lastPhysicalCount || 0;

  // ── Purchase Orders ──
  const poSnap = await db.collection('purchases').where('storeId', '==', STORE_ID).get();
  let totalReceived = 0;
  let poRows = [];
  for (const d of poSnap.docs) {
    const po = d.data();
    for (const item of po.items || []) {
      if (item.rawMaterialId === MAT_ID || item.materialId === MAT_ID) {
        const qty = item.receivedQuantity ?? item.quantityReceived ?? item.quantity ?? 0;
        const isReceived = ['received', 'partially_received'].includes(po.status) || item.received;
        const date = (po.receivedDate || po.date || po.createdAt || '').slice(0, 10);
        const afterCount = date >= lastCountDate;
        poRows.push({ date, po: po.poNumber || d.id, qty, isReceived, status: po.status, afterCount });
        if (isReceived && afterCount) totalReceived += qty;
      }
    }
  }
  poRows.sort((a, b) => a.date.localeCompare(b.date));
  console.log('--- All Purchase Orders for this material ---');
  for (const r of poRows) {
    const mark = r.afterCount && r.isReceived ? ' ← counts' : '';
    console.log(`  [${r.date}] ${r.po}  qty=${r.qty}  status=${r.status}${mark}`);
  }
  console.log(`  → Received AFTER last count (${lastCountDate}): ${fmt(totalReceived)}`);
  console.log('');

  // ── Production Batches ──
  const batchSnap = await db.collection('productionBatches').where('storeId', '==', STORE_ID).get();
  let totalConsumed = 0;
  let batchRows = [];
  for (const d of batchSnap.docs) {
    const b = d.data();
    const mats = b.materialsUsed || b.ingredients || b.materials || [];
    for (const m of mats) {
      if (m.rawMaterialId === MAT_ID || m.materialId === MAT_ID) {
        const qty = m.quantityUsed ?? m.actualQuantity ?? m.quantity ?? 0;
        const date = (b.completionDate || b.completedAt || b.date || b.createdAt || '').slice(0, 10);
        const afterCount = date >= lastCountDate;
        batchRows.push({ date, batch: b.batchNumber || d.id, qty, status: b.status, product: b.productName || '', afterCount });
        if (b.status === 'completed' && afterCount) totalConsumed += qty;
      }
    }
  }
  batchRows.sort((a, b) => a.date.localeCompare(b.date));
  console.log('--- All Production Batches consuming this material ---');
  for (const r of batchRows) {
    const mark = r.afterCount && r.status === 'completed' ? ' ← counts' : '';
    console.log(`  [${r.date}] ${r.batch}  product="${r.product}"  consumed=${r.qty}  status=${r.status}${mark}`);
  }
  console.log(`  → Consumed AFTER last count (completed): ${fmt(totalConsumed)}`);
  console.log('');

  // ── Reconstruction ──
  const expectedBalance = lastCount + totalReceived - totalConsumed;
  console.log('=== Reconstruction ===');
  console.log(`Last physical count (${lastCountDate}) : ${fmt(lastCount)}`);
  console.log(`+ Received after count                : +${fmt(totalReceived)}`);
  console.log(`- Consumed after count (production)   : -${fmt(totalConsumed)}`);
  console.log(`= Expected balance                    : ${fmt(expectedBalance)}`);
  console.log(`  Stored currentStock                 : ${mat.currentStock}`);
  console.log(`  User claims should be               : 358.8`);
  console.log(`  Gap (expected vs stored)            : ${fmt(expectedBalance - mat.currentStock)}`);
  console.log(`  Gap (user claim vs stored)          : ${fmt(358.8 - mat.currentStock)}`);
  console.log(`  Gap (expected vs user claim)        : ${fmt(expectedBalance - 358.8)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
