import type { JournalLineInput, LedgerAccount } from '@/types/generalLedger';
import { GL_ACCOUNT_CODES } from '@/lib/ledger/defaultChartOfAccounts';
import { resolvePostingAccount } from '@/lib/ledger/postingAccountResolver';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type SaleDiscountMode = 'fixed' | 'percentage';

/** Resolve posted discount from fixed amount or % of gross (given net receipt). */
export function resolveSaleDiscountAmount(input: {
  discountType?: SaleDiscountMode | string;
  discountValue?: number;
  /** Net cash / AR after discount. */
  netTotal?: number;
  /** Legacy callers passing only the computed amount. */
  discountAmount?: number;
}): number {
  const hasMode = input.discountType === 'fixed' || input.discountType === 'percentage';
  if (!hasMode && input.discountAmount != null) {
    return round2(Math.max(0, Number(input.discountAmount) || 0));
  }

  const type: SaleDiscountMode = input.discountType === 'percentage' ? 'percentage' : 'fixed';
  const value = round2(Math.max(0, Number(input.discountValue) || 0));
  if (value <= 0) return 0;

  if (type === 'fixed') return value;

  const pct = Math.min(value, 99.99);
  const net = round2(Math.max(0, Number(input.netTotal) || 0));
  if (net <= 0 || pct <= 0) return 0;
  return round2((net * pct) / (100 - pct));
}

export const SALES_DISCOUNT_OPERATIONAL_CODE = '410';

export type OrderSaleAmounts = {
  netTotal: number;
  taxAmount: number;
  discountAmount: number;
  /** Gross sales before discount (excludes tax). */
  grossRevenue: number;
};

export function normalizeOrderTax(total: number, taxAmount?: number): number {
  const gross = round2(total);
  if (gross <= 0) return 0;
  const tax = round2(Number(taxAmount) || 0);
  if (tax <= 0) return 0;
  return Math.min(gross, tax);
}

/** Split POS / sale totals into gross revenue, discount, tax, and net cash. */
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

export function resolveSalesDiscountAccount(accounts: LedgerAccount[]): LedgerAccount {
  return resolvePostingAccount(accounts, SALES_DISCOUNT_OPERATIONAL_CODE);
}

function isRevenueLedgerAccount(account: LedgerAccount | undefined): boolean {
  if (!account) return false;
  if (account.type === 'revenue') return true;
  const code = String(account.code || '').trim();
  const head = parseInt(code.slice(0, 4), 10);
  return Number.isFinite(head) && head >= 7000 && head < 7200;
}

/** Append discount debit + gross-up revenue credit on sale journal lines. */
export function appendSalesDiscountLines(
  lines: JournalLineInput[],
  amounts: Pick<OrderSaleAmounts, 'discountAmount' | 'grossRevenue' | 'taxAmount' | 'netTotal'>,
  accounts: LedgerAccount[],
  revenueAccountId: string,
): JournalLineInput[] {
  const { discountAmount, grossRevenue, taxAmount, netTotal } = amounts;
  if (discountAmount <= 0) {
    return lines;
  }

  const discountAcct = resolveSalesDiscountAccount(accounts);
  const out = lines.map((line) => ({ ...line }));
  const targetRevenueCredit = round2(grossRevenue);
  let revenueIdx = out.findIndex(
    (line) => line.accountId === revenueAccountId && (Number(line.credit) || 0) > 0,
  );
  if (revenueIdx < 0) {
    revenueIdx = out.findIndex((line) => {
      const acct = accounts.find((a) => a.id === line.accountId);
      return isRevenueLedgerAccount(acct) && (Number(line.credit) || 0) > 0;
    });
  }

  if (revenueIdx >= 0) {
    out[revenueIdx] = {
      ...out[revenueIdx],
      credit: targetRevenueCredit,
      description: out[revenueIdx].description || 'Sales revenue (gross)',
    };
  } else {
    out.push({
      accountId: revenueAccountId,
      debit: 0,
      credit: targetRevenueCredit,
      description: 'Sales revenue (gross)',
    });
  }

  out.push({
    accountId: discountAcct.id,
    debit: discountAmount,
    credit: 0,
    description: 'Sales discount',
  });

  // Keep cash/AR debit aligned with net total when a single debit line carries the receipt.
  const debitIdx = out.findIndex((line) => (Number(line.debit) || 0) > 0);
  if (debitIdx >= 0) {
    const debitAcct = accounts.find((a) => a.id === out[debitIdx].accountId);
    if (debitAcct?.type === 'asset') {
      out[debitIdx] = { ...out[debitIdx], debit: netTotal, description: out[debitIdx].description || 'Cash / AR (net)' };
    }
  }

  const taxCredit = round2(taxAmount);
  if (taxCredit > 0) {
    const taxIdx = out.findIndex((line) => {
      const acct = accounts.find((a) => a.id === line.accountId);
      return acct?.code === GL_ACCOUNT_CODES.TAX_PAYABLE && (Number(line.credit) || 0) > 0;
    });
    if (taxIdx >= 0) {
      out[taxIdx] = { ...out[taxIdx], credit: taxCredit };
    }
  }

  return out;
}

