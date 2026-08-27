import { formatMoney } from '@/lib/money/format';
import {
  convertLedgerAmount,
  normalizeLedgerCurrency,
  type ReportCurrencyMode,
} from '@/lib/ledger/formatLedgerAmount';
import type { GeneralLedgerReportRow } from '@/types/generalLedger';

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function integerToWords(n: number): string {
  if (n === 0) return 'zero';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) {
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${integerToWords(rest)}` : ''}`;
  }
  if (n < 1_000_000) {
    const rest = n % 1000;
    return `${integerToWords(Math.floor(n / 1000))} thousand${rest ? ` ${integerToWords(rest)}` : ''}`;
  }
  if (n < 1_000_000_000) {
    const rest = n % 1_000_000;
    return `${integerToWords(Math.floor(n / 1_000_000))} million${rest ? ` ${integerToWords(rest)}` : ''}`;
  }
  const rest = n % 1_000_000_000;
  return `${integerToWords(Math.floor(n / 1_000_000_000))} billion${rest ? ` ${integerToWords(rest)}` : ''}`;
}

export function formatSoaDate(iso: string): string {
  const day = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return iso || '';
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

export function formatSoaPlainAmount(amount: number, currency?: string): string {
  const n = Number.isFinite(amount) ? Math.abs(amount) : 0;
  return formatMoney(n, {
    currency: normalizeLedgerCurrency(currency),
    style: 'full',
    withSymbol: false,
  });
}

export function soaBalanceSide(net: number): 'Db' | 'Cr' | '' {
  if (!net) return '';
  return net > 0 ? 'Db' : 'Cr';
}

export function formatSoaBalance(net: number, currency?: string): string {
  if (!net) return formatSoaPlainAmount(0, currency);
  return `${formatSoaPlainAmount(net, currency)} ${soaBalanceSide(net)}`;
}

export function soaTypeCode(row: Pick<GeneralLedgerReportRow, 'voucherType' | 'typeLabel' | 'memo'>): string {
  const type = String(row.voucherType || row.typeLabel || '').toUpperCase();
  if (type === 'RV' || type === 'RECEIPT') return 'RCV';
  if (type === 'PV' || type === 'PAYMENT') return 'PV';
  if (type === 'CV') return 'CV';
  if (type === 'JV') return 'JV';
  if (type === 'SAL' || type === 'SALE' || type === 'SALES') return 'SAL';
  if (type === 'CRN' || /credit note/i.test(row.memo || '')) return 'CRN';
  return type || '';
}

export function soaLineDescription(row: GeneralLedgerReportRow): {
  narrative: string;
  typeCode: string;
  serial: string;
  text: string;
} {
  const narrative = String(row.displayDescription || row.memo || row.party || '').trim();
  const typeCode = soaTypeCode(row);
  const serial = String(row.voucherNumber || '').trim();
  const parts = [narrative, typeCode && serial ? `${typeCode} - ${serial}` : serial || typeCode].filter(Boolean);
  return { narrative, typeCode, serial, text: parts.join(' ').trim() || '—' };
}

export function sayAccountCurrency(amount: number): string {
  const n = Math.abs(Number.isFinite(amount) ? amount : 0);
  const intPart = Math.floor(n);
  const cents = Math.round((n - intPart) * 100);
  const words = integerToWords(intPart);
  if (!cents) return `Say Account Currency ${words} Only`;
  return `Say Account Currency ${words} and ${String(cents).padStart(2, '0')} / 100 Only`;
}

export function convertSoaAmount(
  amount: number,
  storeCurrency: string,
  mode: ReportCurrencyMode,
  usdToLbp?: number,
): number {
  if (mode === 'both') return amount;
  const converted = convertLedgerAmount(amount, storeCurrency, mode, usdToLbp);
  return converted == null ? amount : converted;
}

export function soaDisplayCurrency(
  storeCurrency: string,
  mode: ReportCurrencyMode,
  accountCurrency?: string,
): string {
  if (mode === 'both') return normalizeLedgerCurrency(storeCurrency);
  if (mode === 'LBP' || mode === 'USD') return mode;
  return normalizeLedgerCurrency(accountCurrency || storeCurrency);
}

export function soaCurrencyCaption(mode: ReportCurrencyMode): string {
  if (mode === 'both') return 'In LBP + USD';
  if (mode === 'LBP') return 'In LBP';
  if (mode === 'USD') return 'In USD';
  return 'In Account Currency';
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function soaSectionTotals(section: {
  openingDebit: number;
  openingCredit: number;
  rows: Array<{ debit: number; credit: number }>;
}): { totalDebit: number; totalCredit: number } {
  const periodDebit = section.rows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
  const periodCredit = section.rows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0);
  return {
    totalDebit: round2(section.openingDebit + periodDebit),
    totalCredit: round2(section.openingCredit + periodCredit),
  };
}
