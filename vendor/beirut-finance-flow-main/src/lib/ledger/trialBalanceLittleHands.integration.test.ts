/**
 * Integration gate: Little Hands Lebanese TB rollup (read-only Firestore).
 * Run: LITTLE_HANDS_INTEGRATION=1 npm test -- trialBalanceLittleHands.integration.test.ts
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { buildExtendedTrialBalance } from '@/lib/ledger/trialBalanceExtended';
import {
  buildLebaneseTrialBalanceTree,
  collectTrialBalanceTreeGroupIds,
  defaultExpandedTrialBalanceNodes,
  flattenTrialBalanceTree,
} from '@/lib/ledger/trialBalanceHierarchy';
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

const runIntegration = process.env.LITTLE_HANDS_INTEGRATION === '1';

describe.skipIf(!runIntegration)('Little Hands TB integration', () => {
  it('rolls 102 into 53001000001 for client-code range', async () => {
    const repoRoot = path.resolve(__dirname, '../../../../../');
    const require = createRequire(import.meta.url);
    const admin = require(path.join(repoRoot, 'functions/node_modules/firebase-admin'));
    const saPath = path.join(repoRoot, 'serviceAccountKey.json');
    if (!fs.existsSync(saPath)) throw new Error('serviceAccountKey.json not found');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))),
      });
    }
    const db = admin.firestore();
    const STORE = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';

    const [accountsSnap, entriesSnap, linesSnap, clientsSnap] = await Promise.all([
      db.collection('stores').doc(STORE).collection('ledgerAccounts').get(),
      db.collection('stores').doc(STORE).collection('journalEntries').where('status', '==', 'posted').get(),
      db.collection('stores').doc(STORE).collection('journalLines').get(),
      db.collection('stores').doc(STORE).collection('pcgClientAccounts').get(),
    ]);

    const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as LedgerAccount[];
    const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as JournalEntry[];
    const lines = linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as JournalLine[];
    const pcgClientAccounts = clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as PcgClientAccount[];

    const report = buildExtendedTrialBalance(accounts, entries, lines, {
      startDate: '2026-01-01',
      endDate: '2026-08-31',
      viewMode: '6col',
    });

    const cashRow = report.rows.find((r) => r.accountCode === '102');
    expect(cashRow?.periodDebit).toBeGreaterThan(0);

    const byId = new Map(report.rows.map((r) => [r.accountId, r]));
    const roots = buildLebaneseTrialBalanceTree(
      accounts,
      byId,
      '53001000001',
      '70901000001',
      pcgClientAccounts,
      { hideInactiveAccounts: true, includeZeroBalance: true },
    );

    const visible = flattenTrialBalanceTree(roots, defaultExpandedTrialBalanceNodes(roots));
    const allExpanded = new Set(collectTrialBalanceTreeGroupIds(roots));
    const allVisible = flattenTrialBalanceTree(roots, allExpanded);
    const cashNode = allVisible.find((n) => n.code === '53001000001');
    const class5 = visible.find((n) => n.code === '5');

    expect(class5?.row.periodDebit).toBeGreaterThan(0);
    expect(cashNode?.row.periodDebit).toBeGreaterThan(0);
    expect(cashNode?.row.periodDebit).toBe(cashRow?.periodDebit);
  }, 120_000);
});
