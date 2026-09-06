import type { VatFilingSummary } from '@/lib/ledger/vatFilingSummary';
import type { JournalLineInput, LedgerAccount } from '@/types/generalLedger';

export type VatTransferPreview = {
  canPost: boolean;
  blockReason?: string;
  netVatDue: number;
  lines: JournalLineInput[];
  memo: string;
};

/** Matrix GL160P-style VAT transfer to GL (4426 / 4427 family). */
export function buildVatTransferPreview(
  accounts: LedgerAccount[],
  filing: VatFilingSummary,
): VatTransferPreview {
  const net = Math.round(filing.netVatDue * 100) / 100;
  const memo = `VAT transfer ${filing.startDate} → ${filing.endDate}`;
  if (!net) {
    return { canPost: false, blockReason: 'Net VAT is zero — nothing to transfer.', netVatDue: 0, lines: [], memo };
  }

  const outputAcct =
    accounts.find((a) => a.isActive && a.code === filing.outputVat.accountCode) ||
    accounts.find((a) => a.isActive && a.code === '220');
  const inputAcct =
    accounts.find((a) => a.isActive && a.code === filing.inputVat.accountCode) ||
    accounts.find((a) => a.isActive && a.code === '140');

  if (!outputAcct || !inputAcct) {
    return {
      canPost: false,
      blockReason: 'Output VAT (220) or Input VAT (140) account missing in chart.',
      netVatDue: net,
      lines: [],
      memo,
    };
  }

  const amount = Math.abs(net);
  const lines: JournalLineInput[] =
    net > 0
      ? [
          { accountId: outputAcct.id, debit: amount, credit: 0 },
          { accountId: inputAcct.id, debit: 0, credit: amount },
        ]
      : [
          { accountId: inputAcct.id, debit: amount, credit: 0 },
          { accountId: outputAcct.id, debit: 0, credit: amount },
        ];

  return { canPost: true, netVatDue: net, lines, memo };
}
