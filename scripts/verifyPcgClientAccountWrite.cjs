#!/usr/bin/env node
/** Client-rules smoke: E-Moove owner can write stores/{storeId}/pcgClientAccounts */
const { readFileSync } = require('fs');
const { join } = require('path');
const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithCustomToken } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDocs, collection, deleteDoc } = require('firebase/firestore');

const storeId = process.env.STORE_ID || 'EZfuoNQFTJVU4cubNuckpp4K7zw2';
const uid = process.env.UID || storeId;

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const firebaseConfig = {
  apiKey: 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U',
  authDomain: 'market-flow-7b074.firebaseapp.com',
  projectId: 'market-flow-7b074',
};

async function main() {
  const token = await admin.auth().createCustomToken(uid, { email: 'mooveelectro@gmail.com' });
  const app = initializeApp(firebaseConfig, 'pcg-write-test');
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithCustomToken(auth, token);
  console.log('Signed in as', auth.currentUser.uid);

  const testId = 'verify-client-write';
  const ref = doc(db, 'stores', storeId, 'pcgClientAccounts', testId);
  const payload = {
    id: testId,
    storeId,
    clientCode: '53001000002',
    grabioOperationalCode: '102',
    parentPcgCode: '5300',
    currency: 'USD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(ref, payload, { merge: true });
    console.log('PASS: setDoc succeeded');
    const snap = await getDocs(collection(db, 'stores', storeId, 'pcgClientAccounts'));
    console.log('pcgClientAccounts count:', snap.size);
    await deleteDoc(ref);
    console.log('Cleaned up test doc');
  } catch (err) {
    console.error('FAIL:', err.code || err.message, err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
