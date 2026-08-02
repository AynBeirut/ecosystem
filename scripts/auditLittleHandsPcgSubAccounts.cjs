#!/usr/bin/env node
/** Audit Little Hands: operational Grabio accounts vs pcgClientAccounts coverage. */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const STORE = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const GRABIO_TO_PCG = require(path.join(repoRoot, 'scripts', 'coaStandardData.cjs')).GRABIO_TO_PCG_CODE || {};

const saPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) });
}
const db = admin.firestore();

function suggestClientCode(parentPcg, grabioCode, used) {
  const base = String(parentPcg || '').replace(/\./g, '');
  let seq = Number(grabioCode) || 1;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = String(seq).padStart(5, '0');
    const candidate = `${base}${suffix}`.slice(0, 11);
    if (/^[\d.]{4,11}$/.test(candidate) && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    seq += 1;
  }
  throw new Error(`Could not suggest code for Grabio ${grabioCode} parent ${parentPcg}`);
}

async function main() {
  const [accountsSnap, pcgSnap, linesSnap, entriesSnap] = await Promise.all([
    db.collection('stores').doc(STORE).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE).collection('pcgClientAccounts').get(),
    db.collection('stores').doc(STORE).collection('journalLines').limit(8000).get(),
    db.collection('stores').doc(STORE).collection('journalEntries').where('status', '==', 'posted').limit(2500).get(),
  ]);

  const posted = new Set(entriesSnap.docs.map((d) => d.id));
  const activityByAccountId = new Map();
  linesSnap.docs.forEach((d) => {
    const l = d.data();
    if (!posted.has(l.entryId)) return;
    const id = l.accountId;
    activityByAccountId.set(id, (activityByAccountId.get(id) || 0) + (Number(l.debit) || 0) + (Number(l.credit) || 0));
  });

  const pcgByGrabio = new Map();
  pcgSnap.docs.forEach((d) => {
    const row = d.data();
    pcgByGrabio.set(String(row.grabioOperationalCode || '').trim(), { id: d.id, ...row });
  });

  const operational = accountsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.isActive !== false && !a.isPcgChart)
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));

  const mappedOperational = operational.filter((a) => GRABIO_TO_PCG[a.code]);
  const withActivity = mappedOperational.filter((a) => (activityByAccountId.get(a.id) || 0) > 0);
  const missingClient = mappedOperational.filter((a) => !pcgByGrabio.has(String(a.code)));
  const missingWithActivity = withActivity.filter((a) => !pcgByGrabio.has(String(a.code)));

  console.log('Little Hands PCG sub-account audit —', STORE);
  console.log('Operational ledger accounts:', operational.length);
  console.log('Mapped to PCG (Grabio→PCG):', mappedOperational.length);
  console.log('With posted activity:', withActivity.length);
  console.log('pcgClientAccounts in Firestore:', pcgSnap.size);
  console.log('Mapped but NO client sub-account:', missingClient.length);
  console.log('Active posting but NO client sub-account:', missingWithActivity.length);

  if (missingClient.length) {
    console.log('\nMissing client sub-accounts (all mapped operational):');
    missingClient.forEach((a) => {
      const parent = GRABIO_TO_PCG[a.code];
      const act = activityByAccountId.get(a.id) || 0;
      console.log(`  Grabio ${a.code} · ${a.name} → PCG ${parent}${act > 0 ? ' · HAS ACTIVITY' : ''}`);
    });
  }

  const usedCodes = new Set(pcgSnap.docs.map((d) => String(d.data().clientCode || '').trim()).filter(Boolean));
  const suggestions = missingClient.map((a) => {
    const parent = GRABIO_TO_PCG[a.code];
    return {
      clientCode: suggestClientCode(parent, a.code, usedCodes),
      name: a.name || '',
      nameAr: a.nameAr || '',
      currency: 'LL',
      grabioOperationalCode: String(a.code),
      parentPcgCode: parent,
    };
  });

  if (suggestions.length) {
    const outPath = path.join(repoRoot, 'imports', 'littlehands-pcg-client-accounts.generated.csv');
    const header = 'ClientCode,Name,ArabicName,Currency,GrabioCode,ParentPcgCode';
    const body = suggestions.map((r) =>
      [r.clientCode, r.name, r.nameAr, r.currency, r.grabioOperationalCode, r.parentPcgCode].join(','),
    );
    fs.writeFileSync(outPath, `${header}\n${body.join('\n')}\n`);
    console.log(`\nWrote ${suggestions.length} suggested row(s) → ${outPath}`);
  }

  const dupParents = new Map();
  pcgSnap.docs.forEach((d) => {
    const row = d.data();
    const key = `${row.parentPcgCode}|${row.grabioOperationalCode}`;
    dupParents.set(key, (dupParents.get(key) || 0) + 1);
  });

  process.exit(missingWithActivity.length ? 1 : 0);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
