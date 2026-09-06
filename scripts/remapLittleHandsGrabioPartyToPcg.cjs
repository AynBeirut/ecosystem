#!/usr/bin/env node
/**
 * Little Hands — remap legacy Grabio party suffix codes (1420001, 4010001, 5010002)
 * to Lebanese PCG working numbers under 4281 / 7010 / 6111.
 *
 *   node scripts/remapLittleHandsGrabioPartyToPcg.cjs --dry-run
 *   node scripts/remapLittleHandsGrabioPartyToPcg.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';

const GRABIO_TO_PCG = {
  142: '4281',
  401: '7010',
  501: '6111',
};

function parseArgs() {
  return { apply: process.argv.includes('--apply') };
}

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) {
    console.error('Missing serviceAccountKey.json');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))),
      projectId: 'market-flow-7b074',
    });
  }
  return admin.firestore();
}

function isGrabioPartySuffixCode(code, parentGrabio) {
  const raw = String(code || '').trim();
  const parent = String(parentGrabio || '').trim();
  if (!raw || !parent) return false;
  if (!raw.startsWith(parent)) return false;
  const suffix = raw.slice(parent.length);
  return suffix.length >= 2 && /^\d+$/.test(suffix);
}

function proposeClientPcgCode(parentPcgCode, usedCodes) {
  const parent = String(parentPcgCode || '').trim();
  if (!parent) throw new Error('parentPcgCode required');
  for (let n = 1_000_001; n <= 9_999_999; n += 1) {
    const code = `${parent}${n}`;
    if (code.length > 11) break;
    if (!usedCodes.has(code)) return code;
  }
  throw new Error(`No available client code under ${parentPcgCode}`);
}

function ledgerDocId(code) {
  return `acct-${code}`;
}

async function commitBatches(db, writes) {
  const chunk = 400;
  for (let i = 0; i < writes.length; i += chunk) {
    const batch = db.batch();
    for (const fn of writes.slice(i, i + chunk)) fn(batch);
    await batch.commit();
  }
}

async function main() {
  const { apply } = parseArgs();
  const db = initDb();
  const ts = new Date().toISOString();

  const [profileSnap, ledgerSnap, pcgSnap, linesSnap] = await Promise.all([
    db.collection('storeProfiles').doc(STORE_ID).get(),
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE_ID).collection('pcgClientAccounts').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
  ]);

  const mode = profileSnap.data()?.accountingMode === 'lebanese' ? 'lebanese' : 'international';
  if (mode !== 'lebanese') {
    console.error('Store is not in lebanese accounting mode — aborting.');
    process.exit(1);
  }

  const ledgerRows = ledgerSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const pcgRows = pcgSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const usedCodes = new Set([
    ...ledgerRows.map((r) => String(r.code || '').trim()),
    ...pcgRows.map((r) => String(r.clientCode || '').trim()),
  ]);

  const remaps = [];
  const candidates = ledgerRows
    .filter((row) => row.partyType && row.partyId && row.isActive !== false)
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));

  for (const row of candidates) {
    const parentGrabio = String(row.grabioOperationalCode || row.parentCode || '').trim();
    if (!isGrabioPartySuffixCode(row.code, parentGrabio)) continue;
    const parentPcg = GRABIO_TO_PCG[parentGrabio] || GRABIO_TO_PCG[String(row.parentCode || '').trim()];
    if (!parentPcg) {
      console.warn(`Skip ${row.code}: unknown parent ${parentGrabio}`);
      continue;
    }
    const newCode = proposeClientPcgCode(parentPcg, usedCodes);
    usedCodes.add(newCode);
    remaps.push({
      oldCode: row.code,
      newCode,
      oldAccountId: row.id,
      newAccountId: ledgerDocId(newCode),
      partyType: row.partyType,
      partyId: row.partyId,
      name: row.name,
      parentGrabio,
      parentPcg,
    });
  }

  const codeMap = new Map(remaps.map((r) => [r.oldCode, r.newCode]));
  const idMap = new Map(remaps.map((r) => [r.oldAccountId, r.newAccountId]));
  const lineUpdates = linesSnap.docs.filter((doc) => {
    const data = doc.data();
    return codeMap.has(String(data.accountCode || '')) || idMap.has(String(data.accountId || ''));
  });

  const outDir = path.join(__dirname, '..', 'reporting', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `littlehands-grabio-to-pcg-remap-${ts.slice(0, 10)}.json`);
  const report = {
    storeId: STORE_ID,
    mode: apply ? 'apply' : 'dry-run',
    remapCount: remaps.length,
    lineUpdateCount: lineUpdates.length,
    remaps,
    generatedAt: ts,
  };
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'} · store ${STORE_ID}`);
  console.log(`Party remaps: ${remaps.length} · journal lines: ${lineUpdates.length}`);
  remaps.slice(0, 20).forEach((r) => {
    console.log(`  ${r.partyType} ${r.name}: ${r.oldCode} → ${r.newCode}`);
  });
  if (remaps.length > 20) console.log(`  … ${remaps.length - 20} more`);
  console.log(`Report: ${outFile}`);

  if (!apply || remaps.length === 0) return;

  const writes = [];

  for (const remap of remaps) {
    const oldRow = ledgerRows.find((r) => r.id === remap.oldAccountId);
    if (!oldRow) continue;
    const { ref: _ref, id: _id, ...body } = oldRow;
    const newBody = {
      ...body,
      code: remap.newCode,
      updatedAt: ts,
    };
    writes.push((batch) => {
      batch.set(db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').doc(remap.newAccountId), newBody);
      if (remap.oldAccountId !== remap.newAccountId) {
        batch.delete(oldRow.ref);
      }
    });
  }

  for (const row of pcgRows) {
    const oldCode = String(row.clientCode || '').trim();
    const newCode = codeMap.get(oldCode);
    if (!newCode) continue;
    writes.push((batch) => {
      batch.update(row.ref, { clientCode: newCode, updatedAt: ts });
    });
  }

  for (const doc of lineUpdates) {
    const data = doc.data();
    const patch = { updatedAt: ts };
    const oldCode = String(data.accountCode || '');
    const oldId = String(data.accountId || '');
    if (codeMap.has(oldCode)) patch.accountCode = codeMap.get(oldCode);
    if (idMap.has(oldId)) patch.accountId = idMap.get(oldId);
    writes.push((batch) => batch.update(doc.ref, patch));
  }

  await commitBatches(db, writes);
  console.log('✅ Remap applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
