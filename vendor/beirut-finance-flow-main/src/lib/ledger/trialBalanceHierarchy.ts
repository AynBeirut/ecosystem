import { LEBANESE_PCG_CHART, type LebanesePcgAccount } from '@/lib/ledger/lebanesePcgChart.generated';
import {
  buildPcgTree,
  resolveLedgerAccountIdsForPcgNode,
  type PcgTreeNode,
} from '@/lib/ledger/lebanesePcgTree';
import { isAccountInCodeRange } from '@/lib/ledger/accountCodeRange';
import { displayPcgCodeForLedgerRow } from '@/lib/ledger/grabioToPcgMap';
import type {
  LedgerAccount,
  PcgClientAccount,
  TrialBalanceExtendedRow,
} from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type TrialBalanceTreeNode = {
  id: string;
  depth: number;
  code: string;
  name: string;
  nameAr?: string;
  isGroup: boolean;
  hasChildren: boolean;
  pcgKind?: string;
  account?: LedgerAccount;
  row: TrialBalanceExtendedRow;
  children: TrialBalanceTreeNode[];
};

export function emptyExtendedRow(account: Pick<LedgerAccount, 'id' | 'code' | 'name' | 'type'>): TrialBalanceExtendedRow {
  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    accountType: account.type,
    debit: 0,
    credit: 0,
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    closingDebit: 0,
    closingCredit: 0,
  };
}

export function rowHasActivity(row: TrialBalanceExtendedRow): boolean {
  return (
    row.openingDebit > 0 ||
    row.openingCredit > 0 ||
    row.periodDebit > 0 ||
    row.periodCredit > 0 ||
    row.closingDebit > 0 ||
    row.closingCredit > 0
  );
}

function sumExtendedRows(rows: TrialBalanceExtendedRow[], fallback: TrialBalanceExtendedRow): TrialBalanceExtendedRow {
  if (rows.length === 0) return fallback;
  if (rows.length === 1) return rows[0];
  const totals = rows.reduce(
    (acc, row) => {
      acc.openingDebit += row.openingDebit;
      acc.openingCredit += row.openingCredit;
      acc.periodDebit += row.periodDebit;
      acc.periodCredit += row.periodCredit;
      acc.closingDebit += row.closingDebit;
      acc.closingCredit += row.closingCredit;
      return acc;
    },
    {
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 0,
      periodCredit: 0,
      closingDebit: 0,
      closingCredit: 0,
    },
  );
  return {
    ...fallback,
    openingDebit: round2(totals.openingDebit),
    openingCredit: round2(totals.openingCredit),
    periodDebit: round2(totals.periodDebit),
    periodCredit: round2(totals.periodCredit),
    closingDebit: round2(totals.closingDebit),
    closingCredit: round2(totals.closingCredit),
    debit: round2(totals.closingDebit),
    credit: round2(totals.closingCredit),
  };
}

function filterPcgChartByAccountRange(
  chart: LebanesePcgAccount[],
  fromCode: string,
  toCode: string,
): LebanesePcgAccount[] {
  const from = fromCode.trim();
  const to = toCode.trim();
  if (!from || !to) return chart;

  const byCode = new Map(chart.map((row) => [row.code, row]));
  const hits = new Set<string>();

  const mark = (code: string) => {
    if (!code || hits.has(code)) return;
    hits.add(code);
    const row = byCode.get(code);
    if (!row) return;
    const classDigit = code.charAt(0);
    if (classDigit >= '1' && classDigit <= '7') hits.add(classDigit);
    if (row.parentCode && byCode.has(row.parentCode)) mark(row.parentCode);
    for (let len = code.length - 1; len >= 1; len -= 1) {
      const prefix = code.slice(0, len);
      const parent = byCode.get(prefix);
      if (parent?.kind === 'G') mark(prefix);
    }
  };

  for (const row of chart) {
    if (isAccountInCodeRange(row.code, from, to)) mark(row.code);
  }

  return chart.filter((row) => hits.has(row.code));
}

function filterClientAccountsByRange(
  clients: PcgClientAccount[],
  fromCode: string,
  toCode: string,
): PcgClientAccount[] {
  const from = fromCode.trim();
  const to = toCode.trim();
  if (!from || !to) return clients;
  return clients.filter((row) => isAccountInCodeRange(String(row.clientCode || ''), from, to));
}

function ledgerPoolMatchesRange(
  account: LedgerAccount,
  fromCode: string,
  toCode: string,
  clientByGrabio: Map<string, PcgClientAccount>,
  clientByParentPcg: Map<string, PcgClientAccount[]>,
): boolean {
  const displayCode = displayPcgCodeForLedgerRow(account, clientByGrabio, clientByParentPcg);
  return (
    isAccountInCodeRange(displayCode, fromCode, toCode) ||
    isAccountInCodeRange(account.code, fromCode, toCode)
  );
}

function resolvePrimaryLedgerAccount(
  ids: string[],
  accountsById: Map<string, LedgerAccount>,
): LedgerAccount | undefined {
  for (const id of ids) {
    const account = accountsById.get(id);
    if (account) return account;
  }
  return undefined;
}

