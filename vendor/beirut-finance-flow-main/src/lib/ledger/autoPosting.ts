import type { Invoice, LineItem, PurchaseOrder } from '@/context/AppContext';
import type { Expense, ExpenseCategory } from '@/types/accounting';
import type { JournalLineInput, LedgerAccount } from '@/types/generalLedger';
import { GL_ACCOUNT_CODES } from '@/lib/ledger/defaultChartOfAccounts';
import { hasMaterialVariance, productionVarianceCost } from '@/lib/ledger/productionWipCore';
import { postJournalEntry, type PostJournalResult } from '@/lib/ledger/postingService';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function accountByCode(accounts: LedgerAccount[], code: string): LedgerAccount {
  const found = accounts.find((a) => a.code === code && a.isActive);
  if (!found) throw new Error(`GL account ${code} not found. Initialize Chart of Accounts first.`);
  return found;
}

function accountsMap(accounts: LedgerAccount[]): Map<string, LedgerAccount> {
  return new Map(accounts.map((a) => [a.id, a]));
}

const EXPENSE_GL_MAP: Partial<Record<ExpenseCategory, string>> = {
  rent: '6000',
  utilities: '6010',
  payroll: '6020',
  marketing: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  insurance: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  other: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
};

function expenseAccountCode(category: ExpenseCategory): string {
  return EXPENSE_GL_MAP[category] || GL_ACCOUNT_CODES.GENERAL_EXPENSE;
}

function cashOrBank(method?: string): string {
  const m = (method || '').toLowerCase();
  if (m === 'bank' || m === 'card' || m === 'stripe') return GL_ACCOUNT_CODES.BANK;
  return GL_ACCOUNT_CODES.CASH;
}

function invoiceTotal(invoice: Invoice): number {
  return round2(Number(invoice.total ?? invoice.amount) || 0);
}

function computeInvoiceCogs(invoice: Invoice): number {
  let totalCogs = 0;
  for (const item of invoice.items || []) {
    const unitCost = round2(Number((item as LineItem).rawPrice) || 0);
    const qty = round2(Number(item.quantity) || 0);
    totalCogs = round2(totalCogs + unitCost * qty);
  }
  return totalCogs;
}

/** Cash collected at point of sale — revenue debits Cash, not AR. */
export function isImmediateCashSale(invoice: Invoice): boolean {
  const pm = (invoice.paymentMethod || '').toLowerCase();
  return pm === 'cash' && (invoice.status === 'paid' || invoice.status === 'partial');
}

/** On-account / collect-later sale — revenue debits AR until cash is received. */
export function isCreditTermsSale(invoice: Invoice): boolean {
  return !isImmediateCashSale(invoice);
}

const SALE_RECOGNITION_STATUSES = new Set(['sent', 'partial', 'paid', 'pending_manual_payment']);

export async function autoPostInvoiceSaleRecognized(
  storeId: string,
  invoice: Invoice,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  if (!SALE_RECOGNITION_STATUSES.has(invoice.status)) return null;

  const revenueAmount = invoiceTotal(invoice);
  if (revenueAmount <= 0) return null;

  const revenue = accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
  const cogs = accountByCode(accounts, GL_ACCOUNT_CODES.COGS);
  const fgInv = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);

  const debitAcct = isImmediateCashSale(invoice)
    ? accountByCode(accounts, cashOrBank(invoice.paymentMethod))
    : accountByCode(accounts, GL_ACCOUNT_CODES.AR);

  const lines: JournalLineInput[] = [
    { accountId: debitAcct.id, debit: revenueAmount, credit: 0, description: 'Invoice sale' },
    { accountId: revenue.id, debit: 0, credit: revenueAmount, description: 'Sales revenue' },
  ];

  const totalCogs = computeInvoiceCogs(invoice);
  if (totalCogs > 0) {
    lines.push({ accountId: cogs.id, debit: totalCogs, credit: 0, description: 'COGS' });
    lines.push({ accountId: fgInv.id, debit: 0, credit: totalCogs, description: 'Inventory relief' });
  }

  return postJournalEntry(
    {
      storeId,
      date: invoice.date,
      memo: `Invoice ${invoice.id} — ${invoice.clientName}`,
      sourceType: 'invoice',
      sourceId: invoice.id,
      event: 'sale-recognized',
      createdBy,
      lines,
    },
    accountsMap(accounts),
  );
}