/** Reverse discount lines for sale reversal (mirror of appendSalesDiscountLines). */
export function appendSalesDiscountReversalLines(
  lines: JournalLineInput[],
  amounts: Pick<OrderSaleAmounts, 'discountAmount' | 'grossRevenue'>,
  accounts: LedgerAccount[],
  revenueAccountId: string,
): JournalLineInput[] {
  const { discountAmount, grossRevenue } = amounts;
  if (discountAmount <= 0) return lines;

  const discountAcct = resolveSalesDiscountAccount(accounts);
  const out = lines.map((line) => ({ ...line }));

  const revenueIdx = out.findIndex(
    (line) =>
      line.accountId === revenueAccountId &&
      (Number(line.debit) || 0) > 0,
  );
  if (revenueIdx >= 0) {
    out[revenueIdx] = { ...out[revenueIdx], debit: round2(grossRevenue) };
  }

  out.push({
    accountId: discountAcct.id,
    debit: 0,
    credit: discountAmount,
    description: 'Reverse sales discount',
  });

  return out;
}

/** Apply manual RV discount: bump revenue credit and add discount debit line. */
export function applyRvSalesDiscount(
  lines: JournalLineInput[],
  discountAmount: number,
  accounts: LedgerAccount[],
): JournalLineInput[] {
  const discount = round2(Math.max(0, discountAmount));
  if (discount <= 0) return lines;

  const creditLine = lines.find((line) => (Number(line.credit) || 0) > 0);
  if (!creditLine) return lines;

  const creditAcct = accounts.find((a) => a.id === creditLine.accountId);
  if (!isRevenueLedgerAccount(creditAcct)) return lines;

  const grossRevenue = round2((Number(creditLine.credit) || 0) + discount);
  const debitLine = lines.find((line) => (Number(line.debit) || 0) > 0);
  const netTotal = debitLine ? round2(Number(debitLine.debit) || 0) : round2(grossRevenue - discount);

  return appendSalesDiscountLines(
    lines,
    {
      discountAmount: discount,
      grossRevenue,
      taxAmount: 0,
      netTotal,
    },
    accounts,
    creditLine.accountId,
  );
}

export function saleDiscountVoucherMeta(
  amounts: OrderSaleAmounts,
  discountInput?: { discountType?: SaleDiscountMode; discountValue?: number },
): Record<string, string> {
  const meta: Record<string, string> = {};
  if (amounts.discountAmount > 0) {
    meta.discountAmount = String(amounts.discountAmount);
    meta.grossRevenue = String(amounts.grossRevenue);
    if (discountInput?.discountType) {
      meta.discountType = discountInput.discountType;
      meta.discountValue = String(discountInput.discountValue ?? amounts.discountAmount);
    }
  }
  if (amounts.taxAmount > 0) meta.taxAmount = String(amounts.taxAmount);
  meta.netTotal = String(amounts.netTotal);
  return meta;
}
