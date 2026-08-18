import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import { accountCodeNumeric, accountsInCodeRange, isAccountInCodeRange } from '@/lib/ledger/accountCodeRange';
import {
  buildClientByGrabioMap,
  buildClientByParentPcgMap,
  displayPcgCodeForLedgerRow,
  formatPcgAccountLabel,
} from '@/lib/ledger/grabioToPcgMap';
import { buildExtendedTrialBalance, extendedTrialBalanceToCsv } from '@/lib/ledger/trialBalanceExtended';
import {
  buildLebaneseTrialBalanceTree,
  collectTrialBalanceTreeGroupIds,
  defaultExpandedTrialBalanceNodes,
  emptyExtendedRow,
  flattenTrialBalanceTree,
  rowHasActivity,
  type TrialBalanceTreeNode,
} from '@/lib/ledger/trialBalanceHierarchy';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  PcgClientAccount,
  TrialBalanceExtendedReport,
  TrialBalanceExtendedRow,
} from '@/types/generalLedger';
import { cn, formatCurrency } from '@/lib/utils';
import { downloadCsvText } from '@/lib/csvExport';
import { toast } from 'sonner';

type Props = {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  asOfDate: string;
  loading?: boolean;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  currencyCode?: string;
  onRefresh?: () => void;
  onOpenGl?: (accountId: string) => void;
};

type TbColumnKey =
  | 'startingDebit'
  | 'startingCredit'
  | 'startingBalanceLbp'
  | 'movementDebitLbp'
  | 'movementCreditLbp'
  | 'movementBalanceLbp'
  | 'totalDebitLbp'
  | 'totalCreditLbp'
  | 'totalBalanceLbp';

type TbOptions = Record<TbColumnKey, boolean> & {
  movableAccounts: boolean;
  auxiliaryAccounts: boolean;
  auxiliaryClassAccounts: boolean;
  includeZeroBalance: boolean;
  totalLevel1: boolean;
  totalLevel2: boolean;
  totalLevel3: boolean;
  totalLevel4: boolean;
  showCurrency: boolean;
  showDepartment: boolean;
  rowStartingBalance: boolean;
  rowClosingBalance: boolean;
  excludeClosingBalance: boolean;
  hideInactiveAccounts: boolean;
  deptGroup1: boolean;
  deptGroup2: boolean;
  deptGroup3: boolean;
  deptGroup4: boolean;
  deptGroup5: boolean;
};

const ACTIVE_COLUMN_OPTIONS: Array<{ key: TbColumnKey; label: string }> = [
  { key: 'startingBalanceLbp', label: 'Starting balance' },
  { key: 'startingDebit', label: 'Starting debit' },
  { key: 'startingCredit', label: 'Starting credit' },
  { key: 'movementDebitLbp', label: 'Movement debit' },
  { key: 'movementCreditLbp', label: 'Movement credit' },
  { key: 'movementBalanceLbp', label: 'Movement balance' },
  { key: 'totalDebitLbp', label: 'Total debit' },
  { key: 'totalCreditLbp', label: 'Total credit' },
  { key: 'totalBalanceLbp', label: 'Total balance' },
];

const ACTIVE_ROW_OPTIONS: Array<{ key: keyof TbOptions; label: string }> = [
  { key: 'movableAccounts', label: 'Moveable accounts' },
  { key: 'auxiliaryAccounts', label: 'Auxiliary accounts' },
  { key: 'auxiliaryClassAccounts', label: 'Auxiliary class accounts' },
  { key: 'includeZeroBalance', label: 'Zero-balance accounts' },
  { key: 'hideInactiveAccounts', label: 'Hide inactive accounts' },
  { key: 'totalLevel1', label: 'Total level 1' },
  { key: 'totalLevel2', label: 'Total level 2' },
  { key: 'totalLevel3', label: 'Total level 3' },
  { key: 'totalLevel4', label: 'Total level 4' },
  { key: 'excludeClosingBalance', label: 'Exclude closing balance' },
];

