#!/usr/bin/env node
/**
 * Little Hands ledger cleanup (2026-09-05):
 * 1. Void posted session/test vouchers + mark TEST_NOT_CLIENT_DATA
 * 2. Fix RV-2026-01130 (5110/7010 → cash + walk-in client PCG)
 * 3. Remap posted order revenue lines from bulk 401 → client PCG subaccounts
 *
 *   node scripts/fixLittleHandsLedger2026-09-05.cjs --dry-run
 *   node scripts/fixLittleHandsLedger2026-09-05.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const WALK_IN_PARTY_ID = '__grabio_walk_in__';
const BULK_REVENUE_CODE = '401';
const BULK_REVENUE_ID = 'acct-4000';
const WALK_IN_CLIENT_CODE = '70101000001';
const WALK_IN_ACCOUNT_ID = `acct-${WALK_IN_CLIENT_CODE}`;
const CASH_ACCOUNT_ID = 'acct-1000';
const CASH_CODE = '102';
const CHEQUE_ACCOUNT_ID = 'acct-5110';
const PCG_SALES_TEMPLATE_ID = 'acct-7010';

const CREATED_BY = 'fix-littlehands-ledger-2026-09-05';

/** Posted test vouchers — void (exclude from TB). */
const VOID_VOUCHER_NUMBERS = [
  'JV-2026-00002',
  'JV-2026-00007',
  'JV-2026-00008',
  'JV-2026-00009',
  'JV-2026-00010',
  'PV-2026-00003',
  'PV-2026-00004',
  'RV-2026-01275',
];

/** Already-reversed test originals — mark only. */
const MARK_TEST_VOUCHER_NUMBERS = [
  'JV-2026-00001',
  'JV-2026-00003',
  'JV-2026-00004',
  'JV-2026-00005',
  'JV-2026-00006',
  'PV-2026-00001',
  'PV-2026-00002',
  'RV-2026-01272',
];

