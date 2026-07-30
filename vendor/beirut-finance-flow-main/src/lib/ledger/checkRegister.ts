import type { CheckRegisterEntry, CheckStatus, JournalEntry, JournalLine } from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type PvMeta = {
  payee?: string;
  paymentRef?: string;
  checkNumber?: string;
  checkStatus?: CheckStatus;
  checkAmount?: number;
  amount?: number;
  paidFromAccountId?: string;
};

function entryAmount(entryId: string, meta: PvMeta, lines?: JournalLine[]): number {
  if (typeof meta.checkAmount === 'number' && meta.checkAmount > 0) return round2(meta.checkAmount);
  if (typeof meta.amount === 'number' && meta.amount > 0) return round2(meta.amount);
  if (!lines?.length) return 0;
  const entryLines = lines.filter((l) => l.entryId === entryId);
  const creditTotal = round2(entryLines.reduce((s, l) => s + (l.credit || 0), 0));
  const debitTotal = round2(entryLines.reduce((s, l) => s + (l.debit || 0), 0));
  return Math.max(creditTotal, debitTotal);
}

export function buildCheckRegister(entries: JournalEntry[], lines?: JournalLine[]): CheckRegisterEntry[] {
  const lineIndex = lines || [];
  const accountCodeById = new Map(lineIndex.map((l) => [l.accountId, l.accountCode]));

  return entries
    .filter((e) => e.status === 'posted' && e.voucherType === 'PV')
    .map((e) => {
      const meta = (e.voucherMeta || {}) as PvMeta;
      const checkNumber = String(meta.checkNumber || meta.paymentRef || '').trim();
      if (!checkNumber) return null;
      const amount = entryAmount(e.id, meta, lineIndex);
      const bankCode = meta.paidFromAccountId ? accountCodeById.get(meta.paidFromAccountId) : undefined;
      return {
        entryId: e.id,
        voucherNumber: e.voucherNumber,
        date: e.date.slice(0, 10),
        payee: meta.payee,
        checkNumber,
        amount,
        status: meta.checkStatus || 'issued',
        bankAccountCode: bankCode,
      } satisfies CheckRegisterEntry;
    })
    .filter(Boolean)
    .sort((a, b) => b!.date.localeCompare(a!.date) || (a!.checkNumber || '').localeCompare(b!.checkNumber || '')) as CheckRegisterEntry[];
}
