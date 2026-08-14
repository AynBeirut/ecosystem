import { useMemo } from 'react';
import { SearchableCombobox, type SearchableOption } from '@/components/SearchableCombobox';
import {
  formatLedgerAccountLabel,
  type AccountingLanguage,
} from '@/lib/grabio/accountingMode';
import { buildClientByGrabioMap, formatPcgAccountLabel } from '@/lib/ledger/grabioToPcgMap';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

type Props = {
  accounts: LedgerAccount[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  accountingLanguage?: AccountingLanguage;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  filterAccounts?: (account: LedgerAccount) => boolean;
  disabled?: boolean;
  className?: string;
  /** Show account code only in the closed picker (full label stays in dropdown). */
  compactSelectedLabel?: boolean;
};

export function LedgerAccountCombobox({
  accounts,
  value,
  onValueChange,
  placeholder = 'Search account…',
  accountingLanguage,
  isLebaneseCoa,
  pcgClientAccounts = [],
  filterAccounts,
  disabled,
  className,
  compactSelectedLabel,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);

  const options = useMemo<SearchableOption[]>(() => {
    const list = filterAccounts ? accounts.filter(filterAccounts) : accounts;
    return list.map((account) => ({
      value: account.id,
      label: isLebaneseCoa
        ? formatPcgAccountLabel(account, accountingLanguage, clientByGrabio)
        : formatLedgerAccountLabel(account, accountingLanguage),
      keywords: [account.code, account.name, account.nameAr, account.id].filter(Boolean).join(' '),
    }));
  }, [accounts, accountingLanguage, clientByGrabio, filterAccounts, isLebaneseCoa]);

  const selectedAccount = accounts.find((account) => account.id === value);
  const displayLabel =
    compactSelectedLabel && selectedAccount ? selectedAccount.code : undefined;

  return (
    <SearchableCombobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Type code or name…"
      emptyText="No accounts found."
      disabled={disabled}
      className={className}
      displayLabel={displayLabel}
    />
  );
}