const TEST_MARK = {
  dataClassification: 'TEST_NOT_CLIENT_DATA',
  isTestData: true,
};

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) {
    console.error('❌ serviceAccountKey.json not found');
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

async function commitBatches(db, writes) {
  const chunk = 400;
  for (let i = 0; i < writes.length; i += chunk) {
    const batch = db.batch();
    for (const fn of writes.slice(i, i + chunk)) fn(batch);
    await batch.commit();
  }
}

function isTestMemo(entry) {
  const hay = [entry.memo, entry.voucherNumber, entry.createdBy, JSON.stringify(entry.voucherMeta || {})]
    .join(' ')
    .toLowerCase();
  return (
    /\btest\b/.test(hay) ||
    /session test/.test(hay) ||
    /test voucher cleanup/.test(hay) ||
    /verifylittlehandsjv/.test(hay) ||
    entry.createdBy === 'session-test-jv-cleanup-2026-09-04' ||
    entry.createdBy === 'cursor-test-voucher-cleanup-2026-08-31' ||
    entry.createdBy === 'verifyLittleHandsJvLivePost-2026-09-04'
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = initDb();
  const ts = new Date().toISOString();

  const [entriesSnap, linesSnap, accountsSnap, ordersSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
    db.collection('orders').where('storeId', '==', STORE_ID).get(),
  ]);

  const entries = entriesSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const lines = linesSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const orderClientById = new Map();
  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    const clientId = String(data.clientId || data.customerId || '').trim();
    if (clientId) orderClientById.set(doc.id, clientId);
  }

  const partyAccountByPartyId = new Map();
  for (const account of accounts) {
    if (!account.partyId || account.isActive === false) continue;
    if (account.partyType === 'client' || account.partyType === 'supplier') {
      partyAccountByPartyId.set(`${account.partyType}:${account.partyId}`, account);
    }
  }

  const walkInAccount = accounts.find((a) => a.id === WALK_IN_ACCOUNT_ID) || partyAccountByPartyId.get(`client:${WALK_IN_PARTY_ID}`);
  if (!walkInAccount) {
    console.error('❌ Walk-in PCG account not found — run reconcilePartyPcgSequential.cjs first');
    process.exit(1);
  }

  const entryById = new Map(entries.map((e) => [e.id, e]));
  const postedEntryIds = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));

  const report = {
    generatedAt: ts,
    storeId: STORE_ID,
    mode: apply ? 'apply' : 'dry-run',
    voided: [],
    markedTest: [],
    inv001Fix: null,
    revenueRemap: { lineCount: 0, toWalkIn: 0, toNamedClient: 0, skipped: 0, samples: [] },
  };

  const writes = [];

  // --- 1. Void posted test vouchers ---
  for (const voucherNumber of VOID_VOUCHER_NUMBERS) {
    const entry = entries.find((e) => e.voucherNumber === voucherNumber);
    if (!entry) {
      report.voided.push({ voucherNumber, action: 'not_found' });
      continue;
    }
    if (entry.status !== 'posted') {
      report.voided.push({ voucherNumber, action: 'skip_status', status: entry.status });
      writes.push((batch) =>
        batch.set(entry.ref, { ...TEST_MARK, updatedAt: ts }, { merge: true }),
      );
      continue;
    }
    report.voided.push({ voucherNumber, action: 'void', entryId: entry.id });
    if (apply) {
      writes.push((batch) =>
        batch.set(
          entry.ref,
          {
            status: 'voided',
            voidedAt: ts,
            voidedBy: CREATED_BY,
            voidReason: 'Session/test voucher — not client data',
            ...TEST_MARK,
            updatedAt: ts,
          },
          { merge: true },
        ),
      );
    }
  }

  // --- Mark reversed test originals ---
  for (const voucherNumber of MARK_TEST_VOUCHER_NUMBERS) {
    const entry = entries.find((e) => e.voucherNumber === voucherNumber);
    if (!entry) continue;
    report.markedTest.push({ voucherNumber, entryId: entry.id, status: entry.status });
    if (apply) {
      writes.push((batch) => batch.set(entry.ref, { ...TEST_MARK, updatedAt: ts }, { merge: true }));
    }
  }

  // Catch any other test entries by memo/createdBy
  for (const entry of entries) {
    if (!isTestMemo(entry)) continue;
    if (report.markedTest.some((r) => r.entryId === entry.id)) continue;
    if (report.voided.some((r) => r.entryId === entry.id)) continue;
    report.markedTest.push({ voucherNumber: entry.voucherNumber, entryId: entry.id, status: entry.status, auto: true });
    if (apply && entry.status === 'posted' && !VOID_VOUCHER_NUMBERS.includes(entry.voucherNumber)) {
      writes.push((batch) =>
        batch.set(
          entry.ref,
          {
            status: 'voided',
            voidedAt: ts,
            voidedBy: CREATED_BY,
            voidReason: 'Auto-detected test voucher',
            ...TEST_MARK,
            updatedAt: ts,
          },
          { merge: true },
        ),
      );
    } else if (apply) {
      writes.push((batch) => batch.set(entry.ref, { ...TEST_MARK, updatedAt: ts }, { merge: true }));
    }
  }

  // --- 2. Fix RV-2026-01130 ---
  const inv001 = entries.find((e) => e.voucherNumber === 'RV-2026-01130');
  if (inv001 && inv001.status === 'posted') {
    const invLines = lines.filter((l) => l.entryId === inv001.id);
    const patchLines = [];
    for (const line of invLines) {
      if (line.accountId === CHEQUE_ACCOUNT_ID && Number(line.debit) === 7.11) {
        patchLines.push({
          lineId: line.id,
          from: { accountId: line.accountId, accountCode: line.accountCode },
          to: { accountId: CASH_ACCOUNT_ID, accountCode: CASH_CODE },
        });
      }
      if (line.accountId === PCG_SALES_TEMPLATE_ID && Number(line.credit) === 7.11) {
        patchLines.push({
          lineId: line.id,
          from: { accountId: line.accountId, accountCode: line.accountCode },
          to: { accountId: walkInAccount.id, accountCode: walkInAccount.code },
        });
      }
    }
    report.inv001Fix = { entryId: inv001.id, patchLines };
    if (apply && patchLines.length) {
      for (const patch of patchLines) {
        const line = lines.find((l) => l.id === patch.lineId);
        writes.push((batch) =>
          batch.update(line.ref, {
            accountId: patch.to.accountId,
            accountCode: patch.to.accountCode,
            description: line.description || 'Order sale (PCG remap)',
            updatedAt: ts,
          }),
        );
      }
      writes.push((batch) =>
        batch.set(
          inv001.ref,
          {
            memo: 'Order INV-001 (PCG cash + walk-in sales)',
            correctedAt: ts,
            correctedBy: CREATED_BY,
            updatedAt: ts,
          },
          { merge: true },
        ),
      );
    }
  }

  // --- 3. Remap bulk 401 revenue lines ---
  const revenueLines = lines.filter((l) => l.accountId === BULK_REVENUE_ID && postedEntryIds.has(l.entryId));
  for (const line of revenueLines) {
    const entry = entryById.get(line.entryId);
    if (!entry || entry.isTestData || entry.dataClassification === 'TEST_NOT_CLIENT_DATA') {
      report.revenueRemap.skipped += 1;
      continue;
    }
    if (isTestMemo(entry)) {
      report.revenueRemap.skipped += 1;
      continue;
    }

    let targetAccount = walkInAccount;
    const orderId = entry.sourceType === 'order' ? String(entry.sourceId || '').trim() : '';
    const clientId = orderId ? orderClientById.get(orderId) : '';
    if (clientId) {
      const named = partyAccountByPartyId.get(`client:${clientId}`);
      if (named) {
        targetAccount = named;
        report.revenueRemap.toNamedClient += 1;
      } else {
        report.revenueRemap.toWalkIn += 1;
      }
    } else {
      report.revenueRemap.toWalkIn += 1;
    }

    if (targetAccount.id === line.accountId) {
      report.revenueRemap.skipped += 1;
      continue;
    }

    report.revenueRemap.lineCount += 1;
    if (report.revenueRemap.samples.length < 8) {
      report.revenueRemap.samples.push({
        voucher: entry.voucherNumber,
        amount: Number(line.credit) || Number(line.debit) || 0,
        toCode: targetAccount.code,
      });
    }

    if (apply) {
      writes.push((batch) =>
        batch.update(line.ref, {
          accountId: targetAccount.id,
          accountCode: targetAccount.code,
          updatedAt: ts,
        }),
      );
    }
  }

  const outPath = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-ledger-fix-${ts.slice(0, 10)}.json`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'} · store ${STORE_ID}`);
  console.log(`Void targets: ${report.voided.filter((r) => r.action === 'void').length}`);
  console.log(`Mark test: ${report.markedTest.length}`);
  console.log(`INV-001 line patches: ${report.inv001Fix?.patchLines?.length || 0}`);
  console.log(
    `401 → PCG remap: ${report.revenueRemap.lineCount} lines (walk-in ${report.revenueRemap.toWalkIn}, named ${report.revenueRemap.toNamedClient}, skipped ${report.revenueRemap.skipped})`,
  );
  console.log(`Report: ${outPath}`);

  if (!apply) {
    console.log('\nDry run — pass --apply to write.');
    return;
  }

  if (writes.length) {
    await commitBatches(db, writes);
    console.log(`✅ Applied ${writes.length} Firestore writes.`);
  } else {
    console.log('Nothing to apply.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
