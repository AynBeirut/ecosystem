/**
 * Live prod Firestore rules sanity (client SDK — rules enforced).
 * Usage: node scripts/liveFirestoreRulesSanity.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const { getAuth, signInWithCustomToken } = require('firebase/auth');

const NIP_OWNER = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const RECIPE_ID = '20pI7w78eKsj60rZpjnt';
const FINANCE_DOC = 'rules-sanity-live-2026-06-24';

const firebaseConfig = {
  apiKey: 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U',
  authDomain: 'market-flow-7b074.firebaseapp.com',
  projectId: 'market-flow-7b074',
  storageBucket: 'market-flow-7b074.firebasestorage.app',
  messagingSenderId: '997465465802',
  appId: '1:997465465802:web:3c6789ea41a9458a98e533',
};

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}

function isPermissionDenied(err) {
  const code = err && (err.code || err.message || '');
  return String(code).includes('permission-denied') || String(err).includes('Missing or insufficient permissions');
}

async function seedFinanceDocForReadTest() {
  const ref = admin.firestore().doc(`stores/${NIP_OWNER}/financeEstimates/${FINANCE_DOC}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      title: 'Rules sanity doc — do not use in billing',
      amount: 1,
      createdAt: new Date().toISOString(),
      _rulesSanity: true,
    });
  }
}

async function main() {
  await seedFinanceDocForReadTest();

  const app = initializeApp(firebaseConfig, 'rules-sanity-client');
  const db = getFirestore(app);

  console.log('=== Live Firestore rules sanity (prod) ===\n');

  // 1 — unauthenticated recipes read → DENIED
  let deniedOk = false;
  try {
    await getDoc(doc(db, 'recipes', RECIPE_ID));
    console.log('[FAIL] 8a unauthenticated recipes read — succeeded (should deny)');
  } catch (err) {
    deniedOk = isPermissionDenied(err);
    console.log(
      deniedOk
        ? `[PASS] 8a unauthenticated get recipes/${RECIPE_ID} → permission-denied`
        : `[FAIL] 8a unexpected error: ${err.code || err.message}`,
    );
    if (!deniedOk) console.log(err);
  }

  // 2 — store owner finance estimate read → ALLOWED
  const token = await admin.auth().createCustomToken(NIP_OWNER);
  const auth = getAuth(app);
  await signInWithCustomToken(auth, token);

  let allowedOk = false;
  try {
    const snap = await getDoc(doc(db, 'stores', NIP_OWNER, 'financeEstimates', FINANCE_DOC));
    allowedOk = snap.exists() && snap.data()?.amount === 1;
    console.log(
      allowedOk
        ? `[PASS] owner get stores/${NIP_OWNER}/financeEstimates/${FINANCE_DOC} → exists amount=${snap.data().amount}`
        : `[FAIL] owner read returned unexpected: exists=${snap.exists}`,
    );
  } catch (err) {
    console.log(`[FAIL] owner finance read: ${err.code || err.message}`);
  }

  console.log('\nSummary:', deniedOk && allowedOk ? 'BOTH PASS' : 'FAILED');
  process.exit(deniedOk && allowedOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
