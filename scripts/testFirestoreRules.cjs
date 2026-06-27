/**
 * Firestore security rules checklist — runs against local emulator only.
 *
 * Usage:
 *   firebase emulators:exec --only firestore "node scripts/testFirestoreRules.cjs"
 *
 * Seeds account shapes copied from production UIDs (no prod writes).
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'rules-test-grabio';

// Production UIDs (read-only audit 2026-06-24)
const INDIGO = '6UOoq0Tn8xhGUqBk5o0JMMKsgNN2';
const YMALEK = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const MOOVE = '1HfsBr45XYM5SkaaazWegmyqGpA3';
const SUB_SALES_YMALEK = 'pB5UbUYw06JHLRTnRftA';
const SUB_ADMIN_INDIGO = 'subAdminIndigo001';
const CRM_REP_UID = 'crmRepMobile001';
const CRM_REP_ID = 'crmRepIndigo001';
const MODULAR_CRM_STORE = 'modularCrmStore001';
const STRANGER = 'crossTenantStranger001';
const DEMO_STORE = 'demoStorePhase1001';
const EXPIRED_STORE = 'expiredStorePhase1001';
const BUILDER_UID = 'builderPhase1001';
const LEGACY_STORE = 'legacyStorePhase1001';
const GRACE_PERIOD_STORE = 'gracePeriodStore001';

const now = () => new Date().toISOString();

async function seed(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    const batch = [
      // Legacy CRM store (indigo shape)
      db.doc(`storeProfiles/${INDIGO}`).set({
        email: 'test@indigo.com',
        storeName: 'Indigo Legacy',
        pricingVersion: 'legacy-v1',
        addOns: ['salesCrm'],
        addOnsMeta: { salesCrm: true },
      }),
      db.doc(`users/${INDIGO}`).set({ email: 'test@indigo.com', role: 'admin' }),

      // y.malek store
      db.doc(`storeProfiles/${YMALEK}`).set({
        email: 'y.malek@example.com',
        storeName: 'YMalek Store',
        pricingVersion: 'legacy-v1',
        addOns: ['salesCrm'],
        addOnsMeta: { salesCrm: true },
      }),
      db.doc(`users/${YMALEK}`).set({ email: 'y.malek@example.com', role: 'admin' }),

      // moove modular — CRM module OFF
      db.doc(`storeProfiles/${MOOVE}`).set({
        email: 'moove@example.com',
        storeName: 'Moove Modular',
        pricingVersion: 'modular-v2',
        enabledModules: { crm: false, invoicing: true },
        addOns: [],
      }),
      db.doc(`users/${MOOVE}`).set({ email: 'moove@example.com', role: 'admin' }),

      // Modular store with enabledModules.crm
      db.doc(`storeProfiles/${MODULAR_CRM_STORE}`).set({
        email: 'modular-crm@test.local',
        storeName: 'Modular CRM Test',
        pricingVersion: 'modular-v2',
        enabledModules: { crm: true, invoicing: true },
        addOns: [],
      }),
      db.doc(`users/${MODULAR_CRM_STORE}`).set({
        email: 'modular-crm@test.local',
        role: 'admin',
      }),

      // Active sales sub-account on y.malek (prod UID)
      db.doc(`subAccounts/${SUB_SALES_YMALEK}`).set({
        storeId: YMALEK,
        role: 'sales',
        status: 'active',
        email: 'sales@ymalek.test',
      }),
      db.doc(`users/${SUB_SALES_YMALEK}`).set({
        email: 'sales@ymalek.test',
        role: 'sub_account',
      }),

      // Sub-admin on indigo
      db.doc(`subAccounts/${SUB_ADMIN_INDIGO}`).set({
        storeId: INDIGO,
        role: 'admin',
        status: 'active',
        email: 'subadmin@indigo.test',
      }),
      db.doc(`users/${SUB_ADMIN_INDIGO}`).set({
        email: 'subadmin@indigo.test',
        role: 'sub_account',
      }),

      // CRM rep (no prod crmReps docs — synthetic shape from crmReps API)
      db.doc(`crmReps/${CRM_REP_ID}`).set({
        storeId: INDIGO,
        name: 'Field Rep One',
        email: 'rep@indigo.test',
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
        createdBy: INDIGO,
      }),
      db.doc(`users/${CRM_REP_UID}`).set({
        email: 'rep@indigo.test',
        role: 'crm_rep',
        crmRepId: CRM_REP_ID,
      }),

      // Customers
      db.doc('customers/cust-indigo-1').set({
        storeId: INDIGO,
        name: 'Indigo Client',
        assignedRepId: CRM_REP_ID,
      }),
      db.doc('customers/cust-ymalek-1').set({
        storeId: YMALEK,
        name: 'YMalek Client',
      }),

      // CRM activity on indigo
      db.doc('crmActivities/act-indigo-1').set({
        storeId: INDIGO,
        customerId: 'cust-indigo-1',
        repId: CRM_REP_ID,
        repName: 'Field Rep One',
        type: 'visit',
        loggedAt: now(),
        result: 'interested',
        createdBy: CRM_REP_UID,
        source: 'mobile',
        createdAt: now(),
      }),

      // Finance seed under stores/{storeId}
      db.doc(`stores/${INDIGO}/financeEstimates/est-1`).set({
        title: 'Estimate QA',
        amount: 100,
      }),
      db.doc(`stores/${INDIGO}/financeReceipts/rcpt-1`).set({
        title: 'Receipt QA',
        amount: 50,
      }),

      db.doc(`users/${STRANGER}`).set({ email: 'stranger@test.local', role: 'admin' }),

      // Phase 1 builder / commerce guard seeds
      db.doc(`storeProfiles/${DEMO_STORE}`).set({
        name: 'Demo Store',
        isDemo: true,
        subscriptionStatus: 'active',
        ownerId: BUILDER_UID,
      }),
      db.doc(`storeProfiles/${EXPIRED_STORE}`).set({
        name: 'Expired Store',
        subscriptionStatus: 'expired',
        ownerId: EXPIRED_STORE,
      }),
      db.doc(`storeProfiles/${LEGACY_STORE}`).set({
        name: 'Legacy Real Store',
        ownerId: LEGACY_STORE,
      }),
      db.doc(`storeProfiles/${GRACE_PERIOD_STORE}`).set({
        name: 'Grace Period Store',
        subscriptionStatus: 'grace_period',
        ownerId: GRACE_PERIOD_STORE,
      }),
      db.doc(`users/${BUILDER_UID}`).set({ email: 'builder@test.local', role: 'builder' }),
      db.doc(`builders/${BUILDER_UID}`).set({
        businessType: 'designer',
        demoSlotCount: 0,
        createdAt: now(),
      }),
      db.doc(`builders/${BUILDER_UID}/demoStores/demo1`).set({
        name: 'Builder Demo 1',
        status: 'draft',
        createdAt: now(),
      }),

      db.doc('recipes/recipe-indigo-1').set({
        storeId: INDIGO,
        name: 'Indigo Recipe',
        ingredients: [{ rawMaterialId: 'rm-indigo-1', quantity: 2 }],
      }),
      db.doc('rawMaterials/rm-indigo-1').set({
        storeId: INDIGO,
        name: 'Indigo RM',
        currentStock: 20,
      }),
    ];

    await Promise.all(batch);
  });
}

async function runCase(id, label, fn) {
  const started = Date.now();
  try {
    const evidence = await fn();
    return {
      id,
      label,
      pass: true,
      ms: Date.now() - started,
      evidence,
    };
  } catch (err) {
    return {
      id,
      label,
      pass: false,
      ms: Date.now() - started,
      evidence: err && err.message ? err.message : String(err),
    };
  }
}

async function main() {
  const rulesPath = join(process.cwd(), 'firestore.rules');
  const rules = readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  await seed(testEnv);

  const cases = [];

  // 1 — sub-account sales create customer
  cases.push(
    await runCase(1, 'sub-account sales create customer', async () => {
      const db = testEnv.authenticatedContext(SUB_SALES_YMALEK).firestore();
      const ref = db.collection('customers').doc('cust-sales-create-1');
      await assertSucceeds(
        ref.set({
          storeId: YMALEK,
          name: 'Created By Sales Sub-Account',
          createdAt: now(),
        })
      );
      // Verify write landed via rules-disabled context
      let seededName = '';
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const snap = await ctx.firestore().doc('customers/cust-sales-create-1').get();
        seededName = snap.data()?.name || '';
      });
      return `set customers/cust-sales-create-1 as uid=${SUB_SALES_YMALEK} storeId=${YMALEK} → write OK; seeded verify name="${seededName}"`;
    })
  );

  // 1b — sub-account sales read own-store customer
  cases.push(
    await runCase('1b', 'sub-account sales read own-store customer', async () => {
      const db = testEnv.authenticatedContext(SUB_SALES_YMALEK).firestore();
      const snap = await assertSucceeds(db.doc('customers/cust-ymalek-1').get());
      if (!snap.exists) throw new Error('expected cust-ymalek-1');
      return `get customers/cust-ymalek-1 as sales uid=${SUB_SALES_YMALEK} store=${YMALEK} → name="${snap.data().name}"`;
    })
  );

  // 1c — sub-account sales update own-store customer
  cases.push(
    await runCase('1c', 'sub-account sales update own-store customer', async () => {
      const db = testEnv.authenticatedContext(SUB_SALES_YMALEK).firestore();
      await assertSucceeds(
        db.doc('customers/cust-ymalek-1').update({
          notes: 'Updated by sales sub-account',
          updatedAt: now(),
        })
      );
      let notes = '';
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const snap = await ctx.firestore().doc('customers/cust-ymalek-1').get();
        notes = snap.data()?.notes || '';
      });
      return `update customers/cust-ymalek-1 as sales uid=${SUB_SALES_YMALEK} → notes="${notes}"`;
    })
  );

  // 2 — CRM rep mobile read assigned customer
  cases.push(
    await runCase(2, 'CRM rep mobile read assigned customer', async () => {
      const db = testEnv.authenticatedContext(CRM_REP_UID).firestore();
      const snap = await assertSucceeds(db.doc('customers/cust-indigo-1').get());
      if (!snap.exists) throw new Error('expected cust-indigo-1 to exist');
      return `get customers/cust-indigo-1 as crm_rep uid=${CRM_REP_UID} repId=${CRM_REP_ID} → name="${snap.data().name}" assignedRepId=${snap.data().assignedRepId}`;
    })
  );

  // 3 — cross-tenant block (indigo owner creates customer on ymalek store)
  cases.push(
    await runCase(3, 'cross-tenant block', async () => {
      const db = testEnv.authenticatedContext(INDIGO).firestore();
      await assertFails(
        db.collection('customers').doc('cust-cross-tenant').set({
          storeId: YMALEK,
          name: 'Cross Tenant Attempt',
        })
      );
      const readDb = testEnv.authenticatedContext(INDIGO).firestore();
      await assertFails(readDb.doc('customers/cust-ymalek-1').get());
      return `create+read blocked for indigo uid=${INDIGO} on ymalek customer cust-ymalek-1 → PERMISSION_DENIED (expected)`;
    })
  );

  // 4 — finance write (store owner)
  cases.push(
    await runCase(4, 'finance write', async () => {
      const db = testEnv.authenticatedContext(INDIGO).firestore();
      const ref = db.doc(`stores/${INDIGO}/financeEstimates/est-write-1`);
      await assertSucceeds(ref.set({ title: 'New Estimate', amount: 250, createdAt: now() }));
      const snap = await ref.get();
      return `set stores/${INDIGO}/financeEstimates/est-write-1 as owner → amount=${snap.data().amount}`;
    })
  );

  // 5 — finance not public (unauthenticated read denied)
  cases.push(
    await runCase(5, 'finance-not-public', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc(`stores/${INDIGO}/financeEstimates/est-1`).get());
      const strangerDb = testEnv.authenticatedContext(STRANGER).firestore();
      await assertFails(strangerDb.doc(`stores/${INDIGO}/financeEstimates/est-1`).get());
      return `unauthenticated + stranger uid=${STRANGER} get stores/${INDIGO}/financeEstimates/est-1 → PERMISSION_DENIED (expected)`;
    })
  );

  // 6 — modular CRM create (enabledModules.crm)
  cases.push(
    await runCase(6, 'modular CRM create', async () => {
      const db = testEnv.authenticatedContext(MODULAR_CRM_STORE).firestore();
      const ref = db.collection('crmReps').doc('modular-rep-1');
      await assertSucceeds(
        ref.set({
          storeId: MODULAR_CRM_STORE,
          name: 'Modular Rep',
          email: 'modrep@test.local',
          status: 'active',
          createdAt: now(),
          updatedAt: now(),
          createdBy: MODULAR_CRM_STORE,
        })
      );
      const snap = await ref.get();
      return `set crmReps/modular-rep-1 on modular store enabledModules.crm=true → name="${snap.data().name}"`;
    })
  );

  // 7 — sub-admin CRM activities read
  cases.push(
    await runCase(7, 'sub-admin CRM read', async () => {
      const db = testEnv.authenticatedContext(SUB_ADMIN_INDIGO).firestore();
      const snap = await assertSucceeds(db.doc('crmActivities/act-indigo-1').get());
      if (!snap.exists) throw new Error('expected act-indigo-1');
      return `get crmActivities/act-indigo-1 as sub-admin uid=${SUB_ADMIN_INDIGO} store=${INDIGO} → type=${snap.data().type}`;
    })
  );

  // 8a/8b — storefront: unauthenticated recipes/rawMaterials denied (Option B)
  cases.push(
    await runCase('8a', 'recipes public read denied', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc('recipes/recipe-indigo-1').get());
      return 'unauthenticated get recipes/recipe-indigo-1 → PERMISSION_DENIED (expected)';
    })
  );

  cases.push(
    await runCase('8b', 'rawMaterials public read denied', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc('rawMaterials/rm-indigo-1').get());
      return 'unauthenticated get rawMaterials/rm-indigo-1 → PERMISSION_DENIED (expected)';
    })
  );

  // Bonus negative: moove modular CRM OFF cannot create rep
  cases.push(
    await runCase('6b', 'modular CRM OFF blocks rep create (moove)', async () => {
      const db = testEnv.authenticatedContext(MOOVE).firestore();
      await assertFails(
        db.collection('crmReps').doc('moove-rep-fail').set({
          storeId: MOOVE,
          name: 'Should Fail',
          email: 'fail@test.local',
          status: 'active',
          createdAt: now(),
          updatedAt: now(),
          createdBy: MOOVE,
        })
      );
      return `moove uid=${MOOVE} enabledModules.crm=false → crmReps create PERMISSION_DENIED (expected)`;
    })
  );

  // --- Phase 1 builder / isRealStore ---
  cases.push(
    await runCase('P1-1', 'stranger cannot create product', async () => {
      const db = testEnv.authenticatedContext(STRANGER).firestore();
      await assertFails(
        db.collection('products').doc('prod-stranger-1').set({
          storeId: INDIGO,
          name: 'Blocked Product',
          price: 10,
        })
      );
      return 'stranger product create on indigo → PERMISSION_DENIED (expected)';
    })
  );

  cases.push(
    await runCase('P1-2', 'store owner creates product on legacy real store', async () => {
      const db = testEnv.authenticatedContext(LEGACY_STORE).firestore();
      await assertSucceeds(
        db.collection('products').doc('prod-legacy-1').set({
          storeId: LEGACY_STORE,
          name: 'Legacy Product',
          price: 12,
        })
      );
      return `owner uid=${LEGACY_STORE} product create on legacy store (no subscriptionStatus) → OK`;
    })
  );

  cases.push(
    await runCase('P1-3', 'demo store profile blocks product create', async () => {
      const db = testEnv.authenticatedContext(BUILDER_UID).firestore();
      await assertFails(
        db.collection('products').doc('prod-demo-fail').set({
          storeId: DEMO_STORE,
          name: 'Demo Product',
          price: 5,
        })
      );
      return `product create with storeId=${DEMO_STORE} isDemo=true → PERMISSION_DENIED (expected)`;
    })
  );

  cases.push(
    await runCase('P1-4', 'expired store blocks order create', async () => {
      const db = testEnv.authenticatedContext(EXPIRED_STORE).firestore();
      await assertFails(
        db.collection('orders').doc('order-expired-1').set({
          storeId: EXPIRED_STORE,
          total: 50,
          status: 'pending',
        })
      );
      return `order create on expired store → PERMISSION_DENIED (expected)`;
    })
  );

  cases.push(
    await runCase('P1-5', 'builder writes isolated demo product', async () => {
      const db = testEnv.authenticatedContext(BUILDER_UID).firestore();
      await assertSucceeds(
        db.doc(`builders/${BUILDER_UID}/demoStores/demo1/products/p1`).set({
          name: 'Demo Catalog Item',
          price: 9,
        })
      );
      return `builder uid=${BUILDER_UID} demo product write → OK`;
    })
  );

  cases.push(
    await runCase('P1-6', 'stranger cannot write builder demo', async () => {
      const db = testEnv.authenticatedContext(STRANGER).firestore();
      await assertFails(
        db.doc(`builders/${BUILDER_UID}/demoStores/demo1/products/p2`).set({ name: 'Hack' })
      );
      return 'stranger builder demo write → PERMISSION_DENIED (expected)';
    })
  );

  cases.push(
    await runCase('P1-7', 'stranger cannot create subAccount on foreign store', async () => {
      const db = testEnv.authenticatedContext(STRANGER).firestore();
      await assertFails(
        db.collection('subAccounts').doc('sub-stranger-hack').set({
          storeId: INDIGO,
          role: 'sales',
          status: 'active',
          email: 'hack@test.local',
        })
      );
      return 'stranger subAccounts create on indigo → PERMISSION_DENIED (expected)';
    })
  );

  cases.push(
    await runCase('P1-8', 'indigo owner creates subAccount on real store', async () => {
      const db = testEnv.authenticatedContext(INDIGO).firestore();
      await assertSucceeds(
        db.collection('subAccounts').doc('sub-indigo-new').set({
          storeId: INDIGO,
          role: 'sales',
          status: 'active',
          email: 'newsales@indigo.test',
        })
      );
      return `owner uid=${INDIGO} subAccounts create → OK`;
    })
  );

  cases.push(
    await runCase('P1-9', 'grace_period store can create product', async () => {
      const db = testEnv.authenticatedContext(GRACE_PERIOD_STORE).firestore();
      await assertSucceeds(
        db.collection('products').doc('prod-grace-1').set({
          storeId: GRACE_PERIOD_STORE,
          name: 'Grace Period Product',
          price: 3,
        })
      );
      return `owner uid=${GRACE_PERIOD_STORE} subscriptionStatus=grace_period product create → OK`;
    })
  );

  await testEnv.cleanup();

  console.log('\n=== Firestore Rules Checklist (emulator) ===');
  console.log(`Rules file: ${rulesPath}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Seed: prod UIDs indigo=${INDIGO} ymalek=${YMALEK} subSales=${SUB_SALES_YMALEK}\n`);

  let failed = 0;
  for (const c of cases) {
    const status = c.pass ? 'PASS' : 'FAIL';
    if (!c.pass) failed += 1;
    console.log(`[${status}] #${c.id} ${c.label} (${c.ms}ms)`);
    console.log(`       ${c.evidence}\n`);
  }

  const core = cases.filter(
    (c) =>
      typeof c.id === 'number' ||
      c.id === '1b' ||
      c.id === '1c' ||
      c.id === '8a' ||
      c.id === '8b' ||
      (typeof c.id === 'string' && c.id.startsWith('P1-')),
  );
  const coreFailed = core.filter((c) => !c.pass).length;
  console.log(`Core checklist: ${core.length - coreFailed}/${core.length} passed`);
  console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED — do not deploy firestore.rules to prod`);

  process.exit(coreFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
