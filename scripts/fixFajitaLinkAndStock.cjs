/**
 * One-off: link fajita recipe to its product and set temporary test stock.
 * Store: ujff7blWYvUvlekQOrybvNCnn9V2 (jinandaw86@gmail.com)
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
const db = admin.firestore();

const PRODUCT_ID = 'zvjB1q5pUUnucm5eds8M';
const RECIPE_ID = 'tnlR4hHJRgt4EZQJwigE';
const BREAD_ID = '5BrsNQf1pPAQZ6Y3Pn4S';
const TOMATO_ID = 'quUPsqoS0ww6UXyfNelg';
const nowIso = new Date().toISOString();

(async () => {
  await db.collection('products').doc(PRODUCT_ID).set(
    { recipeId: RECIPE_ID, updatedAt: nowIso },
    { merge: true },
  );
  await db.collection('rawMaterials').doc(BREAD_ID).set(
    { currentStock: 100, updatedAt: nowIso }, { merge: true },
  );
  await db.collection('rawMaterials').doc(TOMATO_ID).set(
    { currentStock: 50, updatedAt: nowIso }, { merge: true },
  );

  const [p, b, t] = await Promise.all([
    db.collection('products').doc(PRODUCT_ID).get(),
    db.collection('rawMaterials').doc(BREAD_ID).get(),
    db.collection('rawMaterials').doc(TOMATO_ID).get(),
  ]);
  console.log('✅ product.recipeId =', p.data().recipeId);
  console.log('✅ bread.currentStock =', b.data().currentStock);
  console.log('✅ tomato.currentStock =', t.data().currentStock);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