export type InvoicePaymentInput = {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
};

/** Posts Dr Cash/Bank, Cr AR for the amount actually received (supports partial payments). */
export async function autoPostInvoicePayment(
  storeId: string,
  invoice: Invoice,
  payment: InvoicePaymentInput,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  if (isImmediateCashSale(invoice)) return null;

  const amount = round2(payment.amount);
  if (amount <= 0) return null;

  const ar = accountByCode(accounts, GL_ACCOUNT_CODES.AR);
  const cashAcct = accountByCode(accounts, cashOrBank(payment.paymentMethod));

  return postJournalEntry(
    {
      storeId,
      date: payment.paymentDate,
      memo: `Invoice payment ${invoice.id} — ${payment.id}`,
      sourceType: 'invoice_payment',
      sourceId: invoice.id,
      event: `payment-${payment.id}`,
      createdBy,
      lines: [
        { accountId: cashAcct.id, debit: amount, credit: 0, description: 'Customer payment' },
        { accountId: ar.id, debit: 0, credit: amount, description: 'AR relief' },
      ],
    },
    accountsMap(accounts),
  );
}

function amountCollectedOnInvoice(invoice: Invoice): number {
  const total = invoiceTotal(invoice);
  const recorded = round2(invoice.paidAmount || 0);
  if (recorded > 0) return recorded;
  if (invoice.status === 'paid') return total;
  return 0;
}

/** Reverses GL from mark-unpaid: payment receipts and/or cash-at-POS sale recognition. */
export async function autoPostInvoiceUnpaidReversal(
  storeId: string,
  prevInvoice: Invoice,
  accounts: LedgerAccount[],
  reversalId: string,
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const collected = amountCollectedOnInvoice(prevInvoice);
  const total = invoiceTotal(prevInvoice);
  const reversalDate = new Date().toISOString();

  if (isImmediateCashSale(prevInvoice) && total > 0) {
    const revenue = accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
    const cashAcct = accountByCode(accounts, cashOrBank(prevInvoice.paymentMethod));
    const cogs = accountByCode(accounts, GL_ACCOUNT_CODES.COGS);
    const fgInv = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);

    const lines: JournalLineInput[] = [
      { accountId: revenue.id, debit: total, credit: 0, description: 'Reverse sale revenue' },
      { accountId: cashAcct.id, debit: 0, credit: total, description: 'Reverse cash sale' },
    ];
    const totalCogs = computeInvoiceCogs(prevInvoice);
    if (totalCogs > 0) {
      lines.push({ accountId: fgInv.id, debit: totalCogs, credit: 0, description: 'Reverse inventory relief' });
      lines.push({ accountId: cogs.id, debit: 0, credit: totalCogs, description: 'Reverse COGS' });
    }

    return postJournalEntry(
      {
        storeId,
        date: reversalDate,
        memo: `Invoice ${prevInvoice.id} marked unpaid — reverse cash sale`,
        sourceType: 'invoice',
        sourceId: prevInvoice.id,
        event: `reversal-sale-${reversalId}`,
        createdBy,
        lines,
      },
      accountsMap(accounts),
    );
  }

  if (collected > 0 && isCreditTermsSale(prevInvoice)) {
    const ar = accountByCode(accounts, GL_ACCOUNT_CODES.AR);
    const cashAcct = accountByCode(accounts, cashOrBank(prevInvoice.paymentMethod));

    return postJournalEntry(
      {
        storeId,
        date: reversalDate,
        memo: `Invoice ${prevInvoice.id} marked unpaid — reverse payments`,
        sourceType: 'invoice',
        sourceId: prevInvoice.id,
        event: `reversal-payments-${reversalId}`,
        createdBy,
        lines: [
          { accountId: ar.id, debit: collected, credit: 0, description: 'Restore AR' },
          { accountId: cashAcct.id, debit: 0, credit: collected, description: 'Reverse cash receipt' },
        ],
      },
      accountsMap(accounts),
    );
  }

  return null;
}

