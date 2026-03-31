const admin = require('firebase-admin');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function parseArgs(argv) {
  const args = {
    runId: '',
    storeId: '',
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--runId') {
      args.runId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--storeId') {
      args.storeId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--apply') {
      args.apply = true;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.runId || !args.storeId) {
    console.error('Usage: node scripts/cleanupE2ERunData.cjs --runId <RUN_ID> --storeId <STORE_ID> [--apply]');
    process.exit(1);
  }

  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });

  const db = admin.firestore();
  const collections = [
    'orders',
    'productionBatches',
    'finishedGoodsInventory',
    'purchases',
    'recipes',
    'products',
    'rawMaterials',
    'customers',
    'suppliers',
  ];

  const summary = {};
  const targets = [];

  for (const collectionName of collections) {
    const snap = await db
      .collection(collectionName)
      .where('storeId', '==', args.storeId)
      .where('testRunId', '==', args.runId)
      .get();

    summary[collectionName] = snap.size;
    snap.docs.forEach((docSnap) => {
      targets.push({ collectionName, ref: docSnap.ref });
    });
  }

  const total = targets.length;
  const mode = args.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`\n=== E2E CLEANUP ${mode} ===`);
  console.log(`runId: ${args.runId}`);
  console.log(`storeId: ${args.storeId}`);
  console.log('collection counts:', summary);
  console.log(`total docs: ${total}`);

  if (!args.apply) {
    console.log('\nDry-run only. Re-run with --apply to delete.');
    return;
  }

  let batch = db.batch();
  let pending = 0;
  let deleted = 0;

  for (const target of targets) {
    batch.delete(target.ref);
    pending += 1;
    deleted += 1;

    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) {
    await batch.commit();
  }

  const verify = {};
  let remaining = 0;
  for (const collectionName of collections) {
    const snap = await db
      .collection(collectionName)
      .where('storeId', '==', args.storeId)
      .where('testRunId', '==', args.runId)
      .get();
    verify[collectionName] = snap.size;
    remaining += snap.size;
  }

  console.log(`\nDeleted docs: ${deleted}`);
  console.log('post-delete counts:', verify);
  console.log(`remaining docs: ${remaining}`);

  await db.collection('auditLogs').add({
    action: 'cleanup_e2e_run_data',
    storeId: args.storeId,
    runId: args.runId,
    mode: 'apply',
    deleted,
    remaining,
    createdAt: new Date().toISOString(),
    summary,
    verify,
  });

  console.log('\n✅ Cleanup applied and audit log written.');
}

main().catch((error) => {
  console.error('\n❌ Cleanup failed:', error?.message || error);
  process.exit(1);
});