function buildNodeRow(
  node: PcgTreeNode,
  accounts: LedgerAccount[],
  rowByAccountId: Map<string, TrialBalanceExtendedRow>,
  childRows: TrialBalanceExtendedRow[],
): TrialBalanceExtendedRow {
  const fallback = emptyExtendedRow({
    id: node.id,
    code: node.code,
    name: node.name,
    type: 'expense',
  });

  if (node.pcgKind === 'G' || node.id.startsWith('class:')) {
    return sumExtendedRows(childRows, fallback);
  }

  const ids = resolveLedgerAccountIdsForPcgNode(node, accounts);
  const directRows = ids
    .map((id) => rowByAccountId.get(id))
    .filter((row): row is TrialBalanceExtendedRow => Boolean(row));
  const primary = resolvePrimaryLedgerAccount(ids, new Map(accounts.map((a) => [a.id, a])));
  if (primary) {
    fallback.accountId = primary.id;
    fallback.accountCode = primary.code;
    fallback.accountName = primary.name;
  }
  return sumExtendedRows(directRows, fallback);
}

function pruneTreeNode(
  node: TrialBalanceTreeNode,
  includeZeroBalance: boolean,
): TrialBalanceTreeNode | null {
  const prunedChildren = node.children
    .map((child) => pruneTreeNode(child, includeZeroBalance))
    .filter((child): child is TrialBalanceTreeNode => Boolean(child));

  const hasVisibleChildren = prunedChildren.length > 0;
  const keepSelf = includeZeroBalance || rowHasActivity(node.row) || (node.isGroup && hasVisibleChildren);
  if (!keepSelf && !hasVisibleChildren) return null;

  return { ...node, children: prunedChildren, hasChildren: prunedChildren.length > 0 };
}

function buildTreeNode(
  node: PcgTreeNode,
  accounts: LedgerAccount[],
  rowByAccountId: Map<string, TrialBalanceExtendedRow>,
  hideInactiveAccounts: boolean,
): TrialBalanceTreeNode | null {
  const childNodes = node.children
    .map((child) => buildTreeNode(child, accounts, rowByAccountId, hideInactiveAccounts))
    .filter((child): child is TrialBalanceTreeNode => Boolean(child));

  const isGroup = node.pcgKind === 'G' || node.id.startsWith('class:') || childNodes.length > 0;
  const ids = resolveLedgerAccountIdsForPcgNode(node, accounts);
  const primary = resolvePrimaryLedgerAccount(ids, new Map(accounts.map((a) => [a.id, a])));

  if (!isGroup && hideInactiveAccounts && primary && primary.isActive === false) {
    return null;
  }

  const row = buildNodeRow(
    node,
    accounts,
    rowByAccountId,
    childNodes.map((child) => child.row),
  );

  return {
    id: node.id,
    depth: 0,
    code: node.code,
    name: node.name,
    nameAr: node.nameAr,
    isGroup,
    hasChildren: childNodes.length > 0,
    pcgKind: node.pcgKind,
    account: primary,
    row,
    children: childNodes,
  };
}

export function buildLebaneseTrialBalanceTree(
  accounts: LedgerAccount[],
  rowByAccountId: Map<string, TrialBalanceExtendedRow>,
  fromCode: string,
  toCode: string,
  pcgClientAccounts: PcgClientAccount[],
  options: {
    hideInactiveAccounts: boolean;
    includeZeroBalance: boolean;
  },
): TrialBalanceTreeNode[] {
  const clientByGrabio = new Map(
    pcgClientAccounts
      .filter((row) => row.grabioOperationalCode)
      .map((row) => [String(row.grabioOperationalCode), row]),
  );
  const clientByParentPcg = new Map<string, PcgClientAccount[]>();
  for (const row of pcgClientAccounts) {
    const parent = String(row.parentPcgCode || '').trim();
    if (!parent) continue;
    const list = clientByParentPcg.get(parent) || [];
    list.push(row);
    clientByParentPcg.set(parent, list);
  }

  const pool = accounts.filter((account) => {
    if (options.hideInactiveAccounts && account.isActive === false) return false;
    return ledgerPoolMatchesRange(account, fromCode, toCode, clientByGrabio, clientByParentPcg);
  });

  const filteredChart = filterPcgChartByAccountRange(LEBANESE_PCG_CHART, fromCode, toCode);
  const filteredClients = filterClientAccountsByRange(pcgClientAccounts, fromCode, toCode);
  const roots = buildPcgTree(filteredChart, filteredClients);

  return roots
    .map((node) => buildTreeNode(node, pool, rowByAccountId, options.hideInactiveAccounts))
    .map((node) => (node ? pruneTreeNode(node, options.includeZeroBalance) : null))
    .filter((node): node is TrialBalanceTreeNode => Boolean(node));
}

export function defaultExpandedTrialBalanceNodes(roots: TrialBalanceTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: TrialBalanceTreeNode[]) => {
    for (const node of nodes) {
      if (node.isGroup && node.id.startsWith('class:')) ids.add(node.id);
      if (node.children.length) walk(node.children);
    }
  };
  walk(roots);
  return ids;
}

export function flattenTrialBalanceTree(
  roots: TrialBalanceTreeNode[],
  expandedIds: Set<string>,
  depth = 0,
): TrialBalanceTreeNode[] {
  const out: TrialBalanceTreeNode[] = [];
  for (const node of roots) {
    out.push({ ...node, depth });
    if (node.hasChildren && expandedIds.has(node.id)) {
      out.push(...flattenTrialBalanceTree(node.children, expandedIds, depth + 1));
    }
  }
  return out;
}

export function collectTrialBalanceTreeGroupIds(roots: TrialBalanceTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: TrialBalanceTreeNode[]) => {
    for (const node of nodes) {
      if (node.hasChildren) ids.push(node.id);
      if (node.children.length) walk(node.children);
    }
  };
  walk(roots);
  return ids;
}
