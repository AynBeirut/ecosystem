import { createContext, useContext } from 'react';
import type { JournalEntry } from '@/types/generalLedger';

export type BeginPostedVoucherEdit = (entry: JournalEntry, options?: { onClose?: () => void }) => boolean;

const AccountingPostedEditContext = createContext<BeginPostedVoucherEdit | null>(null);

export function AccountingPostedEditProvider({
  beginEdit,
  children,
}: {
  beginEdit: BeginPostedVoucherEdit;
  children: React.ReactNode;
}) {
  return (
    <AccountingPostedEditContext.Provider value={beginEdit}>{children}</AccountingPostedEditContext.Provider>
  );
}

export function useAccountingPostedEdit() {
  return useContext(AccountingPostedEditContext);
}
