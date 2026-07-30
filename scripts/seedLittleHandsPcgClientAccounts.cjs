#!/usr/bin/env node
/**
 * Bulk-import Little Hands client PCG codes ONLY (never Nipco / E-Moove).
 *
 *   node scripts/seedLittleHandsPcgClientAccounts.cjs --dry-run
 *   node scripts/seedLittleHandsPcgClientAccounts.cjs --apply
 *   node scripts/seedLittleHandsPcgClientAccounts.cjs --apply --file imports/littlehands-pcg-client-accounts.csv
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const LITTLE_HANDS_STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const NIPCO_STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const DEFAULT_CSV = path.join(process.cwd(), 'imports/littlehands-pcg-client-accounts.template.csv');

const GRABIO_TO_PCG = {
  102: '5300', 103: '5110', 105: '5121', 106: '5121', 110: '4111',
  120: '3110', 121: '3550', 123: '3310', 201: '4011', 220: '4427',
  301: '1013', 303: '1250', 401: '7010', 501: '6111', 601: '6311',
  610: '6263.1', 612: '6263.4', 799: '6269.9',
};

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const fileIdx = process.argv.indexOf('--file');
  const file = fileIdx >= 0 ? process.argv[fileIdx + 1] : DEFAULT_CSV;
  return { apply, file: path.resolve(file) };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const start = lines[0]?.toLowerCase().includes('clientcode') ? 1 : 0;
  const rows = [];
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].startsWith('#')) continue;
    const p = parseCsvLine(lines[i]);
    const clientCode = (p[0] || '').trim();
    const grabioOperationalCode = (p[4] || p[1] || '').trim();
    if (!clientCode || !grabioOperationalCode) continue;
    if (!/^[\d.]{4,11}$/.test(clientCode)) {
      throw new Error(`Invalid client code on line ${i + 1}: ${clientCode}`);
    }
    const currencyRaw = (p[3] || 'LL').trim().toUpperCase();
    rows.push({
      clientCode,
      name: (p[1] || '').trim() || undefined,
      nameAr: (p[2] || '').trim() || undefined,
      currency: currencyRaw === 'USD' ? 'USD' : 'LL',
      grabioOperationalCode,
      parentPcgCode: (p[5] || '').trim() || GRABIO_TO_PCG[grabioOperationalCode] || undefined,
    });
  }
  return rows;
}

async function main() {
  const { apply, file } = parseArgs();
  if (!fs.existsSync(file)) {
    console.error('Missing CSV:', file);
    console.error('Fill ClientCode column in imports/littlehands-pcg-client-accounts.template.csv');
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) {
    console.error('No importable rows (ClientCode + GrabioCode required). Fill the CSV first.');
    process.exit(1);
  }

  console.log(`Store: Little Hands only (${LITTLE_HANDS_STORE_ID})`);
  console.log(`File: ${file}`);
  console.log(`Rows: ${rows.length}`);
  rows.forEach((r) => console.log(`  Grabio ${r.grabioOperationalCode} → ${r.clientCode}`));

  if (!apply) {
    console.log('\nDry run — pass --apply to write to Firestore.');
    return;
  }

  const sa = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  const col = db.collection('stores').doc(LITTLE_HANDS_STORE_ID).collection('pcgClientAccounts');
  const existing = await col.get();
  const batch = db.batch();
  const ts = new Date().toISOString();

  existing.docs.forEach((d) => batch.delete(d.ref));
  for (const row of rows) {
    const ref = col.doc();
    batch.set(ref, {
      storeId: LITTLE_HANDS_STORE_ID,
      clientCode: row.clientCode,
      grabioOperationalCode: row.grabioOperationalCode,
      parentPcgCode: row.parentPcgCode || null,
      name: row.name || null,
      nameAr: row.nameAr || null,
      currency: row.currency,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  await batch.commit();
  console.log(`\n✅ Imported ${rows.length} client account(s) for Little Hands.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
