#!/usr/bin/env node
/**
 * Backfill journalEntries.event from sourceKey (sourceType:sourceId:event) or context.
 *
 *   node scripts/backfillJournalEntryEvent.cjs --dry-run
 *   node scripts/backfillJournalEntryEvent.cjs --write
 *   node scripts/backfillJournalEntryEvent.cjs --dry-run --store-id=igMxXecGNbD8yD1Goyyj
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--write');
const storeIdArg = args.find((a) => a.startsWith('--store-id='));
const onlyStoreId = storeIdArg ? storeIdArg.split('=')[1] : '';

try {
  const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (error) {
  console.error('Failed to init Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function voucherEventForType(voucherType) {
  switch (String(voucherType || '').toUpperCase()) {
    case 'PV':
      return 'payment-voucher';
    case 'RV':
      return 'receipt-voucher';
    case 'CV':
      return 'contra-voucher';
    default:
      return 'journal-voucher';
  }
}

function inferEvent(entry) {
  const current = String(entry.event || '').trim();
  if (current) return { event: current, method: 'skip-has-event' };

  const sourceType = String(entry.sourceType || '').trim();
  const sourceId = String(entry.sourceId || '').trim();
  const sourceKey = String(entry.sourceKey || '').trim();
  const memo = String(entry.memo || '').toLowerCase();

  if (sourceKey && sourceType && sourceId) {
    const prefix = `${sourceType}:${sourceId}:`;
    if (sourceKey.startsWith(prefix)) {
      const event = sourceKey.slice(prefix.length).trim();
      if (event) return { event, method: 'sourceKey-prefix' };
    }
  }

  if (sourceKey && sourceType) {
    const parts = sourceKey.split(':');
    if (parts.length >= 3 && parts[0] === sourceType) {
      const keySourceId = parts[1];
      const event = parts.slice(2).join(':').trim();
      if (event && (!sourceId || keySourceId === sourceId)) {
        return { event, method: 'sourceKey-split' };
      }
    }
  }

  if (sourceType === 'manual') {
    const vt = entry.voucherType;
    if (vt) return { event: voucherEventForType(vt), method: 'manual-voucherType' };
    return { event: 'journal-voucher', method: 'manual-default' };
  }
  if (sourceType === 'opening') return { event: 'opening-balance', method: 'sourceType-default' };
  if (sourceType === 'invoice') {
    if (memo.includes('reverse') && memo.includes('payment')) return { event: 'reversal-payments-unknown', method: 'memo-heuristic' };
    if (memo.includes('reverse')) return { event: 'reversal-sale-unknown', method: 'memo-heuristic' };
    if (memo.includes('payment')) return { event: 'paid', method: 'memo-heuristic' };
    return { event: 'sale-recognized', method: 'sourceType-default' };
  }
  if (sourceType === 'invoice_payment') return { event: 'payment-unknown', method: 'sourceType-default' };
  if (sourceType === 'purchase') return { event: 'received', method: 'sourceType-default' };
  if (sourceType === 'purchase_payment') return { event: 'paid', method: 'sourceType-default' };
  if (sourceType === 'expense') return { event: 'paid', method: 'sourceType-default' };
  if (sourceType === 'order') {
    if (memo.includes('reverse')) return { event: 'reversal-unknown', method: 'memo-heuristic' };
    return { event: 'sale-recognized', method: 'sourceType-default' };
  }
  if (sourceType === 'production') {
    if (memo.includes('variance')) return { event: 'variance', method: 'memo-heuristic' };
    if (memo.includes('complete')) return { event: 'complete', method: 'memo-heuristic' };
    if (memo.includes('reverse')) return { event: 'reversal-unknown', method: 'memo-heuristic' };
    return { event: 'started', method: 'sourceType-default' };
  }
  if (sourceType === 'depreciation') return { event: 'post', method: 'sourceType-default' };
  if (sourceType === 'payroll') return { event: 'paid', method: 'sourceType-default' };
  if (sourceType === 'cash_collection') return { event: 'deposited', method: 'sourceType-default' };
  if (sourceType === 'delivery_wallet') {
    if (memo.includes('cod')) return { event: 'cod-collected', method: 'memo-heuristic' };
    return { event: 'settled', method: 'sourceType-default' };
  }
  if (sourceType === 'adjustment') return { event: 'adjustment', method: 'sourceType-default' };

  return { event: '', method: 'unresolved' };
}

function trialBalanceTotals(accounts, entries, lines) {
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  const sums = new Map();
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const cur = sums.get(line.accountId) || { d: 0, c: 0 };
    cur.d += Number(line.debit) || 0;
    cur.c += Number(line.credit) || 0;
    sums.set(line.accountId, cur);
  }
  let totalD = 0;
  let totalC = 0;
  for (const acct of accounts) {
    const s = sums.get(acct.id) || { d: 0, c: 0 };
    let d = s.d;
    let c = s.c;
    const opening = round2(Number(acct.openingBalance) || 0);
    if (opening !== 0) {
      if (acct.normalBalance === 'debit') d += opening;
      else c += opening;
    }
    if (acct.normalBalance === 'debit') {
      const bal = round2(d - c);
      if (bal >= 0) totalD += bal;
      else totalC += -bal;
    } else {
      const bal = round2(c - d);
      if (bal >= 0) totalC += bal;
      else totalD += -bal;
    }
  }
  return { totalD: round2(totalD), totalC: round2(totalC) };
}

async function loadStoreGl(storeId) {
  const [acctsSnap, entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(storeId).collection('ledgerAccounts').get(),
    db.collection('stores').doc(storeId).collection('journalEntries').get(),
    db.collection('stores').doc(storeId).collection('journalLines').get(),
  ]);
  return {
    accounts: acctsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: entriesSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() })),
    lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

async function listStoreIds() {
  if (onlyStoreId) return [onlyStoreId];
  const snap = await db.collection('stores').listDocuments();
  return snap.map((d) => d.id);
}

async function main() {
  console.log(`\nBackfill journalEntries.event — ${dryRun ? 'DRY RUN' : 'WRITE'}\n`);
  const storeIds = await listStoreIds();
  let totalMissing = 0;
  let totalWouldFix = 0;
  let totalFixed = 0;
  let totalUnresolved = 0;
  const unresolvedSamples = [];
  const methodCounts = {};

  for (const storeId of storeIds) {
    const gl = await loadStoreGl(storeId);
    if (!gl.entries.length) continue;

    const tbBefore = trialBalanceTotals(gl.accounts, gl.entries, gl.lines);
    const patches = [];

    for (const entry of gl.entries) {
      const hasEvent = Boolean(String(entry.event || '').trim());
      if (hasEvent) continue;
      totalMissing += 1;

      const { event, method } = inferEvent(entry);
      if (!event || method === 'unresolved') {
        totalUnresolved += 1;
        if (unresolvedSamples.length < 15) {
          unresolvedSamples.push({ storeId, entryId: entry.id, sourceType: entry.sourceType, sourceKey: entry.sourceKey });
        }
        continue;
      }
      if (method === 'skip-has-event') continue;

      methodCounts[method] = (methodCounts[method] || 0) + 1;
      patches.push({ ref: entry.ref, entryId: entry.id, event, method, sourceKey: entry.sourceKey });
    }

    if (!patches.length) continue;

    totalWouldFix += patches.length;
    console.log(`Store ${storeId}: ${patches.length} entry(ies) to backfill (TB D=${tbBefore.totalD} C=${tbBefore.totalC})`);

    if (!dryRun) {
      const batchSize = 400;
      for (let i = 0; i < patches.length; i += batchSize) {
        const batch = db.batch();
        const chunk = patches.slice(i, i + batchSize);
        for (const p of chunk) {
          batch.set(
            p.ref,
            {
              event: p.event,
              eventBackfilledAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
        await batch.commit();
        totalFixed += chunk.length;
      }

      const glAfter = await loadStoreGl(storeId);
      const tbAfter = trialBalanceTotals(glAfter.accounts, glAfter.entries, glAfter.lines);
      if (tbBefore.totalD !== tbAfter.totalD || tbBefore.totalC !== tbAfter.totalC) {
        console.error(`TB MISMATCH store ${storeId}: before D=${tbBefore.totalD} C=${tbBefore.totalC} after D=${tbAfter.totalD} C=${tbAfter.totalC}`);
        process.exit(1);
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Stores scanned: ${storeIds.length}`);
  console.log(`Missing event (before): ${totalMissing}`);
  console.log(`${dryRun ? 'Would fix' : 'Fixed'}: ${dryRun ? totalWouldFix : totalFixed}`);
  console.log(`Unresolved: ${totalUnresolved}`);
  console.log('Inference methods:', methodCounts);
  if (unresolvedSamples.length) {
    console.log('Unresolved samples:', unresolvedSamples);
  }
  if (!dryRun && totalFixed > 0) {
    console.log('Trial Balance: unchanged on all patched stores (metadata-only patch).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
