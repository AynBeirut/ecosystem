import { useCallback } from 'react';
import { toast } from 'sonner';
import { useLedger } from '@/context/LedgerContext';
import { useAccountingPostedEdit } from '@/context/AccountingPostedEditContext';
import { useFinanceShellState } from '@/context/FinanceShellStateContext';
import { stashVoucherEditIntent } from '@/lib/ledger/voucherEditIntent';
import type { JournalEntry } from '@/types/generalLedger';

export function usePostedVoucherEditor() {
  const { isDateLocked } = useLedger();
  const beginEditInPlace = useAccountingPostedEdit();
  const { openAccountingTab, setFinanceReturnUrl } = useFinanceShellState();

  return useCallback(
    (entry: JournalEntry, options?: { onClose?: () => void }) => {
      if (entry.status !== 'posted') {
        toast.error('Only posted vouchers can be edited.');
        return false;
      }
      if (isDateLocked(entry.date)) {
        toast.error('That period is closed — cannot reverse and repost this voucher.');
        return false;
      }

      if (beginEditInPlace) {
        options?.onClose?.();
        return beginEditInPlace(entry);
      }

      const returnUrl =
        typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : undefined;
      stashVoucherEditIntent({ entryId: entry.id, returnUrl });
      if (returnUrl) setFinanceReturnUrl(returnUrl);
      options?.onClose?.();
      openAccountingTab('vouchers');
      return true;
    },
    [beginEditInPlace, isDateLocked, openAccountingTab, setFinanceReturnUrl],
  );
}
