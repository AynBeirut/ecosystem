import type { LebanesePcgAccount } from '@/lib/ledger/lebanesePcgChart.generated';

export type PcgTreeRow = LebanesePcgAccount & {
  depth: number;
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
