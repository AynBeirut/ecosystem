/**
 * audit14GSM.cjs — Full stock reconstruction for 14 GSM 2PLY 80CM (NIPCO)
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
initializeApp({ credential: cert(require(path.join(__dirname, '../serviceAccountKey.json'))) });
const db = getFirestore();

const MAT_ID    = 'kPWepQNvyHlOZS03ZdSx';
const STORE_ID  = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

async function main() {
  const matDoc = await db.collection('rawMaterials').doc(MAT_ID).get();
  const mat    = matDoc.data();
  console.log('=== 14 GSM 2PLY 80CM Stock Audit ===');
  console.log(`currentStock      : ${mat.currentStock}`);
  console.log(`lastPhysicalCount : ${mat.lastPhysicalCount}  (date: ${mat.lastPhysicalCountDate})`);
  console.log('');

  // 1. Inline transactions array
  const txArr = mat.transactions || mat.stockHistory || mat.stockTransactions || [];
  if (txArr.length > 0) {
    console.log(`--- Inline transactions (${txArr.length}) ---`);
    const sorted = [...txArr].sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    for (const t of sorted) {
      const delta = t.quantityChange ?? t.quantity ?? t.delta ?? 0;
      running += delta;
      console.log(`  [${(t.date||'').slice(0,10)}] ${(t.type||t.actionType||'').padEnd(15)} delta=${String(delta).padStart(10)}  running=${running.toFixed(3)}  ${t.reason||t.note||t.referenceNumber||''}`);
    }
    console.log(`  → Reconstructed from inline txns: ${running.toFixed(3)}`);
    console.log('');
  }

  // 2. Sub-collection stockTransactions
  const subTxSnap = await db.collection('rawMaterials').doc(MAT_ID)
    .collection('stockTransactions').orderBy('date', 'asc').get();
  if (!subTxSnap.empty) {
    console.log(`--- Sub-collection stockTransactions (${subTxSnap.size}) ---`);
    let running = 0;
    for (const d of subTxSnap.docs) {
      const t = d.data();
      const delta = t.quantityChange ?? t.quantity ?? 0;
      running += delta;
      console.log(`  [${(t.date||'').slice(0,10)}] ${(t.type||t.actionType||'').padEnd(15)} delta=${String(delta).padStart(10)}  running=${running.toFixed(3)}  ${t.reason||''}`);
    }
    console.log(`  → Reconstructed from sub-collection: ${running.toFixed(3)}`);
    console.log('');
  }

  // 3. Purchase orders received for this material
  const poSnap = await db.collection('purchases').where('storeId', '==', STORE_ID).get();
  let totalReceived = 0;
  console.log('--- Purchase Orders ---');
  for (const d of poSnap.docs) {
    const po = d.data();
    const items = po.items || [];
    for (const item of items) {
      if (item.rawMaterialId === MAT_ID || item.materialId === MAT_ID) {
        const qty = item.receivedQuantity ?? item.quantityReceived ?? item.quantity ?? 0;
        const received = (po.status === 'received' || po.status === 'partially_received' || item.received) ? qty : 0;
        totalReceived += received;
        console.log(`  [${(po.date||po.createdAt||'').slice(0,10)}] PO=${po.poNumber||d.id}  ordered=${qty}  received=${received}  status=${po.status}`);
      }
    }
  }
  console.log(`  → Total received from POs: ${totalReceived.toFixed(3)}`);
  console.log('');

  // 4. Production batches consuming this material
  const batchSnap = await db.collection('productionBatches').where('storeId', '==', STORE_ID).get();
  let totalConsumed = 0;
  let rows = [];
  for (const d of batchSnap.docs) {
    const b = d.data();
    const ings = b.ingredients || b.materialsUsed || b.materials || [];
    for (const ing of ings) {
      if (ing.rawMaterialId === MAT_ID || ing.materialId === MAT_ID) {
        const qty = ing.actualQuantity ?? ing.quantity ?? 0;
        if (b.status === 'completed') totalConsumed += qty;
        rows.push({ date: (b.completedAt || b.date || b.createdAt || '').slice(0,10), batch: b.batchNumber || d.id, qty, status: b.status });
      }
    }
  }
  rows.sort((a,b) => a.date.localeCompare(b.date));
  console.log('--- Production Batches (completed only counted) ---');
  for (const r of rows) console.log(`  [${r.date}] ${r.batch}  consumed=${r.qty}  status=${r.status}`);
  console.log(`  → Total consumed (completed batches): ${totalConsumed.toFixed(3)}`);
  console.log('');

  // 5. Summary
  const lastCount    = mat.lastPhysicalCount || 0;
  const expected     = lastCount + (totalReceived - 0) - totalConsumed; // rough from last count
  console.log('=== Summary ===');
  console.log(`Last physical count (${mat.lastPhysicalCountDate}): ${lastCount}`);
  console.log(`Total received (POs):                              ${totalReceived.toFixed(3)}`);
  console.log(`Total consumed (production):                       ${totalConsumed.toFixed(3)}`);
  console.log(`Expected balance (count + received - consumed):    ${(lastCount + totalReceived - totalConsumed).toFixed(3)}`);
  console.log(`Stored currentStock:                               ${mat.currentStock}`);
  console.log(`User claims should be:                             358.8`);
  console.log(`Gap (stored vs user claim):                        ${(358.8 - mat.currentStock).toFixed(3)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
