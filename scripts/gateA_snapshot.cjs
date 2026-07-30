#!/usr/bin/env node
/** Read-only snapshot for Gate A — incident store raw materials + candidate order/batch. */
const admin = require('firebase-admin');
const path = require('path');

const STORE = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
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
const db = admin.firestore();

async function main() {
  const label = process.argv[2] || 'snapshot';
  const raw = {};
  for (const id of INCIDENT_MATERIALS) {
    const snap = await db.collection('rawMaterials').doc(id).get();
    raw[id] = snap.exists ? Number(snap.data().currentStock || 0) : null;
  }

  const batches = await db.collection('productionBatches')
    .where('storeId', '==', STORE)
    .where('status', '==', 'in_progress')
    .limit(5)
    .get();

  const orders = await db.collection('orders')
    .where('storeId', '==', STORE)
    .where('status', 'in', ['pending', 'confirmed', 'processing'])
    .limit(5)
    .get();

  console.log(JSON.stringify({
    label,
    at: new Date().toISOString(),
    storeId: STORE,
    incidentMaterials: raw,
    inProgressBatches: batches.docs.map((d) => ({ id: d.id, ...d.data() })),
    candidateOrders: orders.docs.map((d) => ({ id: d.id, status: d.data().status, orderNumber: d.data().orderNumber })),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
