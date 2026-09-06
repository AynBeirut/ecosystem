/**
 * Jihan (sub_seller) must read assigned visit routes.
 * Run: firebase emulators:exec --only firestore "node scripts/testCrmVisitRouteRules.cjs"
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'rules-test-crm-routes';
const STORE = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const JIHAN = '3q8PZgnDzjXvcvGAv8YJUtbvbv92';
const SUB = 'pB5UbUYw06JHLRTnRftA';
const OWNER = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

const rules = readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8');

async function main() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`storeProfiles/${STORE}`).set({
      addOns: ['salesCrm'],
      addOnsMeta: { salesCrm: true },
      enabledModules: { crm: true },
      ownerId: OWNER,
    });
    await db.doc(`users/${JIHAN}`).set({
      email: 'j.sayegh@nip-lb.com',
      role: 'sub_account',
      subAccountId: SUB,
      subAccountRole: 'sales',
      storeId: STORE,
    });
    await db.doc(`subAccounts/${SUB}`).set({
      storeId: STORE,
      role: 'sales',
      status: 'active',
      email: 'j.sayegh@nip-lb.com',
    });
    await db.doc('crmVisitRoutes/r1').set({
      storeId: STORE,
      title: 'Test',
      assignedRepId: `sub:${SUB}`,
      assignedUserId: JIHAN,
      visitDate: '2026-09-03',
      status: 'active',
      stops: [],
      createdBy: OWNER,
      repeatRule: 'weekly',
    });
    await db.doc('crmVisitRoutes/r2').set({
      storeId: STORE,
      title: 'Test5',
      assignedRepId: `sub:${SUB}`,
      assignedUserId: JIHAN,
      visitDate: '2026-09-04',
      status: 'active',
      stops: [],
      createdBy: JIHAN,
      repeatRule: 'none',
    });
  });

  const jdb = env.authenticatedContext(JIHAN).firestore();

  await assertSucceeds(jdb.doc('crmVisitRoutes/r1').get());
  await assertSucceeds(jdb.doc('crmVisitRoutes/r2').get());
  await assertSucceeds(
    jdb.collection('crmVisitRoutes').where('storeId', '==', STORE).where('assignedRepId', 'in', [`sub:${SUB}`, `user:${JIHAN}`]).get(),
  );
  await assertSucceeds(
    jdb.collection('crmVisitRoutes').where('storeId', '==', STORE).where('assignedUserId', '==', JIHAN).get(),
  );

  console.log('OK — Jihan can read assigned visit routes (emulator)');
  await env.cleanup();
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