/** @deprecated Use autoPostInvoiceSaleRecognized + autoPostInvoicePayment */
export async function autoPostInvoicePaid(
  storeId: string,
  invoice: Invoice,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  await autoPostInvoiceSaleRecognized(storeId, invoice, accounts, createdBy);
  if (isCreditTermsSale(invoice)) {
    const total = invoiceTotal(invoice);
    const paid = round2(invoice.paidAmount || total);
    if (paid > 0) {
      return autoPostInvoicePayment(
        storeId,
        invoice,
        {
          id: `legacy-${invoice.id}`,
          amount: paid,
          paymentMethod: invoice.paymentMethod || 'cash',
          paymentDate: invoice.paidAt || invoice.date,
        },
        accounts,
        createdBy,
      );
    }
  }
  return autoPostInvoiceSaleRecognized(storeId, invoice, accounts, createdBy);
}

export async function autoPostExpensePaid(
  storeId: string,
  expense: Expense,
  paidAmount: number,
  paymentMethod: string,
  accounts: LedgerAccount[],
  createdBy?: string,
  event = `payment-${Date.now()}`,
): Promise<PostJournalResult | null> {
  const amount = round2(paidAmount);
  if (amount <= 0) return null;

  const expenseAcct = accountByCode(accounts, expenseAccountCode(expense.category));
  const cashAcct = accountByCode(accounts, cashOrBank(paymentMethod));

  return postJournalEntry(
    {
      storeId,
      date: expense.startDate || new Date().toISOString(),
      memo: `Expense ${expense.id} — ${expense.name}`,
      sourceType: 'expense',
      sourceId: expense.id,
      event,
      createdBy,
      lines: [
        { accountId: expenseAcct.id, debit: amount, credit: 0 },
        { accountId: cashAcct.id, debit: 0, credit: amount },
      ],
    },
    accountsMap(accounts),
  );
}

export async function autoPostPurchaseReceived(
  storeId: string,
  po: PurchaseOrder,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  if (po.status !== 'fulfilled' && po.status !== 'approved') return null;

  const inventory = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);
  const ap = accountByCode(accounts, GL_ACCOUNT_CODES.AP);

  let total = 0;
  for (const item of po.items || []) {
    const unitCost = round2(Number(item.rawPrice) || Number(item.unitPrice) || 0);
    total = round2(total + unitCost * (Number(item.quantity) || 0));
  }
  if (total <= 0) total = round2(po.amount || 0);
  if (total <= 0) return null;

  return postJournalEntry(
    {
      storeId,
      date: po.date,
      memo: `Purchase ${po.id} — ${po.supplierName}`,
      sourceType: 'purchase',
      sourceId: po.id,
      event: 'received',
      createdBy,
      lines: [
        { accountId: inventory.id, debit: total, credit: 0 },
        { accountId: ap.id, debit: 0, credit: total },
      ],
    },
    accountsMap(accounts),
  );
}

export async function autoPostPurchasePaid(
  storeId: string,
  po: PurchaseOrder,
  accounts: LedgerAccount[],
  paymentMethod = 'bank',
  createdBy?: string,
  event = 'paid',
): Promise<PostJournalResult | null> {
  const ap = accountByCode(accounts, GL_ACCOUNT_CODES.AP);
  const cashAcct = accountByCode(accounts, cashOrBank(paymentMethod));
  const amount = round2(po.amount || 0);
  if (amount <= 0) return null;

  return postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: `Purchase payment ${po.id}`,
      sourceType: 'purchase_payment',
      sourceId: po.id,
      event,
      createdBy,
      lines: [
        { accountId: ap.id, debit: amount, credit: 0 },
        { accountId: cashAcct.id, debit: 0, credit: amount },
      ],
    },
    accountsMap(accounts),
  );
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

