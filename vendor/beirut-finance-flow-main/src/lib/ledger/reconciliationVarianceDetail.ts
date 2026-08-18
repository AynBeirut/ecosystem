import type { AgedPayablesReport, AgedReceivablesReport, JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import { buildBookLinesForAccount } from '@/lib/ledger/accountLedgerLines';
import type { ExternalReconciliationImport } from '@/lib/ledger/reconciliationExternal';
import type { ReconciliationGroup, ReconciliationRow } from '@/lib/ledger/reconciliation';

export type VarianceSubledgerLine = {
  ref: string;
  label: string;
  date: string;
  amount: number;
};

export type VarianceDetail = {
  row: ReconciliationRow;
  glLines: Array<{
    date: string;
    ref: string;
    memo: string;
    debit: number;
    credit: number;
    net: number;
  }>;
  subledgerLines: VarianceSubledgerLine[];
  externalImport?: ExternalReconciliationImport;
  hints: string[];
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildVarianceDetail(input: {
  row: ReconciliationRow;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  asOfDate: string;
  arAging: AgedReceivablesReport;
  apAging: AgedPayablesReport;
  externalImport?: ExternalReconciliationImport;
}): VarianceDetail {
  const { row, accounts, entries, lines, asOfDate, arAging, apAging, externalImport } = input;
  const yearStart = `${asOfDate.slice(0, 4)}-01-01`;
  const hints: string[] = [];
  const subledgerLines: VarianceSubledgerLine[] = [];

  let glLines: VarianceDetail['glLines'] = [];
  if (row.accountId) {
    const book = buildBookLinesForAccount(row.accountId, accounts, entries, lines, {
      startDate: yearStart,
      endDate: asOfDate,
    });
    glLines = book.map((line) => ({
      date: line.entryDate,
      ref: line.voucherNumber || line.entryId,
      memo: line.memo || line.description || '',
      debit: line.debit,
      credit: line.credit,
      net: round2(line.debit - line.credit),
    }));
  }

  if (row.group === 'clients') {
    for (const inv of arAging.rows) {
      subledgerLines.push({
        ref: inv.invoiceId,
        label: inv.clientName,
        date: inv.invoiceDate,
        amount: inv.outstanding,
      });
    }
    if (row.variance !== 0) {
      hints.push('AR variance usually means unpaid invoices not posted to GL, duplicate postings, or payments not applied.');
      if (arAging.rows.length === 0 && row.subledgerAmount === 0 && row.glAmount !== 0) {
        hints.push('GL shows a balance but no open invoices — review journal entries on AR accounts.');
      }
    }
  } else if (row.group === 'suppliers') {
    for (const po of apAging.rows) {
      subledgerLines.push({
        ref: po.purchaseOrderId,
        label: po.supplierName,
        date: po.poDate,
        amount: po.outstanding,
      });
    }
    if (row.variance !== 0) {
      hints.push('AP variance usually means purchase receives or payments not synced to GL, or PO totals differ from postings.');
    }
  } else if (externalImport) {
    if (externalImport.lines?.length) {
      for (const line of externalImport.lines) {
        subledgerLines.push({
          ref: line.reference || line.lineDate,
          label: line.description,
          date: line.lineDate,
          amount: round2(line.debit - line.credit),
        });
      }
    } else {
      subledgerLines.push({
        ref: externalImport.fileName,
        label: 'Imported closing balance',
        date: externalImport.importedAt.slice(0, 10),
        amount: externalImport.balance,
      });
    }
    if (row.variance !== 0) {
      hints.push('Compare GL book lines (left) with imported external statement lines. Post missing PV/RV or adjust the import if the CSV period differs.');
    }
  } else if (row.group === 'bank' || row.group === 'cash' || row.group === 'online') {
    if (row.variance !== 0) {
      hints.push('Import an external CSV for this account if the balance comes from an outside bank/wallet statement.');
      hints.push('After posting corrections in vouchers, click Refresh to recalculate.');
    }
  }

  if (row.isPartyDetail && row.subledgerAmount > 0) {
    subledgerLines.length = 0;
    subledgerLines.push({
      ref: row.label,
      label: row.label,
      date: asOfDate,
      amount: row.subledgerAmount,
    });
  }

  return { row, glLines, subledgerLines, externalImport, hints };
}

export function groupSupportsExternalImport(group: ReconciliationGroup): boolean {
  return group === 'cash' || group === 'bank' || group === 'online';
}
