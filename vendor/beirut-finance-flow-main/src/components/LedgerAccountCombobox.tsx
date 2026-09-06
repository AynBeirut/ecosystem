import { useCallback, useMemo } from 'react';
import { SearchableCombobox, type SearchableOption } from '@/components/SearchableCombobox';
import {
  formatLedgerAccountLabel,
  type AccountingLanguage,
} from '@/lib/grabio/accountingMode';
import { accountSearchScore, compareAccountCodes, compareLedgerAccountSortKeys } from '@/lib/ledger/accountSearch';
import {
  buildClientByGrabioMap,
  buildClientByParentPcgMap,
  displayPcgCodeForLedgerRow,
  formatPcgAccountLabel,
} from '@/lib/ledger/grabioToPcgMap';
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
  /** When true, inactive accounts in `accounts` still appear (JV FX / transport). */
  allowInactiveAccounts?: boolean;
  disabled?: boolean;
  className?: string;
  /** Show account code only in the closed picker (full label stays in dropdown). */
  compactSelectedLabel?: boolean;
};

type AccountOption = SearchableOption & {
  account: LedgerAccount;
  code: string;
  displayCode: string;
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
  allowInactiveAccounts = false,
  disabled,
  className,
  compactSelectedLabel,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const clientByParentPcg = useMemo(
    () => buildClientByParentPcgMap(pcgClientAccounts),
    [pcgClientAccounts],
  );

  const options = useMemo<AccountOption[]>(() => {
    const list = (filterAccounts ? accounts.filter(filterAccounts) : accounts).filter(
      (a) => allowInactiveAccounts || a.isActive !== false,
    );
    return list
      .map((account) => {
        const displayCode = isLebaneseCoa
          ? displayPcgCodeForLedgerRow(account, clientByGrabio, clientByParentPcg)
          : account.code;
        return {
          value: account.id,
          label: isLebaneseCoa
            ? formatPcgAccountLabel(account, accountingLanguage, clientByGrabio)
            : formatLedgerAccountLabel(account, accountingLanguage),
          account,
          code: account.code,
          displayCode,
        };
      })
      .sort((a, b) => compareLedgerAccountSortKeys(a, b, Boolean(isLebaneseCoa)));
  }, [accounts, accountingLanguage, clientByGrabio, clientByParentPcg, allowInactiveAccounts, filterAccounts, isLebaneseCoa]);

  const filterOptions = useCallback(
    (items: SearchableOption[], query: string) => {
      const q = query.trim();
      const accountItems = items as AccountOption[];
      if (!q) {
        return [...accountItems].sort((a, b) =>
          compareLedgerAccountSortKeys(a, b, Boolean(isLebaneseCoa)),
        );
      }
      return accountItems
        .map((item) => ({
          item,
          score: accountSearchScore(q, {
            code: item.code,
            displayCode: item.displayCode,
            name: item.account.name,
            nameAr: item.account.nameAr,
          }),
        }))
        .filter((row) => row.score >= 0)
        .sort((a, b) => {
          const byScore = b.score - a.score;
          if (byScore !== 0) return byScore;
          return compareLedgerAccountSortKeys(a.item, b.item, Boolean(isLebaneseCoa));
        })
        .map((row) => row.item);
    },
    [isLebaneseCoa],
  );

  const selectedAccount = accounts.find((account) => account.id === value);
  const displayLabel =
    compactSelectedLabel && selectedAccount
      ? isLebaneseCoa
        ? displayPcgCodeForLedgerRow(selectedAccount, clientByGrabio, clientByParentPcg)
        : selectedAccount.code
      : undefined;

  return (
    <SearchableCombobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder="Type account code or name…"
      emptyText="No accounts found."
      disabled={disabled}
      className={className}
      displayLabel={displayLabel}
      filterOptions={filterOptions}
      renderOption={(option) => {
        const row = option as AccountOption;
        const title =
          row.code !== row.displayCode && !isLebaneseCoa
            ? `${row.displayCode} · ${row.account.name} (Grabio ${row.code})`
            : `${row.displayCode} · ${row.account.name}`;
        return (
          <span className="flex min-w-0 items-center gap-2" title={title}>
            <span className="shrink-0 font-mono text-xs text-slate-600">{row.displayCode}</span>
            <span className="min-w-0 truncate text-sm text-slate-900">{row.account.name}</span>
          </span>
        );
      }}
    />
  );
}
