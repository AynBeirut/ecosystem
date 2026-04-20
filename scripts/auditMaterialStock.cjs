/**
 * auditMaterialStock.cjs
 * Reconstructs the stock balance from all transactions for a given raw material
 * and compares it to the stored stockQuantity.
 *
 * Run: node scripts/auditMaterialStock.cjs
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TARGET_NAME = '14gsm'; // case-insensitive fragment to match material name

async function main() {
  const matsSnap = await db.collection('rawMaterials').get();

  const matches = matsSnap.docs.filter(d =>
    (d.data().name || '').toLowerCase().includes(TARGET_NAME.toLowerCase())
  );

  if (matches.length === 0) {
    console.log(`No material found matching "${TARGET_NAME}"`);
    return;
  }

  for (const matDoc of matches) {
    const mat = matDoc.data();
    console.log('='.repeat(60));
    console.log(`Material : ${mat.name}`);
    console.log(`ID       : ${matDoc.id}`);
    console.log(`StoreId  : ${mat.storeId}`);
    console.log(`Stored stockQuantity : ${mat.stockQuantity}`);
    console.log(`costPerUnit          : ${mat.costPerUnit}`);
    console.log('');

    // Look at stockTransactions sub-collection if it exists
    const txSnap = await db.collection('rawMaterials').doc(matDoc.id)
      .collection('stockTransactions').orderBy('date', 'asc').get();

    if (txSnap.empty) {
      console.log('  No stockTransactions sub-collection found.');
    } else {
      let running = 0;
      console.log('  stockTransactions sub-collection:');
      for (const tx of txSnap.docs) {
        const t = tx.data();
        running += (t.quantityChange || 0);
        console.log(`  [${t.date}] ${t.type || t.actionType} qty=${t.quantityChange} running=${running.toFixed(3)} | ${t.reason || t.note || ''}`);
      }
      console.log(`  → Reconstructed balance from sub-collection: ${running.toFixed(3)}`);
    }

    // Check transactions array on the document itself
    const txArr = mat.transactions || mat.stockHistory || [];
    if (txArr.length > 0) {
      let running = 0;
      console.log(`\n  Inline transactions array (${txArr.length} entries):`);
      const sorted = [...txArr].sort((a, b) => new Date(a.date) - new Date(b.date));
      for (const t of sorted) {
        running += (t.quantityChange || t.quantity || 0);
        console.log(`  [${t.date}] ${t.type || t.actionType || ''} qty=${t.quantityChange ?? t.quantity} running=${running.toFixed(3)} | ${t.reason || t.note || ''}`);
      }
      console.log(`  → Reconstructed balance from inline array: ${running.toFixed(3)}`);
    }

    // Check production orders that consumed this material
    const prodSnap = await db.collection('productionBatches')
      .where('storeId', '==', mat.storeId)
      .get();

    let totalConsumed = 0;
    let prodRows = [];
    for (const p of prodSnap.docs) {
      const b = p.data();
      for (const ing of b.ingredients || b.materialsUsed || []) {
        if (ing.rawMaterialId === matDoc.id) {
          totalConsumed += (ing.quantity || 0);
          prodRows.push({ date: b.date || b.createdAt, batch: b.batchNumber || p.id, qty: ing.quantity, status: b.status });
        }
      }
    }
    if (prodRows.length > 0) {
      console.log(`\n  Production batches consuming this material:`);
      prodRows.sort((a,b) => new Date(a.date) - new Date(b.date));
      for (const r of prodRows) console.log(`  [${r.date}] batch=${r.batch} consumed=${r.qty} status=${r.status}`);
      console.log(`  → Total consumed in production: ${totalConsumed.toFixed(3)}`);
    }

    // Check purchase orders that received this material
    const poSnap = await db.collection('purchases')
      .where('storeId', '==', mat.storeId)
      .get();

    let totalReceived = 0;
    let poRows = [];
    for (const p of poSnap.docs) {
      const po = p.data();
      for (const item of po.items || []) {
        if (item.rawMaterialId === matDoc.id || item.materialId === matDoc.id) {
          const qty = item.receivedQuantity || item.quantity || 0;
          totalReceived += qty;
          poRows.push({ date: po.date || po.createdAt, po: po.poNumber || p.id, qty, status: po.status });
        }
      }
    }
    if (poRows.length > 0) {
      console.log(`\n  Purchase orders for this material:`);
      poRows.sort((a,b) => new Date(a.date) - new Date(b.date));
      for (const r of poRows) console.log(`  [${r.date}] PO=${r.po} qty=${r.qty} status=${r.status}`);
      console.log(`  → Total received from POs: ${totalReceived.toFixed(3)}`);
      console.log(`  → Expected balance (received - consumed): ${(totalReceived - totalConsumed).toFixed(3)}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
