/**
 * List Firebase email sign-ins with main account package/subscription and sub-accounts.
 * Usage: node scripts/auditEmailAccounts.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

try {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'),
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
} catch (err) {
  console.error('Failed to init Firebase Admin:', err.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

function fmtDate(value) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value.toDate?.() ?? new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function activeModules(modules) {
  if (!modules || typeof modules !== 'object') return [];
  return Object.entries(modules)
    .filter(([, on]) => on === true)
    .map(([id]) => id)
    .sort();
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users.filter((u) => u.email);
}

async function run() {
  const [authUsers, usersSnap, sellersSnap, storesSnap, subSnap] = await Promise.all([
    listAllAuthUsers(),
    db.collection('users').get(),
    db.collection('sellers').get(),
    db.collection('storeProfiles').get(),
    db.collection('subAccounts').get(),
  ]);

  const usersById = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
  const sellersById = new Map(sellersSnap.docs.map((d) => [d.id, d.data()]));
  const storesById = new Map(storesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  const subAccounts = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const subsByStore = new Map();
  for (const sub of subAccounts) {
    const list = subsByStore.get(sub.storeId) || [];
    list.push(sub);
    subsByStore.set(sub.storeId, list);
  }

  const mainAccounts = [];
  const subAccountRows = [];
  const otherAccounts = [];

  for (const authUser of authUsers.sort((a, b) => (a.email || '').localeCompare(b.email || ''))) {
    const uid = authUser.uid;
    const email = authUser.email;
    const userDoc = usersById.get(uid) || {};
    const sellerDoc = sellersById.get(uid) || {};
    const storeId = userDoc.storeId || sellerDoc.storeId || uid;
    const store = storesById.get(storeId) || storesById.get(uid) || null;
    const accountLabel = sellerDoc.accountLabel || store?.accountLabel || '';
    const packageLabel = store?.accountPackageLabel || '';
    const role = userDoc.role || sellerDoc.role || (sellerDoc.isSeller ? 'admin' : 'user');

    const providers = (authUser.providerData || []).map((p) => p.providerId).join(', ') || '—';
    const created = fmtDate(authUser.metadata?.creationTime);
    const lastSignIn = fmtDate(authUser.metadata?.lastSignInTime);

    if (role === 'sub_account' || userDoc.subAccountId) {
      const subId = userDoc.subAccountId;
      const subDoc = subAccounts.find((s) => s.id === subId) || {};
      subAccountRows.push({
        email,
        uid,
        storeId: subDoc.storeId || storeId,
        storeName: storesById.get(subDoc.storeId || storeId)?.storeName || storesById.get(subDoc.storeId || storeId)?.name || '—',
        role: subDoc.role || userDoc.subAccountRole || '—',
        status: subDoc.status || '—',
        name: subDoc.name || userDoc.name || authUser.displayName || '—',
        created,
        lastSignIn,
        providers,
      });
      continue;
    }

    const isMain =
      role === 'admin' ||
      sellerDoc.isSeller === true ||
      sellerDoc.role === 'admin' ||
      store?.ownerId === uid;

    if (isMain) {
      const tier = store?.subscriptionTier || '—';
      const status = store?.subscriptionStatus || '—';
      const plan = store?.subscriptionPlan || '—';
      const endsAt = fmtDate(store?.subscriptionEndsAt);
      const trialEnds = fmtDate(store?.trialEndsAt || store?.trial_end_date);
      const legacyEnds = fmtDate(store?.legacyExpiresAt);
      const modules = activeModules(store?.enabledModules);

      mainAccounts.push({
        email,
        uid,
        storeId,
        storeName: store?.storeName || store?.name || '—',
        role: accountLabel === 'builder' ? 'builder' : 'admin (main)',
        accountLabel: accountLabel || '—',
        packageLabel: packageLabel || '—',
        tier,
        status,
        plan,
        subscriptionEndsAt: endsAt,
        trialEndsAt: trialEnds,
        legacyExpiresAt: legacyEnds,
        modules: modules.length ? modules.join(', ') : '—',
        created,
        lastSignIn,
        providers,
      });
    } else {
      otherAccounts.push({
        email,
        uid,
        role,
        storeId: storeId || '—',
        created,
        lastSignIn,
        providers,
      });
    }
  }

  console.log('\n=== MAIN ACCOUNTS (admin / store owner) ===\n');
  if (!mainAccounts.length) console.log('None found.');
  for (const row of mainAccounts) {
    console.log(`${row.email}`);
    console.log(`  Store: ${row.storeName} (${row.storeId})`);
    console.log(`  Label: ${row.accountLabel} | Package: ${row.packageLabel || row.tier}`);
    console.log(`  Package: tier=${row.tier} | status=${row.status} | plan=${row.plan}`);
    console.log(`  Dates: subscriptionEnds=${row.subscriptionEndsAt} | trialEnds=${row.trialEndsAt} | legacyEnds=${row.legacyExpiresAt}`);
    console.log(`  Modules: ${row.modules}`);
    console.log(`  Auth: created=${row.created} | lastSignIn=${row.lastSignIn} | providers=${row.providers}`);
    const subs = subsByStore.get(row.storeId) || [];
    if (subs.length) {
      console.log(`  Sub-accounts (${subs.length}):`);
      for (const sub of subs.sort((a, b) => (a.email || '').localeCompare(b.email || ''))) {
        console.log(`    - ${sub.email} | role=${sub.role} | status=${sub.status} | name=${sub.name || '—'}`);
      }
    } else {
      console.log('  Sub-accounts: none');
    }
    console.log('');
  }

  console.log('\n=== SUB-ACCOUNT LOGINS ===\n');
  if (!subAccountRows.length) console.log('None found.');
  for (const row of subAccountRows) {
    console.log(`${row.email} | parent store: ${row.storeName} (${row.storeId}) | role=${row.role} | status=${row.status} | name=${row.name}`);
  }

  console.log('\n=== OTHER EMAIL USERS (buyers / non-admin) ===\n');
  if (!otherAccounts.length) console.log('None found.');
  for (const row of otherAccounts) {
    console.log(`${row.email} | role=${row.role} | storeId=${row.storeId} | lastSignIn=${row.lastSignIn}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Auth emails: ${authUsers.length}`);
  console.log(`Main accounts: ${mainAccounts.length}`);
  console.log(`Sub-account logins: ${subAccountRows.length}`);
  console.log(`Other users: ${otherAccounts.length}`);
  console.log(`Sub-account docs (all stores): ${subAccounts.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