function computeOrderCogs(cogsLines: OrderCogsLine[]): number {
  return round2(cogsLines.reduce((sum, line) => sum + round2(line.unitCost) * round2(line.quantity), 0));
}

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

  const totalCogs = computeOrderCogs(order.cogsLines);
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

  const totalCogs = computeOrderCogs(order.cogsLines);
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

export async function autoPostProductionStart(
  storeId: string,
  batchId: string,
  materialsCost: number,
  date: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const amount = round2(materialsCost);
  if (amount <= 0) return null;

  const wip = accountByCode(accounts, GL_ACCOUNT_CODES.WIP_INVENTORY);
  const raw = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);

  return postJournalEntry(
    {
      storeId,
      date,
      memo: `Production batch ${batchId} started`,
      sourceType: 'production',
      sourceId: batchId,
      event: 'started',
      createdBy,
      lines: [
        { accountId: wip.id, debit: amount, credit: 0, description: 'Materials issued to WIP' },
        { accountId: raw.id, debit: 0, credit: amount, description: 'Raw materials to production' },
      ],
    },
    accountsMap(accounts),
  );
}

export async function autoPostProductionVariance(
  storeId: string,
  batchId: string,
  varianceCost: number,
  date: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const variance = round2(varianceCost);
  if (Math.abs(variance) < 0.01) return null;

  const wip = accountByCode(accounts, GL_ACCOUNT_CODES.WIP_INVENTORY);
  const raw = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);

  const lines =
    variance > 0
      ? [
          { accountId: wip.id, debit: variance, credit: 0, description: 'Additional materials to WIP' },
          { accountId: raw.id, debit: 0, credit: variance, description: 'Extra raw issued' },
        ]
      : [
          { accountId: raw.id, debit: Math.abs(variance), credit: 0, description: 'Unused raw returned' },
          { accountId: wip.id, debit: 0, credit: Math.abs(variance), description: 'WIP reduced for variance' },
        ];

  return postJournalEntry(
    {
      storeId,
      date,
      memo: `Production batch ${batchId} material variance`,
      sourceType: 'production',
      sourceId: batchId,
      event: 'variance',
      createdBy,
      lines,
    },
    accountsMap(accounts),
  );
}

export async function autoPostProductionCompleteWip(
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
  const wip = accountByCode(accounts, GL_ACCOUNT_CODES.WIP_INVENTORY);

  return postJournalEntry(
    {
      storeId,
      date,
      memo: `Production batch ${batchId} completed (WIP → FG)`,
      sourceType: 'production',
      sourceId: batchId,
      event: 'complete',
      createdBy,
      lines: [
        { accountId: fg.id, debit: amount, credit: 0, description: 'FG capitalization' },
        { accountId: wip.id, debit: 0, credit: amount, description: 'WIP cleared to FG' },
      ],
    },
    accountsMap(accounts),
  );
}

export async function autoPostProductionWipCompleteFlow(
  storeId: string,
  batchId: string,
  costStart: number,
  costActual: number,
  date: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<{ variancePosted: boolean; completePosted: boolean }> {
  let variancePosted = false;
  if (hasMaterialVariance(costStart, costActual)) {
    const varianceResult = await autoPostProductionVariance(
      storeId,
      batchId,
      productionVarianceCost(costStart, costActual),
      date,
      accounts,
      createdBy,
    );
    variancePosted = Boolean(varianceResult && !varianceResult.idempotentReplay);
  }
  const completeResult = await autoPostProductionCompleteWip(
    storeId,
    batchId,
    costActual,
    date,
    accounts,
    createdBy,
  );
  return { variancePosted, completePosted: Boolean(completeResult && !completeResult.idempotentReplay) };
}

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
      memo: `Production batch ${batchId} completed (legacy)`,
      sourceType: 'production',
      sourceId: batchId,
      event: 'complete-legacy',
      createdBy,
      lines: [
        { accountId: fg.id, debit: amount, credit: 0, description: 'FG capitalization' },
        { accountId: raw.id, debit: 0, credit: amount, description: 'Raw materials consumed' },
      ],
    },
    accountsMap(accounts),
  );
}

