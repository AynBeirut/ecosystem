/**
 * Compare products.costPrice vs finishedGoodsInventory.costPrice for a store.
 * Shows where IM would have disagreed with platform before the bridge.
 */
const admin = require('firebase-admin');
const path = require('path');
const storeId = process.argv[2] || 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const [fgSnap, prodSnap] = await Promise.all([
    db.collection('finishedGoodsInventory').where('storeId', '==', storeId).get(),
    db.collection('products').where('storeId', '==', storeId).get(),
  ]);
  const products = {};
  prodSnap.forEach((d) => { products[d.id] = d.data(); });

  console.log(`\nStore ${storeId} — FG vs product cost\n`);
  fgSnap.forEach((d) => {
    const fg = d.data();
    const pid = fg.productId || fg.composedProductId;
    const p = products[pid];
    const prodCost = Number(p?.costPrice || 0);
    const fgCost = Number(fg.costPrice || 0);
    const delta = fgCost - prodCost;
    if (Math.abs(delta) > 0.0001 || prodCost === 0) {
      console.log(`${fg.productName || p?.name || pid}`);
      console.log(`  product.costPrice: $${prodCost.toFixed(4)} | FG.costPrice: $${fgCost.toFixed(4)} | delta: $${delta.toFixed(4)}`);
    }
  });

  // One delivered order line sample
  const orders = await db.collection('orders').where('storeId', '==', storeId).limit(20).get();
  for (const doc of orders.docs) {
    const o = doc.data();
    if (o.status !== 'delivered') continue;
    const item = (o.items || [])[0];
    if (!item) continue;
    const pid = item.productId || item.composedProductId || item.id;
    const p = products[pid];
    const fgDoc = fgSnap.docs.find((d) => (d.data().productId || d.data().composedProductId) === pid);
    const fgCost = fgDoc ? Number(fgDoc.data().costPrice || 0) : 0;
    const prodCost = Number(p?.costPrice || 0);
    const qty = Number(item.quantity || 0);
    console.log(`\nSample order ${doc.id}:`);
    console.log(`  ${p?.name || pid} x${qty}`);
    console.log(`  IM OLD COGS (product.costPrice): $${(prodCost * qty).toFixed(2)}`);
    console.log(`  IM NEW / Platform COGS (FG.costPrice): $${(fgCost * qty).toFixed(2)}`);
    console.log(`  Delta: $${((fgCost - prodCost) * qty).toFixed(2)}`);
    break;
  }
}

main().catch(console.error);
