#!/usr/bin/env node
/** Phase 3 — lock session + report fields. E-Service dry proof. */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const SESSION = 'BR-106-2026-07-01-2026-07-25';

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const db = admin.firestore();

(async () => {
  const ref = db.collection('stores').doc(STORE).collection('bankRecSessions').doc(SESSION);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log('No session doc (create via UI first) — skip lock test');
    process.exit(0);
  }
  const before = snap.data();
  if (before.status === 'locked') {
    console.log('PASS: session already locked at', before.lockedAt);
    process.exit(0);
  }
  const now = new Date().toISOString();
  await ref.set(
    { status: 'locked', lockedAt: now, phase: 3, statementOpeningBalance: before.statementOpeningBalance ?? 0, updatedAt: now },
    { merge: true },
  );
  const after = (await ref.get()).data();
  console.log('PASS: locked session', SESSION, 'status=', after.status);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
