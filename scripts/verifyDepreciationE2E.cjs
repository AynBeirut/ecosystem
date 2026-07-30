/**
 * Post + verify monthly depreciation (admin SDK) — E-Service pilot.
 * Requires: node scripts/seedEserviceDepreciationPilot.cjs first.
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const STORE = storeArg ? storeArg.split('=')[1] : 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const YEAR = 2026;
const MONTH = 7;
const ASSET_ID = 'FA-TEST-DEP-PILOT-2026';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function monthEnd(y, m) {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function monthlyAmount(asset) {
  const base = round2(Math.max(0, asset.cost - (asset.salvageValue || 0)));
  const rem = round2(Math.max(0, base - (asset.accumulatedDepreciation || 0)));
  const m = round2(base / Math.max(1, asset.usefulLifeMonths));
  return round2(Math.min(m, rem));
}

async function accountByCode(code) {
  const snap = await db.collection(`stores/${STORE}/ledgerAccounts`).get();
  const row = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((a) => String(a.code) === code);
  return row;
}

async function postDepreciationOnce() {
  const sourceKey = `depreciation:${YEAR}-${String(MONTH).padStart(2, '0')}:post`;
  const keyRef = db.doc(`stores/${STORE}/journalEntryKeys/${sourceKey}`);
  const existing = await keyRef.get();
  if (existing.exists) {
    return { entryId: existing.data().entryId, replay: true };
  }

  const assetSnap = await db.doc(`stores/${STORE}/fixedAssets/${ASSET_ID}`).get();
  if (!assetSnap.exists) throw new Error('Pilot asset missing — run seedEserviceDepreciationPilot.cjs');
  const asset = assetSnap.data();
  const amount = monthlyAmount(asset);
  if (amount <= 0) throw new Error('No depreciation amount');

  const exp = await accountByCode('710');
  const accum = await accountByCode('156');
  if (!exp || !accum) throw new Error('COA 710/156 missing');

  for (const acct of [exp, accum]) {
    if (!acct.isActive) {
      await db.doc(`stores/${STORE}/ledgerAccounts/${acct.id}`).set({ isActive: true, updatedAt: new Date().toISOString() }, { merge: true });
    }
  }

  const entryId = `JE-DEP-TEST-${Date.now()}`;
  const postDate = monthEnd(YEAR, MONTH);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists) return;

    tx.set(db.doc(`stores/${STORE}/journalEntries/${entryId}`), {
      storeId: STORE,
      date: postDate,
      memo: `Monthly depreciation ${YEAR}-${String(MONTH).padStart(2, '0')}`,
      status: 'posted',
      sourceType: 'depreciation',
      sourceKey,
      sourceId: `${YEAR}-${String(MONTH).padStart(2, '0')}`,
      event: 'post',
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    });
    tx.set(db.doc(`stores/${STORE}/journalLines/${entryId}-d`), {
      storeId: STORE,
      entryId,
      accountId: exp.id,
      accountCode: '710',
      accountName: exp.name || '710',
      currency: 'USD',
      debit: amount,
      credit: 0,
      lineOrder: 0,
    });
    tx.set(db.doc(`stores/${STORE}/journalLines/${entryId}-c`), {
      storeId: STORE,
      entryId,
      accountId: accum.id,
      accountCode: '156',
      accountName: accum.name || '156',
      currency: 'USD',
      debit: 0,
      credit: amount,
      lineOrder: 1,
    });
    tx.set(keyRef, { storeId: STORE, sourceKey, entryId, createdAt: now, updatedAt: now });
  });

  const newAccum = round2((asset.accumulatedDepreciation || 0) + amount);
  await db.doc(`stores/${STORE}/fixedAssets/${ASSET_ID}`).set(
    {
      accumulatedDepreciation: newAccum,
      status: newAccum >= round2(asset.cost - (asset.salvageValue || 0)) ? 'fully_depreciated' : 'active',
      updatedAt: now,
    },
    { merge: true },
  );

  return { entryId, replay: false, amount };
}

(async () => {
  console.log('\nDepreciation proof —', STORE, `${YEAR}-${MONTH}\n`);
  const first = await postDepreciationOnce();
  console.log('First post:', first);
  const second = await postDepreciationOnce();
  console.log('Second post (expect replay):', second);

  const sourceKey = `depreciation:${YEAR}-${String(MONTH).padStart(2, '0')}:post`;
  const entries = await db.collection(`stores/${STORE}/journalEntries`).where('sourceKey', '==', sourceKey).get();
  console.log('JE count for sourceKey:', entries.size, entries.size === 1 ? '✓' : '✗');

  const entryId = first.entryId || second.entryId;
  const lines = await db.collection(`stores/${STORE}/journalLines`).where('entryId', '==', entryId).get();
  let dr710 = 0;
  let cr156 = 0;
  lines.docs.forEach((d) => {
    const x = d.data();
    if (x.accountCode === '710') dr710 = round2(x.debit || 0);
    if (x.accountCode === '156') cr156 = round2(x.credit || 0);
  });
  console.log('Dr 710:', dr710, 'Cr 156:', cr156, dr710 === 100 && cr156 === 100 ? '✓' : '(check amounts)');
  console.log('Idempotent replay on 2nd call:', second.replay ? '✓' : '✗');
})();