const DEFAULT_OPTIONS: TbOptions = {
  startingDebit: false,
  startingCredit: false,
  startingBalanceLbp: true,
  movementDebitLbp: true,
  movementCreditLbp: true,
  movementBalanceLbp: false,
  totalDebitLbp: true,
  totalCreditLbp: true,
  totalBalanceLbp: true,
  movableAccounts: true,
  auxiliaryAccounts: true,
  auxiliaryClassAccounts: true,
  includeZeroBalance: true,
  totalLevel1: true,
  totalLevel2: true,
  totalLevel3: true,
  totalLevel4: true,
  showCurrency: false,
  showDepartment: false,
  rowStartingBalance: false,
  rowClosingBalance: false,
  excludeClosingBalance: true,
  hideInactiveAccounts: true,
  deptGroup1: false,
  deptGroup2: false,
  deptGroup3: false,
  deptGroup4: false,
  deptGroup5: false,
};

function visibleColumnCount(options: TbOptions): number {
  let count = 0;
  if (options.startingDebit) count += 1;
  if (options.startingCredit) count += 1;
  if (options.startingBalanceLbp) count += 1;
  if (options.movementDebitLbp) count += 1;
  if (options.movementCreditLbp) count += 1;
  if (options.movementBalanceLbp) count += 1;
  if (options.totalDebitLbp) count += 1;
  if (options.totalCreditLbp) count += 1;
  if (options.totalBalanceLbp) count += 1;
  return count;
}

function formatDisplayAccountCode(code: string): string {
  const raw = String(code || '').trim();
  if (!raw) return raw;
  const floatMatch = /^(\d+)\.(\d+)$/.exec(raw);
  if (floatMatch) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      const rounded = Math.round(n * 1000) / 1000;
      return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : String(rounded);
    }
  }
  return raw.length > 12 ? `${raw.slice(0, 12)}…` : raw;
}

function tbAmountCell(value: number, currency: string): string {
  if (!value) return '—';
  return formatCurrency(value, currency, 'compact');
}

const TB_HEAD = 'px-1 py-1.5 text-[10px] font-semibold leading-tight text-white';
const TB_NUM_HEAD = `${TB_HEAD} text-right`;
const TB_CELL = 'px-1 py-1 align-top text-[11px]';
const TB_NUM_CELL = `${TB_CELL} text-right tabular-nums whitespace-nowrap`;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function signedNet(debit: number, credit: number): number {
  return round2((debit || 0) - (credit || 0));
}

function formatLegacyAmount(
  value: number,
  currency: string,
): { text: string; negative: boolean } {
  if (!value) return { text: '0.00', negative: false };
  if (value < 0) return { text: `(${formatCurrency(Math.abs(value), currency)})`, negative: true };
  return { text: formatCurrency(value, currency), negative: false };
}

function normalizeCode(code: string): string {
  return String(code || '').trim().replace(/\./g, '').split('-')[0] || '';
}

function displayCodeLevel(code: string, pcgKind?: string): 1 | 2 | 3 | 4 {
  const base = normalizeCode(code);
  const len = base.replace(/\D/g, '').length || base.length;
  if (pcgKind === 'G') {
    if (len <= 1) return 1;
    if (len <= 2) return 2;
    if (len <= 4) return 3;
    return 4;
  }
  if (String(code).includes('-')) return 4;
  if (len <= 2) return 2;
  if (len <= 4) return 3;
  return 4;
}

function tbRowClass(level: 1 | 2 | 3 | 4, isGroup: boolean): string {
  if (level === 1) return 'bg-slate-200/80 font-bold text-red-900';
  if (level === 2 && isGroup) return 'bg-white font-bold text-blue-900';
  if (level === 3) return 'bg-sky-50';
  if (level === 4) return 'bg-amber-50/60';
  return '';
}

function accountsInTrialBalanceRange(
  accounts: LedgerAccount[],
  fromCode: string,
  toCode: string,
  isLebaneseCoa: boolean,
  clientByGrabio: Map<string, PcgClientAccount>,
  clientByParentPcg: Map<string, PcgClientAccount[]>,
  hideInactiveAccounts = true,
): LedgerAccount[] {
  const from = fromCode.trim();
  const to = toCode.trim();
  if (!from && !to) {
    return accounts.filter((account) => !hideInactiveAccounts || account.isActive);
  }

  const lo = from || '0';
  const hi = to || '9'.repeat(12);

  if (!isLebaneseCoa) {
    return accountsInCodeRange(accounts, lo, hi, {
      classes17Only: false,
      activeOnly: hideInactiveAccounts,
    });
  }

  return accounts
    .filter((account) => {
      if (hideInactiveAccounts && !account.isActive) return false;
      const displayCode = displayPcgCodeForLedgerRow(account, clientByGrabio, clientByParentPcg);
      return isAccountInCodeRange(displayCode, lo, hi) || isAccountInCodeRange(account.code, lo, hi);
    })
    .sort((a, b) => accountCodeNumeric(a.code) - accountCodeNumeric(b.code));
}

