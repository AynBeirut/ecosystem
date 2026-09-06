import type { JournalLineInput, LedgerAccount } from './postingService';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const SALES_DISCOUNT_OPERATIONAL_CODE = '410';

export type OrderSaleAmounts = {
  netTotal: number;
  taxAmount: number;
  discountAmount: number;
  grossRevenue: number;
};

export function normalizeOrderTax(total: number, taxAmount?: number): number {
  const gross = round2(total);
  if (gross <= 0) return 0;
  const tax = round2(Number(taxAmount) || 0);
  if (tax <= 0) return 0;
  return Math.min(gross, tax);
}

export function resolveOrderSaleAmounts(input: {
  total: number;
  taxAmount?: number;
  subtotal?: number;
  discountAmount?: number;
}): OrderSaleAmounts {
  const netTotal = round2(Number(input.total) || 0);
  const taxAmount = normalizeOrderTax(netTotal, input.taxAmount);
  const discountAmount = round2(Math.max(0, Number(input.discountAmount) || 0));
  const subtotal = Number(input.subtotal);
  let grossRevenue = round2(netTotal - taxAmount + discountAmount);
  if (Number.isFinite(subtotal) && subtotal > 0) {
    grossRevenue = round2(subtotal);
  }
  return { netTotal, taxAmount, discountAmount, grossRevenue };
}

export function resolveSalesDiscountAccount(
  accounts: LedgerAccount[],
  accountByCode: (accounts: LedgerAccount[], code: string) => LedgerAccount,
): LedgerAccount {
  const pcg = accounts.find(
    (a) => a.code === '7090' && a.isActive && a.isPcgChart,
  );
  if (pcg) return pcg;
  return accountByCode(accounts, SALES_DISCOUNT_OPERATIONAL_CODE);
}

export function saleDiscountVoucherMeta(amounts: OrderSaleAmounts): Record<string, string> {
  const meta: Record<string, string> = {};
  if (amounts.discountAmount > 0) {
    meta.discountAmount = String(amounts.discountAmount);
    meta.grossRevenue = String(amounts.grossRevenue);
  }
  if (amounts.taxAmount > 0) meta.taxAmount = String(amounts.taxAmount);
  meta.netTotal = String(amounts.netTotal);
  return meta;
}

export function buildSaleDiscountLines(
  amounts: OrderSaleAmounts,
  revenueAccountId: string,
  discountAccountId: string,
): JournalLineInput[] {
  if (amounts.discountAmount <= 0) return [];
  return [
    {
      accountId: discountAccountId,
      debit: amounts.discountAmount,
      credit: 0,
      description: 'Sales discount',
    },
  ];
}

export function buildSaleDiscountReversalLines(
  amounts: OrderSaleAmounts,
  discountAccountId: string,
): JournalLineInput[] {
  if (amounts.discountAmount <= 0) return [];
  return [
    {
      accountId: discountAccountId,
      debit: 0,
      credit: amounts.discountAmount,
      description: 'Reverse sales discount',
    },
  ];
}

export function revenueCreditForSale(amounts: OrderSaleAmounts): number {
  if (amounts.discountAmount > 0) return amounts.grossRevenue;
  return round2(amounts.netTotal - amounts.taxAmount);
}

export function revenueDebitForSaleReversal(amounts: OrderSaleAmounts): number {
  return revenueCreditForSale(amounts);
}
