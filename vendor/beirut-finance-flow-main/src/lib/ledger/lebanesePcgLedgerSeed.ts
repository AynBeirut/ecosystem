import { LEBANESE_PCG_CHART, type LebanesePcgAccount, type PcgAccountKind } from '@/lib/ledger/lebanesePcgChart.generated';
import type { CoaSeedRow } from '@/lib/ledger/coaTemplates';

function pcgClassType(code: string): CoaSeedRow['type'] {
  const head = parseInt(String(code).split('.')[0], 10);
  if (Number.isNaN(head)) return 'expense';
  if (head >= 1010 && head < 2000) return 'equity';
  if (head >= 2000 && head < 3000) return 'asset';
  if (head >= 3000 && head < 4000) return 'asset';
  if (head >= 4000 && head < 5000) {
    if (head >= 4110 && head < 4300) return 'asset';
    return 'liability';
  }
  if (head >= 5000 && head < 6000) return 'asset';
  if (head >= 6000 && head < 7000) return 'expense';
  if (head >= 7000 && head < 8000) return 'revenue';
  if (head >= 60 && head < 100) return 'expense';
  return 'expense';
}

function normalBalanceForPcg(row: LebanesePcgAccount): CoaSeedRow['normalBalance'] {
  if (row.kind === 'C') return 'credit';
  if (row.kind === 'D') return 'debit';
  const type = pcgClassType(row.code);
  if (type === 'asset' || type === 'expense') return 'debit';
  return 'credit';
}

function isPcgHeader(kind: PcgAccountKind): boolean {
  return kind === 'G';
}

/** Full Excel PCG chart as inactive header + active detail ledger seed rows. */
export function buildLebanesePcgCoaSeedRows(): CoaSeedRow[] {
  return LEBANESE_PCG_CHART.map((row) => ({
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    type: pcgClassType(row.code),
    normalBalance: normalBalanceForPcg(row),
    defaultActive: !isPcgHeader(row.kind),
    parentCode: row.parentCode,
    pcgKind: row.kind,
    currency: row.currency,
    isPcgChart: true,
  }));
}

export const LEBANESE_PCG_CHART_ACCOUNT_COUNT = LEBANESE_PCG_CHART.length;