function validateTrialBalanceInput(
  accounts: LedgerAccount[],
  fromCode: string,
  toCode: string,
  startDate: string,
  endDate: string,
  isLebaneseCoa: boolean,
  clientByGrabio: Map<string, PcgClientAccount>,
  clientByParentPcg: Map<string, PcgClientAccount[]>,
): string | null {
  const from = fromCode.trim();
  const to = toCode.trim();
  if (!from || !to) return 'Enter From and To account codes.';
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  if (!start || !end) return 'Choose both period dates.';
  if (start > end) return 'Period From must be on or before Period To.';
  const matched = accountsInTrialBalanceRange(
    accounts,
    from,
    to,
    Boolean(isLebaneseCoa),
    clientByGrabio,
    clientByParentPcg,
  );
  if (matched.length === 0) {
    return `No active accounts in range ${from} → ${to}. Check codes (e.g. 601 → 701).`;
  }
  return null;
}

function legacyTrialBalanceToCsv(
  rows: TrialBalanceExtendedRow[],
  codes: Map<string, string>,
  names: Map<string, string>,
): string {
  const header =
    'Account,Account Name,Starting Bal,Movement Debit,Movement Credit,Total Debit,Total Credit,Total Balance';
  const body = rows.map((row) => {
    const start = signedNet(row.openingDebit, row.openingCredit);
    const balance = signedNet(row.closingDebit, row.closingCredit);
    return [
      codes.get(row.accountId) || row.accountCode,
      (names.get(row.accountId) || row.accountName).replace(/,/g, ' '),
      start,
      row.periodDebit,
      row.periodCredit,
      row.closingDebit,
      row.closingCredit,
      balance,
    ].join(',');
  });
  return [header, ...body].join('\n');
}

function rollupGroupRow(
  groupCode: string,
  detailRows: Array<{ account: LedgerAccount; row: TrialBalanceExtendedRow }>,
  codeLabel: (account: LedgerAccount) => string,
): TrialBalanceExtendedRow | null {
  const prefix = normalizeCode(groupCode);
  if (!prefix) return null;

  let openingDebit = 0;
  let openingCredit = 0;
  let periodDebit = 0;
  let periodCredit = 0;
  let closingDebit = 0;
  let closingCredit = 0;
  let found = false;

  for (const { account, row } of detailRows) {
    if (account.pcgKind === 'G') continue;
    const code = normalizeCode(codeLabel(account));
    if (!code.startsWith(prefix) || code.length <= prefix.length) continue;
    found = true;
    openingDebit += row.openingDebit;
    openingCredit += row.openingCredit;
    periodDebit += row.periodDebit;
    periodCredit += row.periodCredit;
    closingDebit += row.closingDebit;
    closingCredit += row.closingCredit;
  }

  if (!found) return null;
  return {
    accountId: `rollup-${prefix}`,
    accountCode: groupCode,
    accountName: '',
    accountType: 'asset',
    debit: closingDebit,
    credit: closingCredit,
    openingDebit: round2(openingDebit),
    openingCredit: round2(openingCredit),
    periodDebit: round2(periodDebit),
    periodCredit: round2(periodCredit),
    closingDebit: round2(closingDebit),
    closingCredit: round2(closingCredit),
  };
}

