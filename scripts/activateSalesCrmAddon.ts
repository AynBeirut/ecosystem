/**
 * Enable Sales CRM add-on on storeProfiles for given owner emails.
 * Usage: npx tsx scripts/activateSalesCrmAddon.ts
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const EMAILS = [
  'y.malek@nip-lb.com',
  'anwar.abouhassan@gmail.com',
  'mooveelectro@gmail.com',
];

const SALES_CRM_KEY = 'salesCrm';

try {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'),
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
} catch {
  console.error('❌ Failed to initialize Firebase Admin (serviceAccountKey.json)');
  process.exit(1);
}

const db = admin.firestore();

function existingAddOnList(data: FirebaseFirestore.DocumentData | undefined): string[] {
  if (Array.isArray(data?.addOns)) {
    return (data.addOns as string[]).filter((v) => typeof v === 'string');
  }
  const meta = data?.addOnsMeta as Record<string, unknown> | undefined;
  if (meta && typeof meta === 'object') {
    return Object.entries(meta)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }
  const legacy = data?.addOns as Record<string, unknown> | undefined;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    return Object.entries(legacy)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }
  return [];
}

function existingAddOnMeta(data: FirebaseFirestore.DocumentData | undefined): Record<string, unknown> {
  const meta = data?.addOnsMeta;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return { ...(meta as Record<string, unknown>) };
  }
  const fromList = existingAddOnList(data);
  const out: Record<string, unknown> = {};
  for (const key of fromList) out[key] = true;
  return out;
}

async function resolveStoreDocId(email: string): Promise<{ storeId: string; storeName?: string } | null> {
  let uid: string;
  try {
    const user = await admin.auth().getUserByEmail(email);
    uid = user.uid;
  } catch {
    console.log(`   ❌ Not found in Firebase Auth: ${email}`);
    return null;
  }

  const direct = await db.collection('storeProfiles').doc(uid).get();
  if (direct.exists) {
    return { storeId: uid, storeName: direct.data()?.storeName as string | undefined };
  }

  const all = await db.collection('storeProfiles').get();
  for (const doc of all.docs) {
    const data = doc.data();
    if (data.email === email || data.ownerEmail === email) {
      return { storeId: doc.id, storeName: data.storeName as string | undefined };
    }
  }

  console.log(`   ❌ No storeProfile for ${email} (auth uid ${uid})`);
  return null;
}

async function activateSalesCrm(email: string) {
  console.log(`\n📧 ${email}`);
  const resolved = await resolveStoreDocId(email);
  if (!resolved) return { email, ok: false };

  const { storeId, storeName } = resolved;
  const ref = db.collection('storeProfiles').doc(storeId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`   ❌ storeProfiles/${storeId} missing`);
    return { email, ok: false };
  }

  const data = snap.data()!;
  const addOns = [...new Set([...existingAddOnList(data), SALES_CRM_KEY])];
  const addOnsMeta = { ...existingAddOnMeta(data), [SALES_CRM_KEY]: true };
  const crmSettings = {
    noContactAlertDays:
      (data.crmSettings as { noContactAlertDays?: number } | undefined)?.noContactAlertDays ?? 7,
  };

  const already =
    addOns.includes(SALES_CRM_KEY) &&
    (data.addOnsMeta as Record<string, unknown> | undefined)?.[SALES_CRM_KEY] === true;

  if (already) {
    console.log(`   ✓ Already active — ${storeName || storeId}`);
    return { email, ok: true, storeId, skipped: true };
  }

  await ref.update({
    addOns,
    addOnsMeta,
    crmSettings,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`   ✅ Sales CRM enabled — ${storeName || storeId} (${storeId})`);
  return { email, ok: true, storeId };
}

async function main() {
  console.log('\n🔧 Activating Sales CRM add-on...\n');
  const results = [];
  for (const email of EMAILS) {
    results.push(await activateSalesCrm(email));
  }

  console.log('\n--- Summary ---');
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.email}`);
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
