#!/usr/bin/env node
/**
 * Nipco — reverse duplicate purchase:received GL entries (keep earliest JE per PO).
 * Read-only with --dry-run; posts offsetting reversal JEs with --write.
 *
 *   node scripts/nipcoDedupePurchaseReceives.cjs --dry-run
 *   node scripts/nipcoDedupePurchaseReceives.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const CLEANUP_BY = 'cursor-nipco-duplicate-purchase-receive-cleanup';
const CLEANUP_REASON = 'duplicate_purchase_received_journal';
const AP_CODE = '201';
const RAW_CODE = '120';

const dryRun = !process.argv.includes('--write');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function initAdmin() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  return admin.firestore();
}

function trialBalance(accounts, entries, lines) {
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  const sums = new Map();
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const prev = sums.get(line.accountId) || { debit: 0, credit: 0 };
    prev.debit += Number(line.debit || 0);
    prev.credit += Number(line.credit || 0);
    sums.set(line.accountId, prev);
  }
  let totalDebit = 0;
  let totalCredit = 0;
  const byCode = {};
  for (const account of accounts) {
    const sum = sums.get(account.id) || { debit: 0, credit: 0 };
    let debit = round2(sum.debit);
    let credit = round2(sum.credit);
    const opening = round2(Number(account.openingBalance) || 0);
    if (opening !== 0) {
      if (account.normalBalance === 'debit') debit = round2(debit + opening);
      else credit = round2(credit + opening);
    }
    totalDebit = round2(totalDebit + debit);
    totalCredit = round2(totalCredit + credit);
    const normal = account.normalBalance === 'credit' ? 'credit' : 'debit';
    const balance = normal === 'credit' ? round2(credit - debit) : round2(debit - credit);
    if (debit !== 0 || credit !== 0 || opening !== 0) {
      byCode[String(account.code)] = { code: account.code, name: account.name, debit, credit, balance, normal };
    }
  }
  return {
    balanced: round2(totalDebit) === round2(totalCredit),
    totalDebit: round2(totalDebit),
    totalCredit: round2(totalCredit),
    byCode,
  };
}

function apBalance(tb) {
  const row = tb.byCode[AP_CODE];
  if (!row) return 0;
  return row.normal === 'credit' ? row.balance : -row.balance;
}

async function loadLedger(db) {
  const [accountsSnap, entriesSnap, linesSnap, purchasesSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
    db.collection('purchases').where('storeId', '==', STORE_ID).get(),
  ]);
  return {
    accounts: accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    purchases: purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

function groupDuplicateReceives(entries, lines) {
  const recv = entries.filter(
    (e) => e.status === 'posted' && e.sourceType === 'purchase' && e.event === 'received',
  );
  const linesByEntry = new Map();
  for (const line of lines) {
    if (!linesByEntry.has(line.entryId)) linesByEntry.set(line.entryId, []);
    linesByEntry.get(line.entryId).push(line);
  }

  const byPurchase = new Map();
  for (const e of recv) {
    const pid = String(e.sourceId || '');
    if (!pid) continue;
    const entryLines = (linesByEntry.get(e.id) || []).sort(
      (a, b) => (a.lineOrder ?? 0) - (b.lineOrder ?? 0),
    );
    if (!byPurchase.has(pid)) byPurchase.set(pid, []);
    byPurchase.get(pid).push({ entry: e, lines: entryLines });
  }

  const plan = [];
  for (const [purchaseId, list] of byPurchase.entries()) {
    list.sort((a, b) => {
      const ca = String(a.entry.createdAt || a.entry.date || '');
      const cb = String(b.entry.createdAt || b.entry.date || '');
      if (ca !== cb) return ca.localeCompare(cb);
      return String(a.entry.id).localeCompare(String(b.entry.id));
    });
    if (list.length <= 1) continue;
    const kept = list[0];
    for (let i = 1; i < list.length; i++) {
      plan.push({
        purchaseId,
        keptEntryId: kept.entry.id,
        duplicateEntry: list[i].entry,
        duplicateLines: list[i].lines,
      });
    }
  }
  return plan;
}

function reversalSourceKey(purchaseId, duplicateEntryId) {
  return `purchase:${purchaseId}:reversal-duplicate-receive-cleanup-${duplicateEntryId}`;
}

async function findExistingReversal(db, purchaseId, duplicateEntryId) {
  const sourceKey = reversalSourceKey(purchaseId, duplicateEntryId);
  const snap = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalEntries')
    .where('sourceKey', '==', sourceKey)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function reverseDuplicateReceive(db, item, cleanupAt) {
  const { purchaseId, keptEntryId, duplicateEntry, duplicateLines } = item;
  const dupId = duplicateEntry.id;

  if (duplicateEntry.duplicateCleanupReversalEntryId) {
    return {
      purchaseId,
      duplicateEntryId: dupId,
      skipped: true,
      reversalEntryId: duplicateEntry.duplicateCleanupReversalEntryId,
      keptEntryId,
    };
  }

  const existing = await findExistingReversal(db, purchaseId, dupId);
  if (existing) {
    if (!dryRun) {
      await db
        .collection('stores')
        .doc(STORE_ID)
        .collection('journalEntries')
        .doc(dupId)
        .set(
          {
            duplicateCleanupReason: CLEANUP_REASON,
            duplicateCleanupKeptJournalEntryId: keptEntryId,
            duplicateCleanupReversalEntryId: existing.id,
            duplicateCleanupBy: CLEANUP_BY,
            duplicateCleanupAt: cleanupAt,
          },
          { merge: true },
        );
    }
    return {
      purchaseId,
      duplicateEntryId: dupId,
      skipped: true,
      reversalEntryId: existing.id,
      keptEntryId,
    };
  }

  if (dryRun) {
    let crAp = 0;
    for (const line of duplicateLines) {
      if (String(line.accountCode) === AP_CODE) crAp = round2(crAp + (Number(line.credit) || 0));
    }
    return {
      purchaseId,
      duplicateEntryId: dupId,
      skipped: false,
      dryRun: true,
      keptEntryId,
      reversalCrAp: crAp,
      sourceKey: reversalSourceKey(purchaseId, dupId),
    };
  }

  const reversalEntryId = `JE-${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const sourceKey = reversalSourceKey(purchaseId, dupId);
  const keyRef = db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').doc(sourceKey);
  const entryRef = db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(reversalEntryId);
  const dupEntryRef = db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(dupId);

  const cleanupMeta = {
    duplicateCleanupReason: CLEANUP_REASON,
    duplicateCleanupOriginalJournalEntryId: dupId,
    duplicateCleanupKeptJournalEntryId: keptEntryId,
    duplicateCleanupBy: CLEANUP_BY,
    duplicateCleanupAt: cleanupAt,
    duplicateCleanupOriginalSourceId: purchaseId,
  };

  await db.runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists) return;

    tx.set(entryRef, {
      id: reversalEntryId,
      storeId: STORE_ID,
      date: cleanupAt,
      memo: `Reverse duplicate purchase receive ${purchaseId} (${dupId})`,
      status: 'posted',
      sourceType: 'purchase',
      sourceId: purchaseId,
      event: `reversal-duplicate-receive-cleanup-${dupId}`,
      sourceKey,
      currency: duplicateEntry.currency || 'USD',
      createdAt: cleanupAt,
      updatedAt: cleanupAt,
      createdBy: CLEANUP_BY,
      ...cleanupMeta,
      duplicateCleanupReversalEntryId: reversalEntryId,
    });

    duplicateLines.forEach((line, index) => {
      const lineRef = db
        .collection('stores')
        .doc(STORE_ID)
        .collection('journalLines')
        .doc(`${reversalEntryId}-L${index + 1}`);
      tx.set(lineRef, {
        id: `${reversalEntryId}-L${index + 1}`,
        storeId: STORE_ID,
        entryId: reversalEntryId,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        currency: line.currency || duplicateEntry.currency || 'USD',
        debit: round2(line.credit),
        credit: round2(line.debit),
        description: `Reverse duplicate receive ${dupId}: ${line.description || ''}`.trim(),
        lineOrder: index,
      });
    });

    tx.set(keyRef, {
      storeId: STORE_ID,
      sourceKey,
      entryId: reversalEntryId,
      createdAt: cleanupAt,
      updatedAt: cleanupAt,
    });

    tx.set(dupEntryRef, { ...cleanupMeta, duplicateCleanupReversalEntryId: reversalEntryId }, { merge: true });
  });

  return {
    purchaseId,
    duplicateEntryId: dupId,
    skipped: false,
    reversalEntryId,
    keptEntryId,
    sourceKey,
  };
}

async function tagPurchases(db, plan, cleanupAt) {
  const byPurchase = new Map();
  for (const item of plan) {
    if (!byPurchase.has(item.purchaseId)) {
      byPurchase.set(item.purchaseId, item.keptEntryId);
    }
  }
  for (const [purchaseId, keptEntryId] of byPurchase.entries()) {
    await db.collection('purchases').doc(purchaseId).set(
      {
        duplicateReceiveCleanupKeptJournalEntryId: keptEntryId,
        duplicateReceiveCleanupReason: CLEANUP_REASON,
        duplicateReceiveCleanupBy: CLEANUP_BY,
        duplicateReceiveCleanupAt: cleanupAt,
      },
      { merge: true },
    );
  }
}

async function main() {
  const db = initAdmin();
  const cleanupAt = new Date().toISOString();
  const ledger = await loadLedger(db);
  const tbBefore = trialBalance(ledger.accounts, ledger.entries, ledger.lines);
  const apBefore = apBalance(tbBefore);

  const plan = groupDuplicateReceives(ledger.entries, ledger.lines);
  let excessAp = 0;
  for (const item of plan) {
    for (const line of item.duplicateLines) {
      if (String(line.accountCode) === AP_CODE) {
        excessAp = round2(excessAp + (Number(line.credit) || 0));
      }
    }
  }

  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}`);
  console.log('TB BEFORE', {
    balanced: tbBefore.balanced,
    totalDebit: tbBefore.totalDebit,
    totalCredit: tbBefore.totalCredit,
    ap201: apBefore,
  });
  console.log(`Duplicate receive JEs to reverse: ${plan.length} (keep 1 per PO)`);
  console.log(`Expected AP 201 reduction (Cr offset via reversal Dr): ${excessAp}`);
  console.log(`Modeled AP after dedupe: ${round2(apBefore - excessAp)}`);

  const results = [];
  for (const item of plan) {
    const result = await reverseDuplicateReceive(db, item, cleanupAt);
    results.push(result);
    if (results.length <= 5 || dryRun) {
      console.log('RESULT', JSON.stringify(result));
    }
    if (!dryRun) await new Promise((r) => setTimeout(r, 8));
  }
  if (results.length > 5 && !dryRun) {
    console.log(`... ${results.length} total results (first 5 logged above)`);
  }

  if (!dryRun) {
    await tagPurchases(db, plan, cleanupAt);
    const afterLedger = await loadLedger(db);
    const tbAfter = trialBalance(afterLedger.accounts, afterLedger.entries, afterLedger.lines);
    const apAfter = apBalance(tbAfter);
    console.log('TB AFTER', {
      balanced: tbAfter.balanced,
      totalDebit: tbAfter.totalDebit,
      totalCredit: tbAfter.totalCredit,
      ap201: apAfter,
    });
    console.log('KEY ACCOUNTS', {
      ap201: tbAfter.byCode[AP_CODE],
      raw120: tbAfter.byCode[RAW_CODE],
      cash102: tbAfter.byCode['102'],
    });
    console.log(
      'SUMMARY',
      JSON.stringify(
        {
          reversedCount: results.filter((r) => !r.skipped).length,
          skippedCount: results.filter((r) => r.skipped).length,
          apBefore,
          apAfter,
          expectedApAfter: round2(apBefore - excessAp),
          tbBefore: { balanced: tbBefore.balanced, totalDebit: tbBefore.totalDebit, totalCredit: tbBefore.totalCredit },
          tbAfter: { balanced: tbAfter.balanced, totalDebit: tbAfter.totalDebit, totalCredit: tbAfter.totalCredit },
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      'DRY-RUN SUMMARY',
      JSON.stringify({ planCount: plan.length, excessAp, apBefore, expectedApAfter: round2(apBefore - excessAp) }),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
