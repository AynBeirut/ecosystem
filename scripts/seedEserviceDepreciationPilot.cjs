/**
 * Pilot fixed asset on E-Service for depreciation proof (admin SDK).
 * Usage: node scripts/seedEserviceDepreciationPilot.cjs [--cleanup]
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const ASSET_ID = 'FA-TEST-DEP-PILOT-2026';
const cleanup = process.argv.includes('--cleanup');

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();
const now = () => new Date().toISOString();

(async () => {
  const assetRef = db.doc(`stores/${STORE}/fixedAssets/${ASSET_ID}`);

  if (cleanup) {
    const keyRef = db.doc(`stores/${STORE}/journalEntryKeys/depreciation:2026-07:post`);
    const keySnap = await keyRef.get();
    if (keySnap.exists) {
      const entryId = keySnap.data().entryId;
      const lines = await db.collection(`stores/${STORE}/journalLines`).where('entryId', '==', entryId).get();
      const batch = db.batch();
      lines.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(db.doc(`stores/${STORE}/journalEntries/${entryId}`));
      batch.delete(keyRef);
      await batch.commit();
      console.log('Removed test depreciation JE', entryId);
    }
    await assetRef.delete();
    console.log('Removed pilot asset');
    return;
  }

  await assetRef.set({
    id: ASSET_ID,
    storeId: STORE,
    name: 'E-Service Depreciation Pilot (test)',
    inServiceDate: '2026-01-01',
    cost: 1200,
    salvageValue: 0,
    usefulLifeMonths: 12,
    assetAccountCode: '155',
    accumDeprAccountCode: '156',
    expenseAccountCode: '710',
    accumulatedDepreciation: 0,
    status: 'active',
    currency: 'USD',
    notes: 'Pilot asset for verifyDepreciationE2E — safe to cleanup',
    createdAt: now(),
    updatedAt: now(),
  });
  console.log('Seeded pilot asset', ASSET_ID, 'on E-Service — $1200 / 12 mo → $100/mo');
})();
