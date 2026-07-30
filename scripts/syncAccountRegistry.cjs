#!/usr/bin/env node
/**
 * Sync Grabio account registry labels + cleanup per owner notes.
 *   node scripts/syncAccountRegistry.cjs --dry-run
 *   node scripts/syncAccountRegistry.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const dryRun = !process.argv.includes('--write');
const sa = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();
const auth = admin.auth();

const ROLE_PERMISSIONS = {
  sales: ['view_orders', 'create_orders', 'view_customers', 'manage_customers', 'process_payments'],
  delivery: ['view_orders', 'manage_deliveries', 'view_customers'],
  cashier: ['view_orders', 'create_orders', 'view_customers', 'process_payments'],
  manager: [
    'view_orders', 'create_orders', 'manage_orders', 'view_inventory', 'manage_inventory',
    'view_customers', 'manage_customers', 'view_reports', 'manage_deliveries', 'process_payments',
  ],
};

const STORE_COLLECTIONS = ['products', 'orders', 'customers', 'purchases', 'expenses', 'suppliers', 'rawMaterials', 'posDevices'];

async function deleteStoreScopedDocs(storeId) {
  let count = 0;
  for (const col of STORE_COLLECTIONS) {
    const snap = await db.collection(col).where('storeId', '==', storeId).get();
    for (const doc of snap.docs) {
      if (!dryRun) await doc.ref.delete();
      count += 1;
    }
  }
  const subCols = ['financeEstimates', 'financeInvoices', 'financeReceipts', 'financePurchaseOrders', 'financePaymentOrders', 'ledgerAccounts', 'journalEntries', 'journalLines'];
  for (const sub of subCols) {
    const snap = await db.collection('stores').doc(storeId).collection(sub).get();
    for (const doc of snap.docs) {
      if (!dryRun) await doc.ref.delete();
      count += 1;
    }
  }
  return count;
}

async function removeAccount(email) {
  const user = await auth.getUserByEmail(email);
  const uid = user.uid;
  let deletedDocs = await deleteStoreScopedDocs(uid);
  const refs = [
    db.collection('users').doc(uid),
    db.collection('sellers').doc(uid),
    db.collection('storeProfiles').doc(uid),
  ];
  for (const ref of refs) {
    const snap = await ref.get();
    if (snap.exists) {
      if (!dryRun) await ref.delete();
      deletedDocs += 1;
    }
  }
  if (!dryRun) await auth.deleteUser(uid);
  return { uid, deletedDocs, authDeleted: !dryRun };
}

async function wipeStoreData(storeId, keepAuth = true) {
  let deletedDocs = await deleteStoreScopedDocs(storeId);
  const profileRef = db.collection('storeProfiles').doc(storeId);
  if ((await profileRef.get()).exists) {
    if (!dryRun) await profileRef.delete();
    deletedDocs += 1;
  }
  const sellerRef = db.collection('sellers').doc(storeId);
  if ((await sellerRef.get()).exists) {
    if (!dryRun) {
      await sellerRef.set(
        { isSeller: false, role: 'user', updatedAt: new Date().toISOString(), accountLabel: 'wiped_test' },
        { merge: true },
      );
    }
    deletedDocs += 1;
  }
  return { storeId, deletedDocs, keepAuth };
}

async function mergeSeller(email, patch) {
  const user = await auth.getUserByEmail(email);
  const ref = db.collection('sellers').doc(user.uid);
  if (!dryRun) await ref.set({ ...patch, userId: user.uid, updatedAt: new Date().toISOString() }, { merge: true });
  return user.uid;
}

async function mergeStore(storeId, patch) {
  const ref = db.collection('storeProfiles').doc(storeId);
  if (!dryRun) await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
}

async function linkExistingSubAccount({ email, storeId, role, name }) {
  const user = await auth.getUserByEmail(email);
  const now = new Date().toISOString();
  const subData = {
    storeId,
    email,
    name: name || email.split('@')[0],
    role,
    permissions: ROLE_PERMISSIONS[role],
    status: 'active',
    createdAt: now,
    createdBy: 'syncAccountRegistry',
    updatedAt: now,
  };

  let subId;
  const existing = await db.collection('subAccounts').where('email', '==', email).limit(1).get();
  if (existing.empty) {
    if (dryRun) {
      subId = '(new)';
    } else {
      const docRef = await db.collection('subAccounts').add(subData);
      subId = docRef.id;
    }
  } else {
    subId = existing.docs[0].id;
    if (!dryRun) await existing.docs[0].ref.set(subData, { merge: true });
  }

  if (!dryRun) {
    await db.collection('users').doc(user.uid).set(
      {
        email,
        name: subData.name,
        role: 'sub_account',
        storeId,
        subAccountId: subId,
        updatedAt: now,
      },
      { merge: true },
    );
  }
  return { email, storeId, role, subId };
}

async function run() {
  console.log(`\n=== syncAccountRegistry (${dryRun ? 'DRY-RUN' : 'WRITE'}) ===\n`);

  const removeEmails = ['elma.method@gmail.com', 'elmaseedlebanon@gmail.com'];
  for (const email of removeEmails) {
    const result = await removeAccount(email);
    console.log('REMOVE', email, result);
  }

  const builders = [
    { email: 'indigo.commun@gmail.com', starts: '2025-01-01T00:00:00.000Z', ends: '2026-01-01T00:00:00.000Z' },
    { email: 'janarawwas317@gmail.com', starts: '2025-01-01T00:00:00.000Z', ends: '2026-01-01T00:00:00.000Z' },
  ];
  for (const b of builders) {
    const uid = await mergeSeller(b.email, {
      isSeller: true,
      role: 'admin',
      accountLabel: 'builder',
      builderAccessStartsAt: b.starts,
      builderAccessEndsAt: b.ends,
      enabledModules: { builder: true, ai_builder: true },
    });
    console.log('BUILDER', b.email, uid);
  }

  await mergeStore('xd6pGIer3RUEdL1vMy5OJQunjAO2', {
    storeName: 'lilyshop',
    accountPackageLabel: 'shop_online',
    subscriptionStatus: 'active',
    subscriptionPlan: 'yearly',
    subscriptionEndsAt: '2027-07-10T10:26:46.131Z',
  });
  console.log('PACKAGE lilyshop shop_online');

  await mergeStore('8WgfKtgaE8aAXdqFhIfweEo5WFq2', {
    storeName: 'little hands',
    subscriptionTier: 'starter',
    accountPackageLabel: 'restaurant',
    subscriptionStatus: 'active',
    subscriptionPlan: 'yearly',
    subscriptionStartedAt: '2025-12-01T00:00:00.000Z',
    subscriptionEndsAt: '2027-07-14T07:53:01.832Z',
  });
  console.log('PACKAGE little hands restaurant');

  const maisaUid = await mergeSeller('maisabanna@gmail.com', {
    isSeller: true,
    role: 'admin',
    accountLabel: 'accounting_tester',
  });
  await mergeStore(maisaUid, {
    accountPackageLabel: 'accounting_tester',
    subscriptionTier: 'business',
    subscriptionStatus: 'active',
    subscriptionEndsAt: '2027-07-09T10:10:53.717Z',
  });
  console.log('PACKAGE maisabanna accounting_tester');

  await mergeSeller('mooveelectro@gmail.com', { accountLabel: 'test', isTestAccount: true });
  await mergeStore('EZfuoNQFTJVU4cubNuckpp4K7zw2', { accountLabel: 'test', isTestAccount: true });
  console.log('LABEL moove test account');

  await mergeSeller('anwar.abouhassan@gmail.com', { accountLabel: 'legacy', isLegacyUser: true });
  console.log('LABEL anwar legacy');

  for (const email of ['whiteblackangle@gmail.com', 'mslelyaperry@gmail.com']) {
    await mergeSeller(email, { accountLabel: 'unassigned', isSeller: false, role: 'user' });
    console.log('LABEL random', email);
  }

  const yvonne = await wipeStoreData('vbWshU8vmobg52zBaiZh0W9iI912');
  console.log('WIPE yvonne', yvonne);

  const emoove = await linkExistingSubAccount({
    email: 'info@emoove.co',
    storeId: 'EZfuoNQFTJVU4cubNuckpp4K7zw2',
    role: 'manager',
    name: 'Emoove',
  });
  console.log('SUB emoove -> moove', emoove);

  console.log('\nDone.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
