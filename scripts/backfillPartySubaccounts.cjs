#!/usr/bin/env node
/**
 * One-shot: create AR/AP subaccounts for clients/suppliers missing one.
 *
 *   node scripts/backfillPartySubaccounts.cjs --store STORE_ID
 *   node scripts/backfillPartySubaccounts.cjs --store STORE_ID --write
 *
 * Default is dry-run. Run on the AM store only after Anwar confirms.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const write = process.argv.includes('--write');
const storeFlag = process.argv.indexOf('--store');
const storeId = storeFlag >= 0 ? String(process.argv[storeFlag + 1] || '').trim() : '';

if (!storeId) {
  console.error('Usage: node scripts/backfillPartySubaccounts.cjs --store STORE_ID [--write]');
  process.exit(1);
}

function nowIso() {
  return new Date().toISOString();
}

function nextSibling(parent, existing, digits) {
  const used = new Set(existing.map((c) => String(c || '').trim()).filter(Boolean));
  const max = 10 ** digits - 1;
  let start = 1;
  for (const code of used) {
    if (!code.startsWith(parent) || code.length !== parent.length + digits) continue;
    const n = Number.parseInt(code.slice(parent.length), 10);
    if (Number.isFinite(n) && n >= start) start = n + 1;
  }
  for (let i = start; i <= max; i += 1) {
    const next = `${parent}${String(i).padStart(digits, '0')}`;
    if (!used.has(next)) return next;
  }
  throw new Error(`No free sibling under ${parent}`);
}

function ledgerDocId(code) {
  return `acct-${code}`;
}

async function main() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('serviceAccountKey.json not found');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();

  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  const mode = profileSnap.data()?.accountingMode === 'lebanese' ? 'lebanese' : 'international';
  const clientParent = '401';
  const supplierParent = '501';
  const clientGrabio = '401';
  const supplierGrabio = '501';
  const PCG_PARENT = { '401': '7010', '501': '6111' };

  const [customersSnap, suppliersSnap, ledgerSnap, pcgSnap] = await Promise.all([
    db.collection('customers').where('storeId', '==', storeId).get(),
    db.collection('suppliers').where('storeId', '==', storeId).get(),
    db.collection('stores').doc(storeId).collection('ledgerAccounts').get(),
    db.collection('stores').doc(storeId).collection('pcgClientAccounts').get(),
  ]);

  const accounts = ledgerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const pcgRows = pcgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const usedCodes = [
    ...accounts.map((a) => String(a.code || '').trim()),
    ...pcgRows.map((r) => String(r.clientCode || '').trim()),
  ];

  const parties = [
    ...customersSnap.docs.map((d) => ({ kind: 'client', id: d.id, name: String(d.data().name || 'Client') })),
    ...suppliersSnap.docs.map((d) => ({ kind: 'supplier', id: d.id, name: String(d.data().name || 'Supplier') })),
  ];

  const planned = [];
  for (const party of parties) {
    const hasPcg = pcgRows.some((row) => row.partyType === party.kind && row.partyId === party.id);
    const hasLedger = accounts.some((row) => row.partyType === party.kind && row.partyId === party.id);
    if (hasPcg || hasLedger) continue;
    const parent = party.kind === 'client' ? clientParent : supplierParent;
    const grabio = party.kind === 'client' ? clientGrabio : supplierGrabio;
    const code = nextSibling(parent, usedCodes, 4);
    usedCodes.push(code);
    planned.push({ ...party, parent, grabio, code });
  }

  console.log(`Mode: ${write ? 'WRITE' : 'DRY-RUN'} · store ${storeId} · ${mode}`);
  console.log(`Missing subaccounts: ${planned.length}`);
  planned.slice(0, 30).forEach((row) => {
    console.log(`  ${row.kind} ${row.name} → ${row.code} (parent ${row.parent})`);
  });
  if (planned.length > 30) console.log(`  … ${planned.length - 30} more`);
  if (!write || !planned.length) return;

  const ts = nowIso();
  for (const row of planned) {
    const parent = accounts.find((a) => a.code === row.parent);
    const type = row.kind === 'client' ? 'revenue' : 'expense';
    const normalBalance = row.kind === 'client' ? 'credit' : 'debit';
    const accountId = ledgerDocId(row.code);
    const body = {
      storeId,
      code: row.code,
      name: row.name,
      type,
      normalBalance,
      parentCode: row.parent,
      isSystem: false,
      isActive: true,
      openingBalance: 0,
      isPcgChart: false,
      partyId: row.id,
      partyType: row.kind,
      createdAt: ts,
      updatedAt: ts,
    };
    if (mode === 'lebanese') {
      body.pcgKind = 'D';
      body.grabioOperationalCode = row.grabio;
      body.currency = parent?.currency || 'LL';
    } else if (parent?.currency) {
      body.currency = parent.currency;
    }
    await db.collection('stores').doc(storeId).collection('ledgerAccounts').doc(accountId).set(body, { merge: true });

    if (mode === 'lebanese') {
      await db.collection('stores').doc(storeId).collection('pcgClientAccounts').add({
        storeId,
        clientCode: row.code,
        grabioOperationalCode: row.grabio,
        parentPcgCode: PCG_PARENT[row.grabio] || row.parent,
        name: row.name,
        currency: parent?.currency === 'USD' ? 'USD' : 'LL',
        partyId: row.id,
        partyType: row.kind,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }
  console.log(`Wrote ${planned.length} subaccounts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