export default function TrialBalancePanel({
  accounts,
  entries,
  lines,
  asOfDate,
  loading,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  currencyCode = 'LBP',
  onRefresh,
  onOpenGl,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const clientByParentPcg = useMemo(() => buildClientByParentPcgMap(pcgClientAccounts), [pcgClientAccounts]);
  const currencyLabel = currencyCode.toUpperCase();

  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [startDate, setStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(() => asOfDate.slice(0, 10));
  const [fiscalYear, setFiscalYear] = useState(() => String(new Date().getFullYear()));
  const [report, setReport] = useState<TrialBalanceExtendedReport | null>(null);
  const [computing, setComputing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState<TbOptions>(DEFAULT_OPTIONS);
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [expandedTbNodes, setExpandedTbNodes] = useState<Set<string>>(() => new Set());

  const invalidateReport = () => {
    setSearchError(null);
    setReport(null);
  };

  useEffect(() => {
    const next = asOfDate.slice(0, 10);
    setEndDate((prev) => (prev === next ? prev : next));
  }, [asOfDate]);

  const accountLabel = (account: LedgerAccount) => {
    if (isLebaneseCoa) return formatPcgAccountLabel(account, accountingLanguage, clientByGrabio);
    return account.name;
  };

  const codeForRange = (account: LedgerAccount) => {
    if (isLebaneseCoa) return displayPcgCodeForLedgerRow(account, clientByGrabio, clientByParentPcg);
    return account.code;
  };

  const accountIdForCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return '';
    const match = accounts.find(
      (account) =>
        account.isActive &&
        (codeForRange(account) === trimmed || account.code === trimmed),
    );
    return match?.id ?? '';
  };

  const setFromAccountId = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    setFromCode(account ? codeForRange(account) : '');
    invalidateReport();
  };

  const setToAccountId = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    setToCode(account ? codeForRange(account) : '');
    invalidateReport();
  };

  const accountCodeLabel = (account: LedgerAccount) => {
    if (isLebaneseCoa) return displayPcgCodeForLedgerRow(account, clientByGrabio, clientByParentPcg);
    return account.code;
  };

  const flatDisplayRows = useMemo(() => {
    if (!report) return [];

    const byId = new Map(report.rows.map((row) => [row.accountId, row]));

    let pool = accountsInTrialBalanceRange(
      accounts,
      appliedFrom || fromCode,
      appliedTo || toCode,
      Boolean(isLebaneseCoa),
      clientByGrabio,
      clientByParentPcg,
      options.hideInactiveAccounts,
    );

    pool = pool.filter((account) => {
      const code = accountCodeLabel(account);
      const level = displayCodeLevel(code, account.pcgKind);
      const isAuxiliary = code.includes('-');
      const isGroup = account.pcgKind === 'G';

      if (isGroup) {
        if (level === 1 && !options.totalLevel1) return false;
        if (level === 2 && !options.totalLevel2) return false;
        if (level === 3 && !options.totalLevel3) return false;
        if (level === 4 && !options.totalLevel4) return false;
        if (!options.auxiliaryClassAccounts && level >= 3) return false;
      } else {
        if (isAuxiliary && !options.auxiliaryAccounts) return false;
        if (!isAuxiliary && !options.movableAccounts) return false;
      }

      return true;
    });

    if (!options.includeZeroBalance) {
      pool = pool.filter((a) => {
        const row = byId.get(a.id);
        if (a.pcgKind === 'G') return true;
        if (!row) return false;
        return rowHasActivity(row);
      });
    }

    pool.sort(
      (a, b) =>
        accountCodeNumeric(accountCodeLabel(a)) - accountCodeNumeric(accountCodeLabel(b)),
    );

    const baseRows = pool.map((account) => ({
      account,
      row: byId.get(account.id) || emptyExtendedRow(account),
    }));

    return baseRows.map(({ account, row }) => {
      if (account.pcgKind !== 'G') return { account, row };
      const rolled = rollupGroupRow(accountCodeLabel(account), baseRows, accountCodeLabel);
      return { account, row: rolled || row };
    });
  }, [
    accounts,
    appliedFrom,
    appliedTo,
    clientByGrabio,
    clientByParentPcg,
    fromCode,
    isLebaneseCoa,
    options.auxiliaryAccounts,
    options.auxiliaryClassAccounts,
    options.includeZeroBalance,
    options.movableAccounts,
    options.totalLevel1,
    options.totalLevel2,
    options.totalLevel3,
    options.totalLevel4,
    options.hideInactiveAccounts,
    report,
    toCode,
  ]);

  const hierarchyRoots = useMemo(() => {
    if (!report || !isLebaneseCoa) return [];
    const byId = new Map(report.rows.map((row) => [row.accountId, row]));
    return buildLebaneseTrialBalanceTree(
      accounts,
      byId,
      appliedFrom || fromCode,
      appliedTo || toCode,
      pcgClientAccounts,
      {
        hideInactiveAccounts: options.hideInactiveAccounts,
        includeZeroBalance: options.includeZeroBalance,
      },
    );
  }, [
    accounts,
    appliedFrom,
    appliedTo,
    fromCode,
    options.hideInactiveAccounts,
    isLebaneseCoa,
    options.includeZeroBalance,
    pcgClientAccounts,
    report,
    toCode,
  ]);

  useEffect(() => {
    if (!report || !isLebaneseCoa || hierarchyRoots.length === 0) return;
    setExpandedTbNodes(defaultExpandedTrialBalanceNodes(hierarchyRoots));
  }, [appliedFrom, appliedTo, report, isLebaneseCoa]);

  const displayRows = useMemo(() => {
    if (!report) return [];
    if (isLebaneseCoa) {
      if (hierarchyRoots.length === 0) return [];
      return flattenTrialBalanceTree(hierarchyRoots, expandedTbNodes).map((node) => ({
        account:
          node.account ||
          ({
            id: node.id,
            code: node.code,
            name: node.name,
            nameAr: node.nameAr,
            type: 'expense',
            normalBalance: 'debit',
            isActive: true,
            isSystem: false,
            openingBalance: 0,
            storeId: '',
            pcgKind: node.pcgKind,
          } as LedgerAccount),
        row: node.row,
        treeNode: node,
      }));
    }
    return flatDisplayRows.map((item) => ({ ...item, treeNode: undefined as TrialBalanceTreeNode | undefined }));
  }, [expandedTbNodes, flatDisplayRows, hierarchyRoots, isLebaneseCoa, report]);

  const toggleTbNode = (nodeId: string) => {
    setExpandedTbNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAllTbGroups = () => {
    setExpandedTbNodes(new Set(collectTrialBalanceTreeGroupIds(hierarchyRoots)));
  };

  const collapseAllTbGroups = () => {
    setExpandedTbNodes(defaultExpandedTrialBalanceNodes(hierarchyRoots));
  };

  const totals = useMemo(() => {
    return displayRows.reduce(
      (acc, { account, row, treeNode }) => {
        if (account.pcgKind === 'G' || treeNode?.isGroup) return acc;
        acc.starting += signedNet(row.openingDebit, row.openingCredit);
        acc.movementDebit += row.periodDebit;
        acc.movementCredit += row.periodCredit;
        acc.totalDebit += row.closingDebit;
        acc.totalCredit += row.closingCredit;
        acc.balance += signedNet(row.closingDebit, row.closingCredit);
        return acc;
      },
      { starting: 0, movementDebit: 0, movementCredit: 0, totalDebit: 0, totalCredit: 0, balance: 0 },
    );
  }, [displayRows]);

  const codeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const { account } of displayRows) map.set(account.id, accountCodeLabel(account));
    return map;
  }, [displayRows, clientByGrabio, clientByParentPcg, isLebaneseCoa]);

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const { account } of displayRows) map.set(account.id, accountLabel(account));
    return map;
  }, [accountingLanguage, clientByGrabio, displayRows, isLebaneseCoa]);

  const handleDisplay = () => {
    setSearchError(null);

    if (loading) {
      setSearchError('Ledger is still loading — wait a moment and try again.');
      return;
    }
    if (accounts.length === 0) {
      setSearchError('No ledger accounts loaded. Click Refresh in the toolbar, then try again.');
      return;
    }

    const from = fromCode.trim();
    const to = toCode.trim();

    const validationError = validateTrialBalanceInput(
      accounts,
      from,
      to,
      startDate,
      endDate,
      Boolean(isLebaneseCoa),
      clientByGrabio,
      clientByParentPcg,
    );
    if (validationError) {
      setSearchError(validationError);
      toast.error(validationError);
      setReport(null);
      return;
    }

    setComputing(true);
    try {
      const next = buildExtendedTrialBalance(accounts, entries, lines, {
        startDate,
        endDate,
        viewMode: '6col',
      });
      setAppliedFrom(from);
      setAppliedTo(to);
      setReport(next);
      setSearchError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not build trial balance.';
      setSearchError(message);
      toast.error(message);
      setReport(null);
    } finally {
      setComputing(false);
    }
  };

  const footerText = useMemo(() => {
    const from = (appliedFrom || fromCode.trim()) || '…';
    const to = (appliedTo || toCode.trim()) || '…';
    const year = fiscalYear || startDate.slice(0, 4);
    const filterParts: string[] = [];
    if (options.movableAccounts) filterParts.push('movable');
    if (options.auxiliaryClassAccounts) filterParts.push('auxiliary class accounts');
    if (options.auxiliaryAccounts) filterParts.push('auxiliary');
    const closingText = options.excludeClosingBalance ? 'Exclude closing balance' : 'Include closing balance';
    return `Accounts between ${from} and ${to}, Fiscal Year: ${year}, ${closingText} [ Filter : ${filterParts.join(' and ') || 'none' } ]`;
  }, [appliedFrom, appliedTo, endDate, fiscalYear, fromCode, options, startDate, toCode]);

  const exportCsv = () => {
    if (!report) return;
    downloadCsvText(
      `trial-balance-${startDate}-${endDate}.csv`,
      legacyTrialBalanceToCsv(
        displayRows.map((item) => item.row),
        codeMap,
        nameMap,
      ),
    );
  };

  const matchedPreview = useMemo(() => {
    if (!fromCode.trim() || !toCode.trim() || accounts.length === 0) return null;
    return accountsInTrialBalanceRange(
      accounts,
      fromCode,
      toCode,
      Boolean(isLebaneseCoa),
      clientByGrabio,
      clientByParentPcg,
      options.hideInactiveAccounts,
    ).length;
  }, [accounts, clientByGrabio, clientByParentPcg, fromCode, options.hideInactiveAccounts, isLebaneseCoa, toCode]);

  const colCount = 2 + visibleColumnCount(options) + 1;
  const amountColCount = visibleColumnCount(options);
  const canSearch = Boolean(fromCode.trim() && toCode.trim() && !loading && !computing);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50/80 pb-4">
        <CardTitle className="text-lg">Trial balance</CardTitle>
        <CardDescription>
          Account range · period. Use Refresh above to reload ledger data.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSearch) handleDisplay();
          }}
        >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label htmlFor="tb-from" className="text-xs font-medium text-slate-700">From account</label>
            <LedgerAccountCombobox
              accounts={accounts.filter((account) => account.isActive)}
              value={accountIdForCode(fromCode)}
              onValueChange={setFromAccountId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              placeholder="Select start account…"
              compactSelectedLabel
              className="bg-white font-mono"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tb-to" className="text-xs font-medium text-slate-700">To account</label>
            <LedgerAccountCombobox
              accounts={accounts.filter((account) => account.isActive)}
              value={accountIdForCode(toCode)}
              onValueChange={setToAccountId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              placeholder="Select end account…"
              compactSelectedLabel
              className="bg-white font-mono"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tb-start" className="text-xs font-medium text-slate-700">Period from</label>
            <Input
              id="tb-start"
              type="date"
              className="bg-white"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setFiscalYear(e.target.value.slice(0, 4));
                invalidateReport();
              }}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tb-end" className="text-xs font-medium text-slate-700">Period to</label>
            <Input
              id="tb-end"
              type="date"
              className="bg-white"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                invalidateReport();
              }}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tb-fy" className="text-xs font-medium text-slate-700">Fiscal year</label>
            <Input
              id="tb-fy"
              className="bg-white"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={!canSearch}
            data-allow-multi-click="true"
            className="h-9 min-w-[7.5rem] bg-[#316ac5] font-semibold uppercase tracking-wide text-white hover:bg-[#2a5dad]"
          >
            {computing ? 'Searching…' : 'Search'}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-allow-multi-click="true"
            className={cn('h-9', optionsOpen && 'ring-2 ring-[#316ac5]')}
            onClick={() => setOptionsOpen((open) => !open)}
          >
            {optionsOpen ? 'Hide options' : 'Options'}
          </Button>
          {report ? (
            <>
              <Button type="button" variant="outline" className="h-9" onClick={() => window.print()}>
                Print
              </Button>
              <Button type="button" variant="outline" className="h-9" onClick={exportCsv}>
                Export CSV
              </Button>
            </>
          ) : null}
          {!loading && accounts.length > 0 && matchedPreview != null ? (
            <span className="text-xs text-muted-foreground">{matchedPreview} accounts in range</span>
          ) : null}
          {loading ? <span className="text-xs text-muted-foreground">Loading ledger…</span> : null}
        </div>
        </form>

        {optionsOpen ? (
          <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <div>
                <p className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                  Columns ({currencyLabel})
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {ACTIVE_COLUMN_OPTIONS.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-400"
                        checked={options[item.key]}
                        onChange={(e) => setOptions((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                      />
                      <span className="leading-tight">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                  Rows
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {ACTIVE_ROW_OPTIONS.map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-400"
                        checked={options[item.key]}
                        onChange={(e) => setOptions((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                      />
                      <span className="leading-tight">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {isLebaneseCoa && report && hierarchyRoots.length > 0 ? (
                <div>
                  <p className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                    Account hierarchy
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={expandAllTbGroups}>
                      Expand all groups
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={collapseAllTbGroups}>
                      Collapse groups
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-300 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOptions(DEFAULT_OPTIONS)}>
                Reset defaults
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#316ac5] text-white hover:bg-[#2a5dad]"
                onClick={() => setOptionsOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : null}

        {searchError ? (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{searchError}</div>
        ) : null}
        {computing ? <p className="text-sm text-muted-foreground">Building trial balance…</p> : null}

        {report ? (
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-700">
              {footerText}
            </div>
            <div className="max-h-[min(36rem,70vh)] overflow-y-auto overflow-x-hidden rounded-md border border-slate-200">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[3.5rem]" />
                  <col />
                  {Array.from({ length: amountColCount }).map((_, index) => (
                    <col key={index} className="w-[4.5rem]" />
                  ))}
                  <col className="w-7" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[#316ac5]">
                  <tr className="border-[#2a5dad]">
                    <th className={TB_HEAD}>Acct</th>
                    <th className={TB_HEAD}>Name</th>
                    {options.startingDebit ? <th className={TB_NUM_HEAD}>St Dr</th> : null}
                    {options.startingCredit ? <th className={TB_NUM_HEAD}>St Cr</th> : null}
                    {options.startingBalanceLbp ? <th className={TB_NUM_HEAD}>St Bal</th> : null}
                    {options.movementDebitLbp ? <th className={TB_NUM_HEAD}>Mv Dr</th> : null}
                    {options.movementCreditLbp ? <th className={TB_NUM_HEAD}>Mv Cr</th> : null}
                    {options.movementBalanceLbp ? <th className={TB_NUM_HEAD}>Mv Bal</th> : null}
                    {options.totalDebitLbp ? <th className={TB_NUM_HEAD}>Tot Dr</th> : null}
                    {options.totalCreditLbp ? <th className={TB_NUM_HEAD}>Tot Cr</th> : null}
                    {options.totalBalanceLbp ? <th className={TB_NUM_HEAD}>Bal</th> : null}
                    <th className={TB_HEAD} />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className={`${TB_CELL} text-muted-foreground`}>
                        {isLebaneseCoa && hierarchyRoots.length === 0
                          ? 'No PCG accounts in this range. Try wider codes (e.g. 6010 → 6999) and Search again.'
                          : 'No accounts with activity in this range and period.'}
                      </td>
                    </tr>
                  ) : null}
                  {displayRows.map(({ account, row, treeNode }) => {
                    const code = formatDisplayAccountCode(
                      treeNode?.code || accountCodeLabel(account),
                    );
                    const level = displayCodeLevel(code, treeNode?.pcgKind || account.pcgKind);
                    const isGroup = Boolean(treeNode?.isGroup || account.pcgKind === 'G');
                    const hasChildren = Boolean(treeNode?.hasChildren);
                    const isExpanded = treeNode ? expandedTbNodes.has(treeNode.id) : false;
                    const start = formatLegacyAmount(signedNet(row.openingDebit, row.openingCredit), currencyCode);
                    const movementBal = formatLegacyAmount(signedNet(row.periodDebit, row.periodCredit), currencyCode);
                    const balance = formatLegacyAmount(signedNet(row.closingDebit, row.closingCredit), currencyCode);
                    const name = treeNode?.name || accountLabel(account);
                    const rowKey = treeNode?.id || row.accountId;
                    return (
                      <tr key={rowKey} className={cn('border-b', tbRowClass(level, isGroup))}>
                        <td className={`${TB_CELL} font-mono text-[10px] leading-tight`} title={code}>
                          <div className="flex items-start gap-0.5">
                            {hasChildren ? (
                              <button
                                type="button"
                                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600"
                                aria-label={isExpanded ? 'Collapse account group' : 'Expand account group'}
                                onClick={() => treeNode && toggleTbNode(treeNode.id)}
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </button>
                            ) : (
                              <span className="inline-block h-4 w-4 shrink-0" />
                            )}
                            <span>{code}</span>
                          </div>
                        </td>
                        <td
                          className={`${TB_CELL} truncate text-[11px] leading-snug`}
                          title={name}
                          style={{ paddingLeft: `${8 + (treeNode?.depth || 0) * 14}px` }}
                        >
                          {name}
                        </td>
                        {options.startingDebit ? <td className={TB_NUM_CELL}>{tbAmountCell(row.openingDebit, currencyCode)}</td> : null}
                        {options.startingCredit ? <td className={TB_NUM_CELL}>{tbAmountCell(row.openingCredit, currencyCode)}</td> : null}
                        {options.startingBalanceLbp ? (
                          <td className={cn(TB_NUM_CELL, start.negative && 'text-red-700')}>{start.text}</td>
                        ) : null}
                        {options.movementDebitLbp ? <td className={TB_NUM_CELL}>{tbAmountCell(row.periodDebit, currencyCode)}</td> : null}
                        {options.movementCreditLbp ? <td className={TB_NUM_CELL}>{tbAmountCell(row.periodCredit, currencyCode)}</td> : null}
                        {options.movementBalanceLbp ? (
                          <td className={cn(TB_NUM_CELL, movementBal.negative && 'text-red-700')}>{movementBal.text}</td>
                        ) : null}
                        {options.totalDebitLbp ? <td className={TB_NUM_CELL}>{tbAmountCell(row.closingDebit, currencyCode)}</td> : null}
                        {options.totalCreditLbp ? <td className={TB_NUM_CELL}>{tbAmountCell(row.closingCredit, currencyCode)}</td> : null}
                        {options.totalBalanceLbp ? (
                          <td className={cn(TB_NUM_CELL, 'font-semibold', balance.negative && 'text-red-700')}>
                            {balance.text}
                          </td>
                        ) : null}
                        <td className="px-0 py-1 text-center">
                          {!isGroup && onOpenGl && account.id && !account.id.startsWith('pcg:') && !account.id.startsWith('class:') ? (
                            <button type="button" className="text-[10px] text-[#2a5dad] hover:underline" onClick={() => onOpenGl(account.id)}>
                              GL
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-semibold">
                    <td colSpan={2} className={TB_CELL}>
                      Totals
                    </td>
                    {options.startingDebit ? (
                      <td className={TB_NUM_CELL}>
                        {tbAmountCell(displayRows.reduce((s, { account, row, treeNode }) => ((treeNode?.isGroup || account.pcgKind === 'G') ? s : s + row.openingDebit), 0), currencyCode)}
                      </td>
                    ) : null}
                    {options.startingCredit ? (
                      <td className={TB_NUM_CELL}>
                        {tbAmountCell(displayRows.reduce((s, { account, row, treeNode }) => ((treeNode?.isGroup || account.pcgKind === 'G') ? s : s + row.openingCredit), 0), currencyCode)}
                      </td>
                    ) : null}
                    {options.startingBalanceLbp ? (
                      <td className={cn(TB_NUM_CELL, totals.starting < 0 && 'text-red-700')}>
                        {formatLegacyAmount(totals.starting, currencyCode).text}
                      </td>
                    ) : null}
                    {options.movementDebitLbp ? (
                      <td className={TB_NUM_CELL}>{tbAmountCell(totals.movementDebit, currencyCode)}</td>
                    ) : null}
                    {options.movementCreditLbp ? (
                      <td className={TB_NUM_CELL}>{tbAmountCell(totals.movementCredit, currencyCode)}</td>
                    ) : null}
                    {options.movementBalanceLbp ? (
                      <td className={cn(TB_NUM_CELL, totals.movementDebit - totals.movementCredit < 0 && 'text-red-700')}>
                        {formatLegacyAmount(totals.movementDebit - totals.movementCredit, currencyCode).text}
                      </td>
                    ) : null}
                    {options.totalDebitLbp ? (
                      <td className={TB_NUM_CELL}>{tbAmountCell(totals.totalDebit, currencyCode)}</td>
                    ) : null}
                    {options.totalCreditLbp ? (
                      <td className={TB_NUM_CELL}>{tbAmountCell(totals.totalCredit, currencyCode)}</td>
                    ) : null}
                    {options.totalBalanceLbp ? (
                      <td className={cn(TB_NUM_CELL, totals.balance < 0 && 'text-red-700')}>
                        {formatLegacyAmount(totals.balance, currencyCode).text}
                      </td>
                    ) : null}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-muted-foreground">
            Enter From/To accounts and period, then click Search.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
