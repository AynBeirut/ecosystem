import type { Invoice, LineItem, PurchaseOrder } from '@/context/AppContext';
import type { Expense, ExpenseCategory } from '@/types/accounting';
import type { JournalLineInput, LedgerAccount } from '@/types/generalLedger';
import { GL_ACCOUNT_CODES } from '@/lib/ledger/defaultChartOfAccounts';
import {
  INPUT_VAT_CODE,
  resolvePurchaseReceiveSplit,
} from '@/lib/ledger/purchaseReceiveAmounts';
import {
  buildCogsInventoryReliefLines,
  buildCogsInventoryReversalLines,
  computeAccountNetDebitBalance,
  parseCogsReliefSplit,
} from '@/lib/ledger/cogsInventoryRelief';
import { hasMaterialVariance, productionVarianceCost } from '@/lib/ledger/productionWipCore';
import {
  buildSourceKey,
  postJournalEntry,
  type PostJournalResult,
} from '@/lib/ledger/postingService';
import { resolveExpenseAccountCode } from '@/lib/ledger/expenseAccountRouting';
import { ensurePartyLedgerAccount, isWalkInClient, walkInPartyIdForPosting } from '@/lib/ledger/partySubaccountLedger';
import {
  formatExpenseJournalMemo,
  formatInvoiceJournalMemo,
  formatOrderJournalMemo,
  formatPurchaseJournalMemo,
  resolveOrderClientName,
} from '@/lib/ledger/ledgerHumanLabels';
import {
  resolveOrderSaleAmounts,
  resolveSalesDiscountAccount,
  saleDiscountVoucherMeta,
} from '@/lib/ledger/salesDiscountPosting';
import { resolvePostingAccount } from '@/lib/ledger/postingAccountResolver';
import {
  buildPayrollJournalLines,
  cashOrBank as payrollCashOrBank,
  formatPayrollJournalMemo,
  isPayrollExpenseLike,
  payrollVoucherMeta,
  type PayrollPaymentInput,
} from '@/lib/ledger/payrollPosting';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function accountByCode(accounts: LedgerAccount[], code: string): LedgerAccount {
  return resolvePostingAccount(accounts, code);
}

function accountsMap(accounts: LedgerAccount[]): Map<string, LedgerAccount> {
  return new Map(accounts.map((a) => [a.id, a]));
}

async function salesCreditAccount(
  storeId: string,
  clientId: string | undefined,
  clientName: string | undefined,
  accounts: LedgerAccount[],
): Promise<LedgerAccount> {
  const partyId = walkInPartyIdForPosting(clientId, clientName);
  if (!partyId) return accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
  const party = await ensurePartyLedgerAccount(
    storeId,
    'client',
    partyId,
    isWalkInClient(clientId, clientName) ? 'Walk-in' : clientName || 'Client',
    accounts,
  );
  return party || accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
}

async function supplierDebitAccount(
  storeId: string,
  supplierId: string | undefined,
  supplierName: string | undefined,
  accounts: LedgerAccount[],
  fallbackCode: string,
): Promise<LedgerAccount> {
  const id = String(supplierId || '').trim();
  if (!id) return accountByCode(accounts, fallbackCode);
  const party = await ensurePartyLedgerAccount(storeId, 'supplier', id, supplierName || 'Supplier', accounts);
  return party || accountByCode(accounts, fallbackCode);
}

async function supplierCreditAccount(
  storeId: string,
  supplierId: string | undefined,
  supplierName: string | undefined,
  accounts: LedgerAccount[],
  fallbackCode: string,
): Promise<LedgerAccount> {
  return supplierDebitAccount(storeId, supplierId, supplierName, accounts, fallbackCode);
}

async function getPostedAccountNetDebitBalance(storeId: string, account: LedgerAccount): Promise<number> {
  const db = getFinanceDb();
  const [entriesSnap, linesSnap] = await Promise.all([
    getDocs(query(collection(db, 'stores', storeId, 'journalEntries'), where('status', '==', 'posted'))),
    getDocs(query(collection(db, 'stores', storeId, 'journalLines'), where('accountId', '==', account.id))),
  ]);
  const postedEntryIds = new Set(entriesSnap.docs.map((d) => d.id));
  const lines = linesSnap.docs.map((d) => {
    const data = d.data();
    return {
      accountId: String(data.accountId),
      entryId: String(data.entryId),
      debit: Number(data.debit) || 0,
      credit: Number(data.credit) || 0,
    };
  });
  return computeAccountNetDebitBalance(account.id, account.openingBalance || 0, lines, postedEntryIds);
}

