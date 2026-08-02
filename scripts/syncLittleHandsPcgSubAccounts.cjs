#!/usr/bin/env node
/**
 * Ensure every operational Grabio account has a pcgClientAccount sub-code (Little Hands).
 * Keeps existing client codes; proposes new ones for gaps.
 *
 *   node scripts/syncLittleHandsPcgSubAccounts.cjs --dry-run
 *   node scripts/syncLittleHandsPcgSubAccounts.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { STANDARD_COA } = require('./coaStandardData.cjs');
const { GRABIO_TO_PCG_CODE, proposeClientPcgCode } = require('./pcgGrabioMap.cjs');

const STORE = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
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

async function main() {
  const [ledgerSnap, pcgSnap] = await Promise.all([
    db.collection('stores').doc(STORE).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE).collection('pcgClientAccounts').get(),
  ]);

  const ledgerByCode = new Map();
  ledgerSnap.docs.forEach((d) => {
    const row = d.data();
    if (row.isPcgChart) return;
    ledgerByCode.set(String(row.code || '').trim(), row);
  });

  const existingByGrabio = new Map();
  const usedCodes = new Set();
  pcgSnap.docs.forEach((d) => {
    const row = d.data();
    const grabio = String(row.grabioOperationalCode || '').trim();
    if (grabio) existingByGrabio.set(grabio, { id: d.id, ...row });
    if (row.clientCode) usedCodes.add(String(row.clientCode).trim());
  });

  const merged = [];
  const added = [];
  const kept = [];

  for (const seed of STANDARD_COA) {
    const grabio = String(seed.code).trim();
    const parent = GRABIO_TO_PCG_CODE[grabio];
    if (!parent) continue;

    const ledger = ledgerByCode.get(grabio);
    const existing = existingByGrabio.get(grabio);
    if (existing?.clientCode) {
      kept.push({ grabio, clientCode: existing.clientCode });
      merged.push({
        id: existing.id,
        clientCode: existing.clientCode,
        grabioOperationalCode: grabio,
        parentPcgCode: existing.parentPcgCode || parent,
        name: existing.name || ledger?.name || seed.name,
        nameAr: existing.nameAr || ledger?.nameAr || '',
        currency: existing.currency === 'USD' ? 'USD' : 'LL',
      });
      continue;
    }

    const clientCode = proposeClientPcgCode(parent, usedCodes);
    added.push({ grabio, clientCode, parent });
    merged.push({
      clientCode,
      grabioOperationalCode: grabio,
      parentPcgCode: parent,
      name: ledger?.name || seed.name,
      nameAr: ledger?.nameAr || '',
      currency: 'LL',
    });
  }

  merged.sort((a, b) => a.grabioOperationalCode.localeCompare(b.grabioOperationalCode, undefined, { numeric: true }));

  console.log(`Little Hands PCG sub-account sync — ${STORE}`);
  console.log(`Operational Grabio accounts (standard COA): ${merged.length}`);
  console.log(`Kept existing: ${kept.length}`);
  console.log(`New proposals: ${added.length}`);

  if (added.length) {
    console.log('\nNew sub-accounts:');
    added.forEach((r) => console.log(`  Grabio ${r.grabio} → ${r.clientCode} (PCG ${r.parent})`));
  }

  const outCsv = path.join(repoRoot, 'imports', 'littlehands-pcg-client-accounts.full.csv');
  const header = 'ClientCode,Name,ArabicName,Currency,GrabioCode,ParentPcgCode';
  const csvBody = merged.map((r) =>
    [r.clientCode, r.name || '', r.nameAr || '', r.currency, r.grabioOperationalCode, r.parentPcgCode].join(','),
  );
  fs.writeFileSync(outCsv, `${header}\n${csvBody.join('\n')}\n`);
  console.log(`\nWrote ${merged.length} rows → ${outCsv}`);

  if (!apply) {
    console.log('\nDry run — pass --apply to write pcgClientAccounts to Firestore.');
    return;
  }

  const col = db.collection('stores').doc(STORE).collection('pcgClientAccounts');
  const batch = db.batch();
  const ts = new Date().toISOString();
  pcgSnap.docs.forEach((d) => batch.delete(d.ref));
  for (const row of merged) {
    const ref = row.id ? col.doc(row.id) : col.doc();
    batch.set(ref, {
      storeId: STORE,
      clientCode: row.clientCode,
      grabioOperationalCode: row.grabioOperationalCode,
      parentPcgCode: row.parentPcgCode,
      name: row.name || null,
      nameAr: row.nameAr || null,
      currency: row.currency,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  await batch.commit();
  console.log(`\n✅ Synced ${merged.length} pcgClientAccount(s) for Little Hands.`);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
