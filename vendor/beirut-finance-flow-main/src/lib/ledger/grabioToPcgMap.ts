import { supportsArabicEntry, type AccountingLanguage } from '@/lib/grabio/accountingMode';
import { LEBANESE_PCG_CHART, type LebanesePcgAccount } from '@/lib/ledger/lebanesePcgChart.generated';
import type { PcgClientAccount } from '@/types/generalLedger';

/** Grabio 3-digit operational code → PCG detail account (display / reports; posting unchanged). */
export const GRABIO_TO_PCG_CODE: Record<string, string> = {
  '101': '5300',
  '102': '5300',
  '103': '5110',
  '105': '5121',
  '106': '5121',
  '108': '5122',
  '110': '4111',
  '112': '4910',
  '120': '3110',
  '121': '3550',
  '122': '3700',
  '123': '3310',
  '125': '3150',
  '130': '4720',
  '135': '4810',
  '140': '4426.6000000000004',
  '142': '4281',
  '150': '2210',
  '151': '2810',
  '155': '2240',
  '156': '2840',
  '201': '4011',
  '202': '4210',
  '210': '4211',
  '212': '4311',
  '213': '4410',
  '220': '4427',
  '222': '4425',
  '250': '1552.1',
  '252': '1610',
  '301': '1013',
  '302': '1030',
  '303': '1250',
  '304': '1210',
  '305': '1380',
  '401': '7010',
  '402': '7010',
  '403': '7130',
  '405': '7171',
  '410': '7090',
  '450': '7751',
  '455': '7789',
  '501': '6111',
  '502': '6011',
  '503': '6211',
  '505': '6113',
  '506': '6018',
  '601': '6311',
  '602': '6351',
  '604': '6355',
  '610': '6263.1',
  '612': '6263.4',
  '613': '6263.5',
  '615': '6269.4',
  '616': '6262.2',
  '620': '6261.5',
  '622': '6269.9',
  '630': '6269.9',
  '650': '6265.1',
  '653': '6264.1',
  '655': '6266.1',
  '701': '6739',
  '704': '6751',
  '710': '6811',
  '713': '6612',
  '799': '6269.9',
  /** Synthetic balance-sheet line (current-year P&L in equity). */
  '3999': '1380',
};

const pcgByCode = new Map<string, LebanesePcgAccount>(
  LEBANESE_PCG_CHART.map((row) => [row.code, row]),
);

export type PcgDisplayAccount = {
  grabioCode: string;
  pcgCode: string;
  name: string;
  nameAr: string;
  currency: 'LL' | 'USD';
};

export function mapGrabioCodeToPcg(grabioCode: string): string | undefined {
  return GRABIO_TO_PCG_CODE[String(grabioCode || '').trim()];
}

export function buildClientByGrabioMap(
  accounts: PcgClientAccount[],
): Map<string, PcgClientAccount> {
  const map = new Map<string, PcgClientAccount>();
  for (const row of accounts) {
    const key = String(row.grabioOperationalCode || '').trim();
    if (key) map.set(key, row);
  }
  return map;
}

export function resolvePcgDisplay(
  grabioCode: string,
  fallbackName?: string,
  clientByGrabio?: ReadonlyMap<string, PcgClientAccount>,
): PcgDisplayAccount | null {
  const code = String(grabioCode || '').trim();
  const client = clientByGrabio?.get(code);
  const pcgCode = client?.clientCode || mapGrabioCodeToPcg(code);
  if (!pcgCode) return null;

  const templateCode = client ? mapGrabioCodeToPcg(code) : pcgCode;
  const pcg = templateCode ? pcgByCode.get(templateCode) : pcgByCode.get(pcgCode);
  return {
    grabioCode: code,
    pcgCode,
    name: client?.name || pcg?.name || fallbackName || code,
    nameAr: client?.nameAr || pcg?.nameAr || '',
    currency: client?.currency || pcg?.currency || 'LL',
  };
}

export function mappedPcgCodes(): Set<string> {
  return new Set(Object.values(GRABIO_TO_PCG_CODE));
}

/** PCG / client code shown in Lebanese mode (falls back to Grabio code). */
export function displayPcgCode(
  grabioCode: string,
  clientByGrabio?: ReadonlyMap<string, PcgClientAccount>,
): string {
  return resolvePcgDisplay(grabioCode, undefined, clientByGrabio)?.pcgCode ?? String(grabioCode || '').trim();
}

/** Dropdown / select label using PCG code + Excel chart name in Lebanese mode. */
export function formatPcgAccountLabel(
  account: { code: string; name: string; nameAr?: string },
  language?: AccountingLanguage,
  clientByGrabio?: ReadonlyMap<string, PcgClientAccount>,
): string {
  const display = resolvePcgDisplay(account.code, account.name, clientByGrabio);
  const code = display?.pcgCode ?? account.code;
  const name = display?.name ?? account.name;
  const nameAr = display?.nameAr ?? account.nameAr;
  if (supportsArabicEntry(language) && nameAr) {
    return `${code} — ${name} / ${nameAr}`;
  }
  return `${code} — ${name}`;
}

/** Inline reference, e.g. "4111 · Accounts Receivable". */
export function formatGlAccountReference(
  grabioCode: string,
  fallbackName?: string,
  clientByGrabio?: ReadonlyMap<string, PcgClientAccount>,
): string {
  const display = resolvePcgDisplay(grabioCode, fallbackName, clientByGrabio);
  if (!display) return grabioCode;
  return `${display.pcgCode} · ${display.name}`;
}

/** Replace Grabio code in cash-flow line labels with PCG code + name. */
export function remapCashFlowLineLabel(
  line: { label: string; accountCode?: string },
  accountName: string | undefined,
  clientByGrabio?: ReadonlyMap<string, PcgClientAccount>,
): string {
  if (!line.accountCode) return line.label;
  const display = resolvePcgDisplay(line.accountCode, accountName, clientByGrabio);
  if (!display) return line.label;
  const grabioToken = `${line.accountCode} ${accountName || ''}`.trim();
  const pcgToken = `${display.pcgCode} ${display.name}`.trim();
  if (line.label.includes(grabioToken)) {
    return line.label.replace(grabioToken, pcgToken);
  }
  return line.label.replace(line.accountCode, display.pcgCode);
}