function expenseAccountCode(expense: Pick<Expense, 'category' | 'name' | 'description'>): string {
  return resolveExpenseAccountCode({
    category: expense.category,
    vendor: expense.name,
    description: expense.description,
  });
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

  const revenue = await salesCreditAccount(storeId, invoice.clientId, invoice.clientName, accounts);
  const cogs = accountByCode(accounts, GL_ACCOUNT_CODES.COGS);
  const fgInv = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);
  const rawInv = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);

  const debitAcct = isImmediateCashSale(invoice)
    ? accountByCode(accounts, cashOrBank(invoice.paymentMethod))
    : accountByCode(accounts, GL_ACCOUNT_CODES.AR);

  const lines: JournalLineInput[] = [
    { accountId: debitAcct.id, debit: revenueAmount, credit: 0, description: 'Invoice sale' },
    { accountId: revenue.id, debit: 0, credit: revenueAmount, description: 'Sales revenue' },
  ];

  const totalCogs = computeInvoiceCogs(invoice);
  if (totalCogs > 0) {
    const fgBalance = await getPostedAccountNetDebitBalance(storeId, fgInv);
    lines.push(
      ...buildCogsInventoryReliefLines(totalCogs, cogs.id, fgInv.id, rawInv.id, fgBalance),
    );
  }

  return postJournalEntry(
    {
      storeId,
      date: invoice.date,
      memo: formatInvoiceJournalMemo(invoice),
      sourceType: 'invoice',
      sourceId: invoice.id,
      event: 'sale-recognized',
      voucherType: 'RV',
      createdBy,
      voucherMeta: {
        clientId: invoice.clientId,
        clientName: invoice.clientName,
      },
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
      memo: `Payment — ${invoice.clientName || 'Client'}${invoice.invoiceNumber ? ` (${invoice.invoiceNumber})` : ''}`,
      sourceType: 'invoice_payment',
      sourceId: invoice.id,
      event: `payment-${payment.id}`,
      voucherType: 'RV',
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
        memo: `Invoice unpaid — reverse cash sale (${prevInvoice.clientName || 'Client'})`,
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
        memo: `Invoice unpaid — reverse payments (${prevInvoice.clientName || 'Client'})`,
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

  if (isPayrollExpenseLike(expense)) {
    return null;
  }

  const fallbackCode = expenseAccountCode(expense);
  const expenseAcct = expense.supplierId
    ? await supplierDebitAccount(storeId, expense.supplierId, expense.vendorName || expense.name, accounts, fallbackCode)
    : accountByCode(accounts, fallbackCode);
  const cashAcct = accountByCode(accounts, cashOrBank(paymentMethod));

  return postJournalEntry(
    {
      storeId,
      date: expense.startDate || new Date().toISOString(),
      memo: formatExpenseJournalMemo({
        description: expense.description,
        name: expense.name,
        category: expense.category,
        vendorName: expense.vendorName,
      }),
      sourceType: 'expense',
      sourceId: expense.id,
      event,
      createdBy,
      voucherMeta: expense.supplierId
        ? { supplierId: expense.supplierId, supplierName: expense.vendorName || expense.name }
        : undefined,
      lines: [
        { accountId: expenseAcct.id, debit: amount, credit: 0, description: expense.supplierId ? `Supplier · ${expense.vendorName || expense.name}` : 'Expense paid' },
        { accountId: cashAcct.id, debit: 0, credit: amount, description: 'Cash/bank payment' },
      ],
    },
    accountsMap(accounts),
  );
}

function accountByCodeOptional(accounts: LedgerAccount[], code: string): LedgerAccount | null {
  return accounts.find((a) => a.code === code) ?? null;
}

async function ensureAccountActive(
  storeId: string,
  accounts: LedgerAccount[],
  code: string,
): Promise<LedgerAccount | null> {
  const acct = accounts.find((a) => a.code === code);
  if (!acct) return null;
  if (acct.isActive !== false) return acct;
  const db = getFinanceDb();
  await updateDoc(doc(db, 'stores', storeId, 'ledgerAccounts', acct.id), {
    isActive: true,
    updatedAt: new Date().toISOString(),
  });
  const activated = { ...acct, isActive: true };
  const idx = accounts.findIndex((a) => a.id === acct.id);
  if (idx >= 0) accounts[idx] = activated;
  return activated;
}

export async function autoPostPurchaseReceived(
  storeId: string,
  po: PurchaseOrder,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  if (po.status !== 'fulfilled' && po.status !== 'approved') return null;

  const poExt = po as PurchaseOrder & {
    amount?: number;
    taxType?: string;
    totalCost?: number;
  };
  const split = resolvePurchaseReceiveSplit({
    items: po.items,
    total: poExt.total ?? poExt.amount,
    totalCost: poExt.totalCost,
    amount: poExt.amount,
    subtotal: po.subtotal,
    taxAmount: po.taxAmount,
    taxRate: po.taxRate,
    taxType: poExt.taxType || (Number(po.taxRate) > 0 ? 'VAT' : 'none'),
  });
  if (!split || split.apCredit <= 0) return null;

  const inventory = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);
  const creditAcct = await supplierCreditAccount(
    storeId,
    po.supplierId,
    po.supplierName,
    accounts,
    GL_ACCOUNT_CODES.AP,
  );
  let inputVatAcct: LedgerAccount | null = null;
  if (split.inputVatDebit > 0) {
    inputVatAcct = await ensureAccountActive(storeId, accounts, INPUT_VAT_CODE);
  } else {
    inputVatAcct = accountByCodeOptional(accounts, INPUT_VAT_CODE);
  }

  const lines: JournalLineInput[] = [
    { accountId: inventory.id, debit: split.inventoryDebit, credit: 0, description: 'Inventory received (net)' },
  ];
  if (split.inputVatDebit > 0 && inputVatAcct) {
    lines.push({
      accountId: inputVatAcct.id,
      debit: split.inputVatDebit,
      credit: 0,
      description: 'Input VAT on purchase',
    });
  } else if (split.inputVatDebit > 0) {
    lines[0].debit = round2(lines[0].debit + split.inputVatDebit);
  }
  lines.push({
    accountId: creditAcct.id,
    debit: 0,
    credit: split.apCredit,
    description: po.supplierId ? `Supplier · ${po.supplierName || 'Supplier'}` : 'Accounts payable (TTC)',
  });

  return postJournalEntry(
    {
      storeId,
      date: po.date,
      memo: formatPurchaseJournalMemo(po),
      sourceType: 'purchase',
      sourceId: po.id,
      event: 'received',
      createdBy,
      voucherMeta: po.supplierId
        ? { supplierId: po.supplierId, supplierName: po.supplierName }
        : undefined,
      lines,
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
  const amount = round2(po.amount || 0);
  if (amount <= 0) return null;

  const payTo = await supplierDebitAccount(
    storeId,
    po.supplierId,
    po.supplierName,
    accounts,
    GL_ACCOUNT_CODES.AP,
  );
  const cashAcct = accountByCode(accounts, cashOrBank(paymentMethod));

  return postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: `Purchase payment — ${po.supplierName || 'Supplier'}`,
      sourceType: 'purchase_payment',
      sourceId: po.id,
      event,
      voucherType: 'PV',
      voucherMeta: {
        payee: po.supplierName,
        supplierId: po.supplierId,
        paidFromAccountId: cashAcct.id,
        paidToAccountId: payTo.id,
      },
      createdBy,
      lines: [
        { accountId: payTo.id, debit: amount, credit: 0, description: po.supplierId ? `Supplier · ${po.supplierName || 'Supplier'}` : 'AP relief' },
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
  taxAmount?: number;
  subtotal?: number;
  discountAmount?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  clientId?: string;
  clientName?: string;
  cogsLines: OrderCogsLine[];
  isCashSale?: boolean;
  isCodDelivery?: boolean;
};

function normalizeOrderTax(total: number, taxAmount?: number): number {
  const gross = round2(total);
  if (gross <= 0) return 0;
  const tax = round2(Number(taxAmount) || 0);
  if (tax <= 0) return 0;
  return Math.min(gross, tax);
}

export function isPlatformOrderCashSale(paymentMethod?: string): boolean {
  const pm = (paymentMethod || 'cash').toLowerCase();
  return pm !== 'credit' && pm !== 'on_account' && pm !== 'terms';
}

function computeOrderCogs(cogsLines: OrderCogsLine[]): number {
  return round2(cogsLines.reduce((sum, line) => sum + round2(line.unitCost) * round2(line.quantity), 0));
}

function orderSaleDescriptions(order: PlatformOrderInput): { debit: string; credit: string } {
  const client = resolveOrderClientName(order);
  const suffix = client ? ` — ${client}` : '';
  return {
    debit: `Order sale${suffix}`,
    credit: `Sales revenue${suffix}`,
  };
}

function orderVoucherMeta(order: PlatformOrderInput): Record<string, string> | undefined {
  const clientName = resolveOrderClientName(order);
  const clientId = String(order.clientId || '').trim();
  const amounts = resolveOrderSaleAmounts(order);
  const discountMeta = saleDiscountVoucherMeta(amounts);
  const meta: Record<string, string> = { ...discountMeta };
  if (clientId) meta.clientId = clientId;
  if (clientName) meta.clientName = clientName;
  return Object.keys(meta).length ? meta : undefined;
}

export async function autoPostOrderSaleRecognized(
  storeId: string,
  order: PlatformOrderInput,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const amounts = resolveOrderSaleAmounts(order);
  const grossAmount = amounts.netTotal;
  if (grossAmount <= 0) return null;

  const revenue = await salesCreditAccount(
    storeId,
    order.clientId,
    order.clientName,
    accounts,
  );
  const taxPayable = amounts.taxAmount > 0
    ? accountByCode(accounts, GL_ACCOUNT_CODES.TAX_PAYABLE)
    : null;
  const cogsAcct = accountByCode(accounts, GL_ACCOUNT_CODES.COGS);
  const fgInv = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);
  const rawInv = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);
  const isCod = order.isCodDelivery === true;
  const cashSale = !isCod && order.isCashSale !== false && isPlatformOrderCashSale(order.paymentMethod);
  const debitAcct = isCod
    ? accountByCode(accounts, GL_ACCOUNT_CODES.DELIVERY_WALLET)
    : cashSale
      ? accountByCode(accounts, cashOrBank(order.paymentMethod))
      : accountByCode(accounts, GL_ACCOUNT_CODES.AR);

  const saleLines = orderSaleDescriptions(order);
  const lines: JournalLineInput[] = [
    { accountId: debitAcct.id, debit: grossAmount, credit: 0, description: saleLines.debit },
  ];
  const revenueCredit =
    amounts.discountAmount > 0
      ? amounts.grossRevenue
      : round2(grossAmount - amounts.taxAmount);
  if (revenueCredit > 0) {
    lines.push({ accountId: revenue.id, debit: 0, credit: revenueCredit, description: saleLines.credit });
  }
  if (taxPayable && amounts.taxAmount > 0) {
    lines.push({
      accountId: taxPayable.id,
      debit: 0,
      credit: amounts.taxAmount,
      description: 'Sales tax payable',
    });
  }
  if (amounts.discountAmount > 0) {
    const discountAcct = resolveSalesDiscountAccount(accounts);
    lines.push({
      accountId: discountAcct.id,
      debit: amounts.discountAmount,
      credit: 0,
      description: 'Sales discount',
    });
  }

  const totalCogs = computeOrderCogs(order.cogsLines);
  if (totalCogs > 0) {
    const fgBalance = await getPostedAccountNetDebitBalance(storeId, fgInv);
    lines.push(
      ...buildCogsInventoryReliefLines(totalCogs, cogsAcct.id, fgInv.id, rawInv.id, fgBalance),
    );
  }

  return postJournalEntry(
    {
      storeId,
      date: order.date,
      memo: formatOrderJournalMemo(order),
      sourceType: 'order',
      sourceId: order.id,
      event: 'sale-recognized',
      voucherType: 'RV',
      createdBy,
      voucherMeta: orderVoucherMeta(order),
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
  const amounts = resolveOrderSaleAmounts(order);
  const total = amounts.netTotal;
  if (total <= 0) return null;

  const revenue = await salesCreditAccount(
    storeId,
    order.clientId,
    order.clientName,
    accounts,
  );
  const taxPayable = amounts.taxAmount > 0
    ? accountByCode(accounts, GL_ACCOUNT_CODES.TAX_PAYABLE)
    : null;
  const cogsAcct = accountByCode(accounts, GL_ACCOUNT_CODES.COGS);
  const fgInv = accountByCode(accounts, GL_ACCOUNT_CODES.FG_INVENTORY);
  const rawInv = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);
  const isCod = order.isCodDelivery === true;
  const cashSale = !isCod && order.isCashSale !== false && isPlatformOrderCashSale(order.paymentMethod);
  const debitAcct = isCod
    ? accountByCode(accounts, GL_ACCOUNT_CODES.DELIVERY_WALLET)
    : cashSale
      ? accountByCode(accounts, cashOrBank(order.paymentMethod))
      : accountByCode(accounts, GL_ACCOUNT_CODES.AR);

  const revenueDebit =
    amounts.discountAmount > 0
      ? amounts.grossRevenue
      : round2(total - amounts.taxAmount);
  const lines: JournalLineInput[] = [];
  if (revenueDebit > 0) {
    lines.push({ accountId: revenue.id, debit: revenueDebit, credit: 0, description: 'Reverse order revenue' });
  }
  if (taxPayable && amounts.taxAmount > 0) {
    lines.push({ accountId: taxPayable.id, debit: amounts.taxAmount, credit: 0, description: 'Reverse sales tax payable' });
  }
  if (amounts.discountAmount > 0) {
    const discountAcct = resolveSalesDiscountAccount(accounts);
    lines.push({
      accountId: discountAcct.id,
      debit: 0,
      credit: amounts.discountAmount,
      description: 'Reverse sales discount',
    });
  }
  lines.push({ accountId: debitAcct.id, debit: 0, credit: total, description: 'Reverse cash/AR' });

  const totalCogs = computeOrderCogs(order.cogsLines);
  if (totalCogs > 0) {
    const saleKey = buildSourceKey('order', order.id, 'sale-recognized');
    const saleSnap = await getDocs(
      query(
        collection(getFinanceDb(), 'stores', storeId, 'journalEntries'),
        where('sourceKey', '==', saleKey),
      ),
    );
    let split = { fgRelief: totalCogs, rawRelief: 0 };
    if (!saleSnap.empty) {
      const entryId = saleSnap.docs[0].id;
      const lineSnap = await getDocs(
        query(collection(getFinanceDb(), 'stores', storeId, 'journalLines'), where('entryId', '==', entryId)),
      );
      const saleLines = lineSnap.docs.map((d) => d.data());
      split = parseCogsReliefSplit(saleLines, fgInv.id, rawInv.id, totalCogs);
    }
    lines.push(...buildCogsInventoryReversalLines(totalCogs, cogsAcct.id, fgInv.id, rawInv.id, split));
  }

  return postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: `${formatOrderJournalMemo(order)} — reversal`,
      sourceType: 'order',
      sourceId: order.id,
      event: `reversal-${reversalId}`,
      createdBy,
      voucherMeta: orderVoucherMeta(order),
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
      memo: 'Production batch started',
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
      memo: 'Production batch — material variance',
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
      memo: 'Production batch completed (WIP → FG)',
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
      memo: 'Production batch completed',
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
        memo: 'Reverse production batch (legacy)',
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
        memo: 'Reverse production complete',
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
        memo: 'Reverse production variance',
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
        memo: 'Reverse production start',
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

export type { PayrollPaymentInput } from '@/lib/ledger/payrollPosting';

export async function autoPostPayrollPayment(
  storeId: string,
  paymentId: string,
  totalAmount: number,
  paymentDate: string,
  paymentMethod: string,
  accounts: LedgerAccount[],
  createdBy?: string,
  details?: Partial<PayrollPaymentInput>,
): Promise<PostJournalResult | null> {
  return postPayrollPaymentEntry(
    storeId,
    {
      id: paymentId,
      totalAmount,
      paymentDate,
      paymentMethod,
      ...details,
    },
    accounts,
    createdBy,
  );
}

export async function postPayrollPaymentEntry(
  storeId: string,
  input: PayrollPaymentInput,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const amount = round2(Number(input.totalAmount) || 0);
  if (amount <= 0) return null;

  const cashAcct = accountByCode(accounts, payrollCashOrBank(input.paymentMethod));
  const lines = await buildPayrollJournalLines(
    storeId,
    { ...input, totalAmount: amount },
    accounts,
    cashAcct.id,
  );
  if (!lines.length) return null;

  return postJournalEntry(
    {
      storeId,
      date: input.paymentDate,
      memo: formatPayrollJournalMemo(input),
      sourceType: 'payroll',
      sourceId: input.id,
      event: 'paid',
      createdBy,
      voucherMeta: payrollVoucherMeta(input),
      lines,
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
      memo: 'Cash collection deposit',
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
      memo: 'COD collected — delivery',
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
      memo: 'Delivery wallet settlement',
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
