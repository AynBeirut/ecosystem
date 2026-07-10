import { GL_ACCOUNT_CODES } from './defaultChartOfAccounts';
import {
  accountByCode,
  accountsMap,
  postJournalEntry,
  type JournalLineInput,
  type LedgerAccount,
  type PostJournalResult,
} from './postingService';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function cashOrBank(method?: string): string {
  const m = (method || '').toLowerCase();
  if (m === 'bank' || m === 'card' || m === 'stripe' || m === 'square') return GL_ACCOUNT_CODES.BANK;
  return GL_ACCOUNT_CODES.CASH;
}

export type OrderCogsLine = {
  productKey: string;
  quantity: number;
  unitCost: number;
};

export type PlatformOrderInput = {
  id: string;
  storeId: string;
  date: string;
  total: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  cogsLines: OrderCogsLine[];
  isCashSale?: boolean;
  isCodDelivery?: boolean;
};

export function isPlatformOrderCashSale(paymentMethod?: string): boolean {
  const pm = (paymentMethod || 'cash').toLowerCase();
  return pm !== 'credit' && pm !== 'on_account' && pm !== 'terms';
}

function computeCogs(cogsLines: OrderCogsLine[]): number {
  return round2(
    cogsLines.reduce((sum, line) => sum + round2(line.unitCost) * round2(line.quantity), 0),
  );
}

/** Dr Cash/AR/Delivery Wallet, Cr Revenue + Dr COGS / Cr FG — mirrors invoice sale recognition. */
export async function autoPostOrderSaleRecognized(
  storeId: string,
  order: PlatformOrderInput,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const revenueAmount = round2(order.total);
  if (revenueAmount <= 0) return null;

  const revenue = accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
  const cogsAcct = accountByCode(accounts, GL_ACCOUNT_CODES.COGS);
  const fgInv = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);
  const isCod = order.isCodDelivery === true;
  const cashSale = !isCod && order.isCashSale !== false && isPlatformOrderCashSale(order.paymentMethod);
  const debitAcct = isCod
    ? accountByCode(accounts, GL_ACCOUNT_CODES.DELIVERY_WALLET)
    : cashSale
      ? accountByCode(accounts, cashOrBank(order.paymentMethod))
      : accountByCode(accounts, GL_ACCOUNT_CODES.AR);

  const lines: JournalLineInput[] = [
    { accountId: debitAcct.id, debit: revenueAmount, credit: 0, description: 'Order sale' },
    { accountId: revenue.id, debit: 0, credit: revenueAmount, description: 'Sales revenue' },
  ];

  const totalCogs = computeCogs(order.cogsLines);
  if (totalCogs > 0) {
    lines.push({ accountId: cogsAcct.id, debit: totalCogs, credit: 0, description: 'COGS' });
    lines.push({ accountId: fgInv.id, debit: 0, credit: totalCogs, description: 'FG inventory relief' });
  }

  return postJournalEntry(
    {
      storeId,
      date: order.date,
      memo: `Order ${order.invoiceNumber || order.id}`,
      sourceType: 'order',
      sourceId: order.id,
      event: 'sale-recognized',
      createdBy,
      lines,
    },
    accountsMap(accounts),
  );
}

/** Reverse sale + COGS for returns/refunds (full reversal by amount). */
export async function autoPostOrderSaleReversal(
  storeId: string,
  order: PlatformOrderInput,
  accounts: LedgerAccount[],
  reversalId: string,
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const total = round2(order.total);
  if (total <= 0) return null;

  const revenue = accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
  const cogsAcct = accountByCode(accounts, GL_ACCOUNT_CODES.COGS);
  const fgInv = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);
  const isCod = order.isCodDelivery === true;
  const cashSale = !isCod && order.isCashSale !== false && isPlatformOrderCashSale(order.paymentMethod);
  const debitAcct = isCod
    ? accountByCode(accounts, GL_ACCOUNT_CODES.DELIVERY_WALLET)
    : cashSale
      ? accountByCode(accounts, cashOrBank(order.paymentMethod))
      : accountByCode(accounts, GL_ACCOUNT_CODES.AR);

  const lines: JournalLineInput[] = [
    { accountId: revenue.id, debit: total, credit: 0, description: 'Reverse order revenue' },
    { accountId: debitAcct.id, debit: 0, credit: total, description: 'Reverse cash/AR' },
  ];

  const totalCogs = computeCogs(order.cogsLines);
  if (totalCogs > 0) {
    lines.push({ accountId: fgInv.id, debit: totalCogs, credit: 0, description: 'Restore FG inventory' });
    lines.push({ accountId: cogsAcct.id, debit: 0, credit: totalCogs, description: 'Reverse COGS' });
  }

  return postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: `Order ${order.invoiceNumber || order.id} — reversal`,
      sourceType: 'order',
      sourceId: order.id,
      event: `reversal-${reversalId}`,
      createdBy,
      lines,
    },
    accountsMap(accounts),
  );
}

