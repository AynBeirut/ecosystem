#!/usr/bin/env node
/** Pre-audit gate for Little Hands — writes reporting/data/littlehands-pre-audit-{date}.json */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const BULK_401_ID = 'acct-4000';
const DISCOUNT_ACCT_IDS = new Set(['acct-410', 'acct-7090']);
const COUNTED_STATUSES = new Set(['delivered', 'paid', 'completed']);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) });
}
const db = admin.firestore();

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const report = {
    generatedAt: new Date().toISOString(),
    storeId: STORE,
    checks: {},
    pass: true,
  };

  const [profileSnap, coaMetaSnap, ordersSnap, entriesSnap, linesSnap, acctsSnap, pcgSnap] = await Promise.all([
    db.collection('storeProfiles').doc(STORE).get(),
    db.collection('stores').doc(STORE).collection('ledgerMeta').doc('coa').get(),
    db.collection('orders').where('storeId', '==', STORE).get(),
    db.collection('stores').doc(STORE).collection('journalEntries').where('status', '==', 'posted').get(),
    db.collection('stores').doc(STORE).collection('journalLines').get(),
    db.collection('stores').doc(STORE).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE).collection('pcgClientAccounts').get(),
  ]);

  const mode = profileSnap.data()?.accountingMode || coaMetaSnap.data()?.coaMode;
  report.checks.accountingMode = { value: mode, pass: mode === 'lebanese' };
  report.checks.pcgClientAccounts = { count: pcgSnap.size, pass: pcgSnap.size > 0 };

  const acctById = new Map(acctsSnap.docs.map((d) => [d.id, d.data()]));
  const posted = new Set(entriesSnap.docs.map((d) => d.id));

  let debits = 0;
  let credits = 0;
  let bulk401Net = 0;
  let cash102 = 0;
  let revenue7Net = 0;
  let discount7090 = 0;
  let testPosted = 0;

  const entryByOrder = new Map();
  entriesSnap.docs.forEach((d) => {
    const e = d.data();
    if (e.isTestData || e.dataClassification === 'TEST_NOT_CLIENT_DATA') testPosted += 1;
    if (e.sourceType === 'order' && e.event === 'sale-recognized' && e.sourceId) {
      entryByOrder.set(e.sourceId, d.id);
    }
  });

  const linesByEntry = new Map();
  linesSnap.docs.forEach((d) => {
    const l = d.data();
    if (!posted.has(l.entryId)) return;
    debits += Number(l.debit) || 0;
    credits += Number(l.credit) || 0;
    const ac = acctById.get(l.accountId);
    const code = String(ac?.code || '');
    if (l.accountId === BULK_401_ID) bulk401Net += (Number(l.credit) || 0) - (Number(l.debit) || 0);
    if (code === '102') cash102 += (Number(l.debit) || 0) - (Number(l.credit) || 0);
    const head = parseInt(code.slice(0, 4), 10);
    if (Number.isFinite(head) && head >= 7000 && head < 7200) {
      revenue7Net += (Number(l.credit) || 0) - (Number(l.debit) || 0);
    }
    if (DISCOUNT_ACCT_IDS.has(l.accountId) || code === '7090' || code === '410') {
      discount7090 += (Number(l.debit) || 0) - (Number(l.credit) || 0);
    }
    if (!linesByEntry.has(l.entryId)) linesByEntry.set(l.entryId, []);
    linesByEntry.get(l.entryId).push(l);
  });

  const tbBalanced = Math.abs(debits - credits) < 0.02;
  report.checks.trialBalance = {
    postedEntries: entriesSnap.size,
    debits: round2(debits),
    credits: round2(credits),
    pass: tbBalanced,
  };
  report.checks.bulk401 = { netCredit: round2(bulk401Net), pass: Math.abs(bulk401Net) < 0.01 };
  report.checks.testDataInPosted = { count: testPosted, pass: testPosted === 0 };
  report.checks.discountAccount410 = { exists: acctById.has('acct-410'), pass: acctById.has('acct-410') };

  let discountedOrders = 0;
  let discountGlOk = 0;
  const discountGaps = [];
  ordersSnap.docs.forEach((d) => {
    const o = d.data();
    const disc = round2(Number(o.discountAmount ?? o.discount) || 0);
    if (disc <= 0) return;
    const st = String(o.status || '').toLowerCase();
    const paid = String(o.paymentStatus || '').toLowerCase() === 'paid';
    if (!COUNTED_STATUSES.has(st) && !paid) return;
    discountedOrders += 1;
    const entryId = entryByOrder.get(d.id);
    if (!entryId) {
      discountGaps.push({ invoice: o.invoiceNumber, issue: 'no JE' });
      return;
    }
    const lines = linesByEntry.get(entryId) || [];
    const hasDisc = lines.some((l) => DISCOUNT_ACCT_IDS.has(l.accountId) && round2(Number(l.debit) || 0) > 0);
    if (hasDisc) discountGlOk += 1;
    else discountGaps.push({ invoice: o.invoiceNumber, voucher: entriesSnap.docs.find((x) => x.id === entryId)?.data()?.voucherNumber, discount: disc });
  });

  report.checks.salesDiscountGl = {
    discountedOrders,
    withDiscountLine: discountGlOk,
    gaps: discountGaps.length,
    gapSample: discountGaps.slice(0, 5),
    pass: discountGaps.length === 0,
  };

  report.checks.balances = {
    cash102: round2(cash102),
    revenueClass7Net: round2(revenue7Net),
    salesDiscountDebits: round2(discount7090),
  };

  for (const [key, val] of Object.entries(report.checks)) {
    if (val.pass === false) {
      report.pass = false;
      console.error(`❌ FAIL: ${key}`, JSON.stringify(val));
    } else {
      console.log(`✅ ${key}`);
    }
  }

  const outPath = path.join(__dirname, '..', 'reporting', 'data', `littlehands-pre-audit-${date}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('Report:', outPath);

  if (!report.pass) process.exit(1);
  console.log('✅ Little Hands pre-audit PASS');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