export type ProductionReversalInput = {
  wipEnabled: boolean;
  materialsCostAtStart?: number;
  materialsCostAtComplete?: number;
  varianceCost?: number;
};

export async function autoPostProductionReversal(
  storeId: string,
  batchId: string,
  reversalId: string,
  input: ProductionReversalInput,
  date: string,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<void> {
  const fg = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);
  const raw = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);
  const wip = accountByCode(accounts, GL_ACCOUNT_CODES.WIP_INVENTORY);

  if (!input.wipEnabled) {
    const amount = round2(Number(input.materialsCostAtComplete) || 0);
    if (amount <= 0) return;
    await postJournalEntry(
      {
        storeId,
        date,
        memo: `Reverse production batch ${batchId} (legacy)`,
        sourceType: 'production',
        sourceId: batchId,
        event: `reversal-${reversalId}-legacy`,
        createdBy,
        lines: [
          { accountId: fg.id, debit: 0, credit: amount, description: 'Reverse FG' },
          { accountId: raw.id, debit: amount, credit: 0, description: 'Restore raw materials' },
        ],
      },
      accountsMap(accounts),
    );
    return;
  }

  const costComplete = round2(Number(input.materialsCostAtComplete) || 0);
  const costStart = round2(Number(input.materialsCostAtStart) || 0);
  const variance = round2(Number(input.varianceCost) || productionVarianceCost(costStart, costComplete));

  if (costComplete > 0) {
    await postJournalEntry(
      {
        storeId,
        date,
        memo: `Reverse production complete ${batchId}`,
        sourceType: 'production',
        sourceId: batchId,
        event: `reversal-${reversalId}-complete`,
        createdBy,
        lines: [
          { accountId: fg.id, debit: 0, credit: costComplete, description: 'Reverse FG' },
          { accountId: wip.id, debit: costComplete, credit: 0, description: 'Restore WIP from FG reversal' },
        ],
      },
      accountsMap(accounts),
    );
  }

  if (Math.abs(variance) >= 0.01) {
    const lines =
      variance > 0
        ? [
            { accountId: raw.id, debit: variance, credit: 0, description: 'Reverse extra raw issuance' },
            { accountId: wip.id, debit: 0, credit: variance, description: 'Reverse variance to WIP' },
          ]
        : [
            { accountId: wip.id, debit: Math.abs(variance), credit: 0, description: 'Reverse variance from WIP' },
            { accountId: raw.id, debit: 0, credit: Math.abs(variance), description: 'Reverse raw return' },
          ];
    await postJournalEntry(
      {
        storeId,
        date,
        memo: `Reverse production variance ${batchId}`,
        sourceType: 'production',
        sourceId: batchId,
        event: `reversal-${reversalId}-variance`,
        createdBy,
        lines,
      },
      accountsMap(accounts),
    );
  }

  if (costStart > 0) {
    await postJournalEntry(
      {
        storeId,
        date,
        memo: `Reverse production start ${batchId}`,
        sourceType: 'production',
        sourceId: batchId,
        event: `reversal-${reversalId}-started`,
        createdBy,
        lines: [
          { accountId: raw.id, debit: costStart, credit: 0, description: 'Restore raw from WIP start' },
          { accountId: wip.id, debit: 0, credit: costStart, description: 'Clear WIP from start reversal' },
        ],
      },
      accountsMap(accounts),
    );
  }
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

/** Delivery agent hands cash to company — Dr Cash/Bank, Cr Delivery Wallet. */
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
