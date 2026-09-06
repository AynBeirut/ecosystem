#!/usr/bin/env node
/**
 * Little Hands — create 428 personnel subaccounts (Grabio parent 142) from salary history.
 *
 *   node scripts/backfillLittleHandsEmployeeSubaccounts.cjs --dry-run
 *   node scripts/backfillLittleHandsEmployeeSubaccounts.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const PARENT_GRABIO = '142';
const PARENT_PCG = '4281';
const SUFFIX_DIGITS = 4;

const COMPONENT_LABEL = {
  pay: 'Pay',
  transport: 'Transport',
  commission: 'Commission',
  bonus: 'Bonus',
  cnss: 'CNSS',
  other: 'Other',
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

function employeePartyKey(staffId, component) {
  return `${String(staffId || '').trim()}:${component}`;
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
  const used = new Set(usedCodes.map((c) => String(c || '').trim()).filter(Boolean));
  for (let n = 1_000_001; n <= 9_999_999; n += 1) {
    const code = `${parent}${n}`;
    if (code.length > 11) break;
    if (!used.has(code)) return code;
  }
  throw new Error(`No available client code under ${parentPcgCode}`);
}

function nextSibling(parent, usedCodes) {
  const used = new Set(usedCodes.map((c) => String(c || '').trim()).filter(Boolean));
  const max = 10 ** SUFFIX_DIGITS - 1;
  let start = 1;
  for (const code of used) {
    if (!code.startsWith(parent) || code.length !== parent.length + SUFFIX_DIGITS) continue;
    const n = Number.parseInt(code.slice(parent.length), 10);
    if (Number.isFinite(n) && n >= start) start = n + 1;
  }
  for (let i = start; i <= max; i += 1) {
    const next = `${parent}${String(i).padStart(SUFFIX_DIGITS, '0')}`;
    if (!used.has(next)) return next;
  }
  throw new Error(`No free code under ${parent}`);
}

function ledgerDocId(code) {
  return `acct-${code}`;
}

function collectStaffFromSalaries(salaryDocs) {
  const staff = new Map();
  for (const doc of salaryDocs) {
    const row = doc.data();
    const staffId = String(row.staffId || '').trim();
    if (!staffId) continue;
    const name = String(row.staffName || '').trim() || 'Employee';
    const cur = staff.get(staffId) || {
      staffId,
      staffName: name,
      components: new Set(['pay']),
    };
    cur.staffName = name || cur.staffName;
    if (Number(row.transportAmount) > 0) cur.components.add('transport');
    if (Number(row.commissionAmount) > 0) cur.components.add('commission');
    if (Number(row.bonusAmount) > 0) cur.components.add('bonus');
    if (Number(row.cnssAmount) > 0) cur.components.add('cnss');
    staff.set(staffId, cur);
  }
  return [...staff.values()].map((row) => ({
    ...row,
    components: [...row.components].sort(),
  }));
}

async function main() {
  const { apply } = parseArgs();
  const db = initDb();
  const ts = new Date().toISOString();

  const [profileSnap, ledgerSnap, pcgSnap, salarySnap] = await Promise.all([
    db.collection('storeProfiles').doc(STORE_ID).get(),
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE_ID).collection('pcgClientAccounts').get(),
    db.collection('salaryPayments').where('storeId', '==', STORE_ID).get(),
  ]);

  const mode = profileSnap.data()?.accountingMode === 'lebanese' ? 'lebanese' : 'international';
  const ledgerRows = ledgerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const pcgRows = pcgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const usedCodes = [
    ...ledgerRows.map((r) => String(r.code || '').trim()),
    ...pcgRows.map((r) => String(r.clientCode || '').trim()),
  ];

  const staffRows = collectStaffFromSalaries(salarySnap.docs);
  const created = [];
  const skipped = [];

  for (const staff of staffRows.sort((a, b) => a.staffId.localeCompare(b.staffId, undefined, { numeric: true }))) {
    for (const component of staff.components) {
      const partyId = employeePartyKey(staff.staffId, component);
      const existing = ledgerRows.find(
        (row) => row.partyType === 'employee' && row.partyId === partyId && row.isActive !== false,
      );
      if (existing) {
        skipped.push({
          staffId: staff.staffId,
          staffName: staff.staffName,
          component,
          code: existing.code,
          name: existing.name,
        });
        continue;
      }

      const code =
        mode === 'lebanese'
          ? proposeClientPcgCode(PARENT_PCG, usedCodes)
          : nextSibling(PARENT_GRABIO, usedCodes);
      usedCodes.push(code);
      const label = COMPONENT_LABEL[component] || component;
      const name = `${staff.staffName} — ${label}`;
      const accountId = ledgerDocId(code);
      const body = {
        storeId: STORE_ID,
        code,
        name,
        type: 'asset',
        normalBalance: 'debit',
        parentCode: PARENT_GRABIO,
        isSystem: false,
        isActive: true,
        openingBalance: 0,
        isPcgChart: false,
        grabioOperationalCode: PARENT_GRABIO,
        partyId,
        partyType: 'employee',
        createdAt: ts,
        updatedAt: ts,
      };
      if (mode === 'lebanese') {
        body.pcgKind = 'D';
        body.currency = 'LL';
      }

      const plan = {
        staffId: staff.staffId,
        staffName: staff.staffName,
        component,
        code,
        name,
        parentGrabio: PARENT_GRABIO,
        parentPcg: PARENT_PCG,
        partyId,
      };
      created.push(plan);

      if (apply) {
        await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').doc(accountId).set(body, { merge: true });
        ledgerRows.push({ id: accountId, ...body });
        if (mode === 'lebanese') {
          await db.collection('stores').doc(STORE_ID).collection('pcgClientAccounts').add({
            storeId: STORE_ID,
            clientCode: code,
            grabioOperationalCode: PARENT_GRABIO,
            parentPcgCode: PARENT_PCG,
            name,
            currency: 'LL',
            partyId,
            partyType: 'employee',
            createdAt: ts,
            updatedAt: ts,
          });
        }
      }
    }
  }

  const report = {
    storeId: STORE_ID,
    mode: apply ? 'apply' : 'dry-run',
    accountingMode: mode,
    staffCount: staffRows.length,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
    generatedAt: ts,
  };

  const outDir = path.join(__dirname, '..', 'reporting', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `littlehands-employee-subaccounts-backfill-${ts.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\n=== Little Hands employee subaccounts (${apply ? 'APPLY' : 'DRY RUN'}) ===`);
  console.log(`Staff: ${staffRows.length} | Create: ${created.length} | Skip: ${skipped.length}`);
  console.log(`Report: ${outFile}`);
  if (created.length) {
    console.log('\nCreated:');
    for (const row of created) {
      console.log(`  ${row.code}  ${row.name}  (staff ${row.staffId}, ${row.component})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
