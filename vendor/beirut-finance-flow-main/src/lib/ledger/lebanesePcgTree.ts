import type { LebanesePcgAccount } from '@/lib/ledger/lebanesePcgChart.generated';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';
import { mapPcgCodeToGrabioCodes } from '@/lib/ledger/grabioToPcgMap';

export type PcgTreeRow = LebanesePcgAccount & {
  depth: number;
};

export type PcgTreeNode = {
  id: string;
  kind: 'pcg' | 'client';
  code: string;
  name: string;
  nameAr: string;
  pcgKind: LebanesePcgAccount['kind'];
  currency: 'LL' | 'USD';
  children: PcgTreeNode[];
  /** Underlying PCG row for "Add account here". */
  pcgAccount?: LebanesePcgAccount;
  clientAccount?: PcgClientAccount;
};

export function depthForAccount(account: LebanesePcgAccount, byCode: Map<string, LebanesePcgAccount>): number {
  let depth = 0;
  let parent = account.parentCode;
  const seen = new Set<string>();
  while (parent) {
    if (seen.has(parent)) break;
    seen.add(parent);
    depth += 1;
    parent = byCode.get(parent)?.parentCode;
  }
  return depth;
}

export function flattenPcgChart(chart: LebanesePcgAccount[]): PcgTreeRow[] {
  const byCode = new Map(chart.map((a) => [a.code, a]));
  return chart
    .map((a) => ({ ...a, depth: depthForAccount(a, byCode) }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function filterPcgChart(chart: LebanesePcgAccount[], query: string): LebanesePcgAccount[] {
  const q = query.trim().toLowerCase();
  if (!q) return chart;
  const hits = new Set<string>();
  const byCode = new Map(chart.map((a) => [a.code, a]));
  for (const row of chart) {
    const hay = `${row.code} ${row.name} ${row.nameAr}`.toLowerCase();
    if (!hay.includes(q)) continue;
    hits.add(row.code);
    let parent = row.parentCode;
    while (parent) {
      hits.add(parent);
      parent = byCode.get(parent)?.parentCode;
    }
  }
  return chart.filter((r) => hits.has(r.code));
}

export function kindLabel(kind: LebanesePcgAccount['kind']): string {
  switch (kind) {
    case 'G':
      return 'G';
    case 'D':
      return 'D';
    case 'C':
      return 'C';
    case 'NA':
      return 'N/A';
    case 'CD':
      return 'C/D';
    default:
      return kind;
  }
}

/** Legacy ERP type suffix shown after class / group names. */
export function pcgClassSuffix(code: string): string {
  const head = String(code || '').trim().charAt(0);
  if (head === '6') return '[ E ]';
  if (head === '7') return '[ I ]';
  return '';
}

function inferPcgParentCode(code: string, byCode: Map<string, LebanesePcgAccount>): string | undefined {
  let best = '';
  for (const candidate of byCode.keys()) {
    if (candidate === code) continue;
    if (!code.startsWith(candidate)) continue;
    if (candidate.length <= best.length) continue;
    const row = byCode.get(candidate);
    if (row?.kind === 'G') best = candidate;
  }
  return best || undefined;
}

function pcgClassDigit(code: string): string | undefined {
  const digit = String(code || '').trim().charAt(0);
  return digit >= '1' && digit <= '7' ? digit : undefined;
}

const PCG_CLASS_LABELS: Record<string, string> = {
  '1': 'Equity & long term debts',
  '2': 'Accounts of fixed assets',
  '3': 'Inventory and goods in process',
  '4': 'Receivables & payables',
  '5': 'Financial accounts',
  '6': 'Expenditure',
  '7': 'Income',
};

function effectiveParentCode(row: LebanesePcgAccount, byCode: Map<string, LebanesePcgAccount>): string | undefined {
  const explicit = String(row.parentCode || '').trim();
  if (explicit && byCode.has(explicit)) return explicit;

  const code = String(row.code || '').trim();
  // Lebanese PCG detail lines (6011…) roll up under their 4-digit group header (6010).
  if (/^\d{4,}$/.test(code) && !code.endsWith('0')) {
    const groupCode = `${code.slice(0, 3)}0`;
    const group = byCode.get(groupCode);
    if (group?.kind === 'G') return groupCode;
  }

  const inferred = inferPcgParentCode(code, byCode);
  if (inferred) return inferred;
  return pcgClassDigit(code);
}

export function buildPcgTree(
  chart: LebanesePcgAccount[],
  clientAccounts: PcgClientAccount[] = [],
): PcgTreeNode[] {
  const byCode = new Map(chart.map((row) => [row.code, row]));
  const childrenByParent = new Map<string, LebanesePcgAccount[]>();

  for (const row of chart) {
    const parent = effectiveParentCode(row, byCode);
    if (!parent) continue;
    const list = childrenByParent.get(parent) || [];
    list.push(row);
    childrenByParent.set(parent, list);
  }

  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }

  const clientByParent = new Map<string, PcgClientAccount[]>();
  for (const client of clientAccounts) {
    const parent = String(client.parentPcgCode || '').trim();
    if (!parent) continue;
    const list = clientByParent.get(parent) || [];
    list.push(client);
    clientByParent.set(parent, list);
  }
  for (const list of clientByParent.values()) {
    list.sort((a, b) => a.clientCode.localeCompare(b.clientCode, undefined, { numeric: true }));
  }

  function buildPcgNode(row: LebanesePcgAccount): PcgTreeNode {
    const pcgChildren = (childrenByParent.get(row.code) || []).map(buildPcgNode);
    const clientChildren: PcgTreeNode[] = (clientByParent.get(row.code) || []).map((client) => ({
      id: `client:${client.id}`,
      kind: 'client' as const,
      code: client.clientCode,
      name: client.name || row.name,
      nameAr: client.nameAr || row.nameAr,
      pcgKind: row.kind,
      currency: client.currency || row.currency,
      children: [],
      pcgAccount: row,
      clientAccount: client,
    }));
    return {
      id: `pcg:${row.code}`,
      kind: 'pcg',
      code: row.code,
      name: row.name,
      nameAr: row.nameAr,
      pcgKind: row.kind,
      currency: row.currency,
      children: [...pcgChildren, ...clientChildren],
      pcgAccount: row,
    };
  }

  const classRoots: PcgTreeNode[] = Object.entries(PCG_CLASS_LABELS)
    .map(([digit, name]) => {
      const directChildren = (childrenByParent.get(digit) || []).map(buildPcgNode);
      if (!directChildren.length) return null;
      return {
        id: `class:${digit}`,
        kind: 'pcg' as const,
        code: digit,
        name,
        nameAr: '',
        pcgKind: 'G' as const,
        currency: 'LL' as const,
        children: directChildren,
      };
    })
    .filter(Boolean) as PcgTreeNode[];

  const orphanRows = chart.filter((row) => !effectiveParentCode(row, byCode));
  orphanRows.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return [...classRoots, ...orphanRows.map(buildPcgNode)];
}

/** PCG row used to prefill "Add working account" — class roots 1–7 or detail accounts. */
export function pcgAddTargetFromNode(node: PcgTreeNode): LebanesePcgAccount | null {
  if (node.id.startsWith('class:')) {
    return {
      code: node.code,
      name: node.name,
      nameAr: node.nameAr || '',
      kind: 'G',
      currency: node.currency,
    };
  }
  if (node.pcgAccount && node.pcgKind !== 'G') {
    return node.pcgAccount;
  }
  return null;
}

export function nodeCanAddClientAccount(node: PcgTreeNode): boolean {
  return pcgAddTargetFromNode(node) !== null;
}

export function flattenPcgTree(nodes: PcgTreeNode[]): PcgTreeNode[] {
  const out: PcgTreeNode[] = [];
  const walk = (list: PcgTreeNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function collectPcgTreeNodeIds(nodes: PcgTreeNode[]): Set<string> {
  return new Set(flattenPcgTree(nodes).map((node) => node.id));
}

export function filterPcgTree(nodes: PcgTreeNode[], query: string): PcgTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  function matches(node: PcgTreeNode): boolean {
    const hay = `${node.code} ${node.name} ${node.nameAr}`.toLowerCase();
    return hay.includes(q);
  }

  function prune(list: PcgTreeNode[]): PcgTreeNode[] {
    return list
      .map((node) => {
        const childMatches = prune(node.children);
        if (matches(node) || childMatches.length) {
          return { ...node, children: childMatches.length ? childMatches : node.children };
        }
        return null;
      })
      .filter(Boolean) as PcgTreeNode[];
  }

  return prune(nodes);
}

export function resolveLedgerAccountIdsForPcgNode(
  node: PcgTreeNode,
  ledgerAccounts: LedgerAccount[],
): string[] {
  const ids = new Set<string>();
  const active = ledgerAccounts.filter((a) => a.isActive);

  const addForPcgCode = (pcgCode: string) => {
    for (const account of active) {
      if (account.isPcgChart && account.code === pcgCode) {
        ids.add(account.id);
      }
    }
    for (const grabioCode of mapPcgCodeToGrabioCodes(pcgCode)) {
      const operational = active.find((a) => !a.isPcgChart && a.code === grabioCode);
      if (operational) ids.add(operational.id);
    }
  };

  const walk = (current: PcgTreeNode) => {
    if (current.kind === 'client') {
      const grabio = String(current.clientAccount?.grabioOperationalCode || '').trim();
      const hit = active.find((a) => a.code === grabio);
      if (hit) ids.add(hit.id);
      return;
    }
    if (current.pcgKind === 'D' || current.pcgKind === 'C' || current.pcgKind === 'CD') {
      addForPcgCode(current.code);
      return;
    }
    for (const child of current.children) walk(child);
  };

  walk(node);
  return [...ids];
}

export function findPcgTreeNode(nodes: PcgTreeNode[], nodeId: string): PcgTreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const nested = findPcgTreeNode(node.children, nodeId);
    if (nested) return nested;
  }
  return null;
}
