import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

type Props = {
  accounts: LedgerAccount[];
  fromAccountId: string;
  toAccountId: string;
  onFromAccountId: (id: string) => void;
  onToAccountId: (id: string) => void;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  disabled?: boolean;
};

export default function AccountRangePicker({
  accounts,
  fromAccountId,
  toAccountId,
  onFromAccountId,
  onToAccountId,
  isLebaneseCoa,
  pcgClientAccounts,
  accountingLanguage,
  disabled,
}: Props) {
  const list = accounts.filter((account) => account.isActive);

  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">From account</label>
        <LedgerAccountCombobox
          accounts={list}
          value={fromAccountId}
          onValueChange={onFromAccountId}
          isLebaneseCoa={isLebaneseCoa}
          pcgClientAccounts={pcgClientAccounts}
          accountingLanguage={accountingLanguage}
          placeholder="Search start account…"
          compactSelectedLabel
          className="bg-white font-mono"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700">To account</label>
        <LedgerAccountCombobox
          accounts={list}
          value={toAccountId}
          onValueChange={onToAccountId}
          isLebaneseCoa={isLebaneseCoa}
          pcgClientAccounts={pcgClientAccounts}
          accountingLanguage={accountingLanguage}
          placeholder="Search end account…"
          compactSelectedLabel
          className="bg-white font-mono"
          disabled={disabled}
        />
      </div>
    </>
  );
}