/** Production complete: Dr FG / Cr Raw Materials inventory. */
export async function autoPostProductionComplete(
  storeId: string,
  batchId: string,
  materialsCost: number,
  date: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const amount = round2(materialsCost);
  if (amount <= 0) return null;

  const fg = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);
  const raw = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);

  return postJournalEntry(
    {
      storeId,
      date,
      memo: `Production batch ${batchId} completed`,
      sourceType: 'production',
      sourceId: batchId,
      event: 'complete',
      createdBy,
      lines: [
        { accountId: fg.id, debit: amount, credit: 0, description: 'FG capitalization' },
        { accountId: raw.id, debit: 0, credit: amount, description: 'Raw materials consumed' },
      ],
    },
    accountsMap(accounts),
  );
}

export async function autoPostPayrollPayment(
  storeId: string,
  paymentId: string,
  totalAmount: number,
  paymentDate: string,
  paymentMethod: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const amount = round2(totalAmount);
  if (amount <= 0) return null;

  const payroll = accountByCode(accounts, GL_ACCOUNT_CODES.PAYROLL);
  const cashAcct = accountByCode(accounts, cashOrBank(paymentMethod));

  return postJournalEntry(
    {
      storeId,
      date: paymentDate,
      memo: `Payroll payment ${paymentId}`,
      sourceType: 'payroll',
      sourceId: paymentId,
      event: 'paid',
      createdBy,
      lines: [
        { accountId: payroll.id, debit: amount, credit: 0 },
        { accountId: cashAcct.id, debit: 0, credit: amount },
      ],
    },
    accountsMap(accounts),
  );
}

/** Bank deposit from undeposited cash (delivery wallet / COD collections). */
export async function autoPostCashCollectionDeposit(
  storeId: string,
  collectionId: string,
  totalAmount: number,
  collectionDate: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const amount = round2(totalAmount);
  if (amount <= 0) return null;

  const bank = accountByCode(accounts, GL_ACCOUNT_CODES.BANK);
  const cash = accountByCode(accounts, GL_ACCOUNT_CODES.CASH);

  return postJournalEntry(
    {
      storeId,
      date: collectionDate,
      memo: `Cash collection deposit ${collectionId}`,
      sourceType: 'cash_collection',
      sourceId: collectionId,
      event: 'deposited',
      createdBy,
      lines: [
        { accountId: bank.id, debit: amount, credit: 0, description: 'Bank deposit' },
        { accountId: cash.id, debit: 0, credit: amount, description: 'Cash moved to bank' },
      ],
    },
    accountsMap(accounts),
  );
}

/** COD cash collected by delivery agent — Dr Delivery Wallet, Cr Revenue. */
export async function autoPostDeliveryWalletCodCollected(
  storeId: string,
  orderId: string,
  amount: number,
  collectionDate: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const total = round2(amount);
  if (total <= 0) return null;

  const wallet = accountByCode(accounts, GL_ACCOUNT_CODES.DELIVERY_WALLET);
  const revenue = accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);

  return postJournalEntry(
    {
      storeId,
      date: collectionDate,
      memo: `COD collected — delivery order ${orderId}`,
      sourceType: 'delivery_wallet',
      sourceId: orderId,
      event: 'cod-collected',
      createdBy,
      lines: [
        { accountId: wallet.id, debit: total, credit: 0, description: 'Cash with courier' },
        { accountId: revenue.id, debit: 0, credit: total, description: 'COD sale' },
      ],
    },
    accountsMap(accounts),
  );
}

/** Driver/delivery wallet settlement — cash received from delivery agent. */
export async function autoPostDeliveryWalletSettlement(
  storeId: string,
  settlementId: string,
  amount: number,
  settlementDate: string,
  accounts: LedgerAccount[],
  createdBy?: string,
  destination: 'cash' | 'bank' = 'cash',
): Promise<PostJournalResult | null> {
  const total = round2(amount);
  if (total <= 0) return null;

  const dest = accountByCode(accounts, destination === 'bank' ? GL_ACCOUNT_CODES.BANK : GL_ACCOUNT_CODES.CASH);
  const wallet = accountByCode(accounts, GL_ACCOUNT_CODES.DELIVERY_WALLET);

  return postJournalEntry(
    {
      storeId,
      date: settlementDate,
      memo: `Delivery wallet settlement ${settlementId}`,
      sourceType: 'delivery_wallet',
      sourceId: settlementId,
      event: 'settled',
      createdBy,
      lines: [
        { accountId: dest.id, debit: total, credit: 0, description: destination === 'bank' ? 'Bank deposit' : 'Cash received' },
        { accountId: wallet.id, debit: 0, credit: total, description: 'Courier wallet cleared' },
      ],
    },
    accountsMap(accounts),
  );
}
