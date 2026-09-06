#!/usr/bin/env node
/**
 * Reconcile Little Hands party subaccounts: one PCG working number per client/supplier.
 * Walk-in → 70101000001; named clients → 70101000002+; suppliers → 61111000001+.
 *
 *   node scripts/reconcilePartyPcgSequential.cjs --dry-run
 *   node scripts/reconcilePartyPcgSequential.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { GRABIO_TO_PCG_CODE, proposePartyClientPcgCode, walkInClientPcgCode } = require('./pcgGrabioMap.cjs');

const STORE = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WALK_IN_PARTY_ID = '__grabio_walk_in__';
const apply = process.argv.includes('--apply');
const repoRoot = path.resolve(__dirname, '..');
const saPath = path.join(repoRoot, 'serviceAccountKey.json');

if (!fs.existsSync(saPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) });
}
const db = admin.firestore();

const WALK_IN_RE = /walk[- ]?in|cash\s*customer|anonymous|pos\s*customer|guest|counter\s*sale/i;

function isWalkInCustomer(row) {
  const name = String(row.name || '').trim();
  return WALK_IN_RE.test(name);
}

function ledgerDocId(code) {
  return `acct-${code}`;
}

async function main() {
  const [customersSnap, suppliersSnap, ledgerSnap, pcgSnap] = await Promise.all([
    db.collection('customers').where('storeId', '==', STORE).get(),
    db.collection('suppliers').where('storeId', '==', STORE).get(),
    db.collection('stores').doc(STORE).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE).collection('pcgClientAccounts').get(),
  ]);

  const customers = customersSnap.docs
    .map((d) => ({ id: d.id, name: String(d.data().name || 'Client').trim() || 'Client' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const suppliers = suppliersSnap.docs
    .map((d) => ({ id: d.id, name: String(d.data().name || 'Supplier').trim() || 'Supplier' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const walkInCustomer = customers.find(isWalkInCustomer);
  const namedClients = customers.filter((c) => !isWalkInCustomer(c));

  const clientParentPcg = GRABIO_TO_PCG_CODE['401'];
  const supplierParentPcg = GRABIO_TO_PCG_CODE['501'];

  const usedCodes = new Set();
  const plan = [];

  const walkInCode = walkInClientPcgCode(clientParentPcg);
  usedCodes.add(walkInCode);
  plan.push({
    kind: 'client',
    partyId: WALK_IN_PARTY_ID,
    name: 'Walk-in',
    clientCode: walkInCode,
    grabioOperationalCode: '401',
    parentPcgCode: clientParentPcg,
    source: walkInCustomer ? `customer:${walkInCustomer.id}` : 'synthetic',
  });

  for (const client of namedClients) {
    const clientCode = proposePartyClientPcgCode(clientParentPcg, usedCodes);
    usedCodes.add(clientCode);
    plan.push({
      kind: 'client',
      partyId: client.id,
      name: client.name,
      clientCode,
      grabioOperationalCode: '401',
      parentPcgCode: clientParentPcg,
      source: `customer:${client.id}`,
    });
  }

  for (const supplier of suppliers) {
    const clientCode = proposePartyClientPcgCode(supplierParentPcg, usedCodes);
    usedCodes.add(clientCode);
    plan.push({
      kind: 'supplier',
      partyId: supplier.id,
      name: supplier.name,
      clientCode,
      grabioOperationalCode: '501',
      parentPcgCode: supplierParentPcg,
      source: `supplier:${supplier.id}`,
    });
  }

  const dupCodes = new Map();
  pcgSnap.docs.forEach((d) => {
    const code = String(d.data().clientCode || '').trim();
    if (!code) return;
    dupCodes.set(code, (dupCodes.get(code) || 0) + 1);
  });
  const duplicateClientCodes = [...dupCodes.entries()].filter(([, n]) => n > 1);

  console.log(`Party PCG reconcile — ${STORE} (${apply ? 'APPLY' : 'DRY-RUN'})`);
  console.log(`Clients: 1 walk-in + ${namedClients.length} named → ${plan.filter((p) => p.kind === 'client').length} rows`);
  console.log(`Suppliers: ${suppliers.length} → ${plan.filter((p) => p.kind === 'supplier').length} rows`);
  if (duplicateClientCodes.length) {
    console.log(`\n⚠️  Duplicate clientCodes in Firestore today: ${duplicateClientCodes.length}`);
    duplicateClientCodes.slice(0, 10).forEach(([code, n]) => console.log(`  ${code} × ${n}`));
  }

  console.log('\nPlanned mapping (first 15):');
  plan.slice(0, 15).forEach((row) => {
    console.log(`  ${row.clientCode}  ${row.name}  (${row.kind})`);
  });
  if (plan.length > 15) console.log(`  … ${plan.length - 15} more`);

  const outPath = path.join(repoRoot, 'reporting', 'data', `party-pcg-reconcile-${STORE.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ storeId: STORE, generatedAt: new Date().toISOString(), plan, duplicateClientCodes }, null, 2),
  );
  console.log(`\nWrote plan → ${outPath}`);

  if (!apply) {
    console.log('\nDry run — pass --apply to rewrite pcgClientAccounts + party ledger rows.');
    return;
  }

  const ts = new Date().toISOString();
  const pcgCol = db.collection('stores').doc(STORE).collection('pcgClientAccounts');
  const ledgerCol = db.collection('stores').doc(STORE).collection('ledgerAccounts');

  const batch = db.batch();
  pcgSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  let batch2 = db.batch();
  let ops = 0;
  const commitIfNeeded = async () => {
    if (ops >= 400) {
      await batch2.commit();
      batch2 = db.batch();
      ops = 0;
    }
  };

  for (const row of plan) {
    const pcgRef = pcgCol.doc();
    batch2.set(pcgRef, {
      storeId: STORE,
      clientCode: row.clientCode,
      grabioOperationalCode: row.grabioOperationalCode,
      parentPcgCode: row.parentPcgCode,
      name: row.name,
      currency: 'LL',
      partyId: row.partyId,
      partyType: row.kind,
      createdAt: ts,
      updatedAt: ts,
    });
    ops += 1;

    const ledgerRef = ledgerCol.doc(ledgerDocId(row.clientCode));
    batch2.set(
      ledgerRef,
      {
        code: row.clientCode,
        name: row.name,
        type: row.kind === 'client' ? 'revenue' : 'expense',
        normalBalance: row.kind === 'client' ? 'credit' : 'debit',
        parentCode: row.grabioOperationalCode,
        grabioOperationalCode: row.grabioOperationalCode,
        pcgKind: 'D',
        isPcgChart: false,
        isActive: true,
        currency: 'LL',
        partyId: row.partyId,
        partyType: row.kind,
        openingBalance: 0,
        updatedAt: ts,
      },
      { merge: true },
    );
    ops += 1;
    await commitIfNeeded();
  }
  if (ops) await batch2.commit();

  console.log('\n✅ Applied party PCG mapping.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
