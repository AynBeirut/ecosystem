import type { StoreProfile } from '@/types/storeProfile';
import { readFinanceDocumentSettings, type FinanceDocumentSettings } from '@/lib/financeDocumentSettings';

export type DeliveryExpenseLedgerConfig = {
  accountId: string;
  accountCode: string;
  name: string;
};

/** Little Hands default — Delivery & Courier Expenses (COA 653). */
export const DEFAULT_DELIVERY_EXPENSE_LEDGER: DeliveryExpenseLedgerConfig = {
  accountId: 'acct-653',
  accountCode: '653',
  name: 'Delivery & Courier Expenses',
};

export type DeliveryExpenseSettings = FinanceDocumentSettings & {
  deliveryExpenseLedgerAccountId?: string;
  deliveryExpenseLedgerAccountCode?: string;
  deliveryExpenseLedgerAccountName?: string;
};

export function resolveDeliveryExpenseAccount(profile: StoreProfile | null | undefined): DeliveryExpenseLedgerConfig {
  const fin = readFinanceDocumentSettings(profile) as DeliveryExpenseSettings;
  if (fin.deliveryExpenseLedgerAccountId) {
    return {
      accountId: fin.deliveryExpenseLedgerAccountId,
      accountCode: fin.deliveryExpenseLedgerAccountCode || DEFAULT_DELIVERY_EXPENSE_LEDGER.accountCode,
      name: fin.deliveryExpenseLedgerAccountName || DEFAULT_DELIVERY_EXPENSE_LEDGER.name,
    };
  }
  return DEFAULT_DELIVERY_EXPENSE_LEDGER;
}
