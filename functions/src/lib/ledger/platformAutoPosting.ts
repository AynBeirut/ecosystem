import * as admin from 'firebase-admin';
import { GL_ACCOUNT_CODES } from './defaultChartOfAccounts';
import { hasMaterialVariance, productionVarianceCost } from './productionWipCore';
import {
  buildCogsInventoryReliefLines,
  buildCogsInventoryReversalLines,
  parseCogsReliefSplit,
} from './cogsInventoryRelief';
import {
  accountByCode,
  accountsMap,
  buildSourceKey,
  getPostedAccountNetDebitBalance,
  loadJournalLinesForEntry,
  postJournalEntry,
  type JournalLineInput,
  type LedgerAccount,
  type PostJournalResult,
} from './postingService';
import {
  INPUT_VAT_CODE,
  resolvePurchaseReceiveSplit,
  type PurchaseReceiveInput,
} from './purchaseReceiveAmounts';
import { resolveExpenseAccountCode } from './expenseAccountRouting';

function getDb() {
  return admin.firestore();
}

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
  taxAmount?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
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

export type PlatformPurchaseItem = {
  quantity?: number;
  unitCost?: number;
  unitPrice?: number;
  rawPrice?: number;
  subtotal?: number;
};

export type PlatformPurchaseInput = PurchaseReceiveInput & {
  id: string;
  date: string;
  supplierName?: string;
  totalAmount?: number;
  status?: string;
  items?: PlatformPurchaseItem[];
};

export type PlatformExpenseInput = {
  id: string;
  date: string;
  category?: string;
  description?: string;
  vendor?: string;
  amount: number;
  paymentMethod?: string;
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
  const grossAmount = round2(order.total);
  if (grossAmount <= 0) return null;
  const taxAmount = normalizeOrderTax(grossAmount, order.taxAmount);
  const revenueAmount = round2(grossAmount - taxAmount);

  const revenue = accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
  const taxPayable = taxAmount > 0
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

  const lines: JournalLineInput[] = [{ accountId: debitAcct.id, debit: grossAmount, credit: 0, description: 'Order sale' }];
  if (revenueAmount > 0) {
    lines.push({ accountId: revenue.id, debit: 0, credit: revenueAmount, description: 'Sales revenue' });
  }
  if (taxPayable && taxAmount > 0) {
    lines.push({ accountId: taxPayable.id, debit: 0, credit: taxAmount, description: 'Sales tax payable' });
  }

  const totalCogs = computeCogs(order.cogsLines);
  if (totalCogs > 0) {
    const fgBalance = await getPostedAccountNetDebitBalance(storeId, fgInv);
    lines.push(
      ...buildCogsInventoryReliefLines(
        totalCogs,
        cogsAcct.id,
        fgInv.id,
        rawInv.id,
        fgBalance,
      ),
    );
  }

  return postJournalEntry(
    {
      storeId,
      date: order.date,
      memo: `Order ${order.invoiceNumber || order.id}`,
      sourceType: 'order',
      sourceId: order.id,
      event: 'sale-recognized',
      voucherType: 'RV',
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
  const taxAmount = normalizeOrderTax(total, order.taxAmount);
  const revenueAmount = round2(total - taxAmount);

  const revenue = accountByCode(accounts, GL_ACCOUNT_CODES.REVENUE);
  const taxPayable = taxAmount > 0
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

  const lines: JournalLineInput[] = [];
  if (revenueAmount > 0) {
    lines.push({ accountId: revenue.id, debit: revenueAmount, credit: 0, description: 'Reverse order revenue' });
  }
  if (taxPayable && taxAmount > 0) {
    lines.push({ accountId: taxPayable.id, debit: taxAmount, credit: 0, description: 'Reverse sales tax payable' });
  }
  lines.push({ accountId: debitAcct.id, debit: 0, credit: total, description: 'Reverse cash/AR' });

  const totalCogs = computeCogs(order.cogsLines);
  if (totalCogs > 0) {
    const saleKey = buildSourceKey('order', order.id, 'sale-recognized');
    const saleEntrySnap = await getDb()
      .collection('stores')
      .doc(storeId)
      .collection('journalEntries')
      .where('sourceKey', '==', saleKey)
      .limit(1)
      .get();
    let split = { fgRelief: totalCogs, rawRelief: 0 };
    if (!saleEntrySnap.empty) {
      const saleLines = await loadJournalLinesForEntry(storeId, saleEntrySnap.docs[0].id);
      split = parseCogsReliefSplit(saleLines, fgInv.id, rawInv.id, totalCogs);
    }
    lines.push(
      ...buildCogsInventoryReversalLines(totalCogs, cogsAcct.id, fgInv.id, rawInv.id, split),
    );
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

function accountByCodeForPosting(accounts: LedgerAccount[], code: string): LedgerAccount | null {
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
  const now = new Date().toISOString();
  await getDb()
    .collection('stores')
    .doc(storeId)
    .collection('ledgerAccounts')
    .doc(acct.id)
    .update({ isActive: true, updatedAt: now });
  return { ...acct, isActive: true };
}

export async function autoPostPurchaseReceived(
  storeId: string,
  purchase: PlatformPurchaseInput,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const status = (purchase.status || 'received').toLowerCase();
  if (!['received', 'fulfilled', 'approved', 'paid'].includes(status)) return null;

  const split = resolvePurchaseReceiveSplit(purchase);
  if (!split || split.apCredit <= 0) return null;

  const inventory = accountByCode(accounts, GL_ACCOUNT_CODES.INVENTORY);
  const ap = accountByCode(accounts, GL_ACCOUNT_CODES.AP);
  let inputVatAcct: LedgerAccount | null = null;
  if (split.inputVatDebit > 0) {
    inputVatAcct = await ensureAccountActive(storeId, accounts, INPUT_VAT_CODE);
    if (inputVatAcct) {
      const idx = accounts.findIndex((a) => a.id === inputVatAcct!.id);
      if (idx >= 0) accounts[idx] = inputVatAcct;
    }
  } else {
    inputVatAcct = accountByCodeForPosting(accounts, INPUT_VAT_CODE);
  }

  const lines: JournalLineInput[] = [
    {
      accountId: inventory.id,
      debit: split.inventoryDebit,
      credit: 0,
      description: 'Inventory received (net)',
    },
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
    accountId: ap.id,
    debit: 0,
    credit: split.apCredit,
    description: 'Accounts payable (TTC)',
  });

  return postJournalEntry(
    {
      storeId,
      date: purchase.date,
      memo: `Purchase ${purchase.id} — ${purchase.supplierName || ''}`.trim(),
      sourceType: 'purchase',
      sourceId: purchase.id,
      event: 'received',
      createdBy,
      lines,
    },
    accountsMap(accounts),
  );
}

export async function autoPostExpensePaid(
  storeId: string,
  expense: PlatformExpenseInput,
  accounts: LedgerAccount[],
  createdBy?: string,
): Promise<PostJournalResult | null> {
  const amount = round2(expense.amount);
  if (amount <= 0) return null;

  const expenseAcct = accountByCode(
    accounts,
    resolveExpenseAccountCode({
      category: expense.category,
      vendor: expense.vendor,
      description: expense.description,
    }),
  );
  const cashAcct = accountByCode(accounts, cashOrBank(expense.paymentMethod));

  return postJournalEntry(
    {
      storeId,
      date: expense.date,
      memo: `Expense ${expense.id} — ${expense.description || expense.category || ''}`.trim(),
      sourceType: 'expense',
      sourceId: expense.id,
      event: 'paid',
      createdBy,
      lines: [
        { accountId: expenseAcct.id, debit: amount, credit: 0, description: 'Expense paid' },
        { accountId: cashAcct.id, debit: 0, credit: amount, description: 'Cash/bank payment' },
      ],
    },
    accountsMap(accounts),
  );
}

/** Production start (WIP): Dr WIP / Cr Raw Materials. */
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

/** Qty/cost variance between planned (start) and actual (complete). */
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

/** Production complete (WIP path): Dr FG / Cr WIP for actual material cost. */
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

/** Orchestrate WIP complete: optional variance entry, then FG capitalization. */
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

/** Production complete (legacy): Dr FG / Cr Raw Materials — no WIP start posted. */
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

/** Reverse production GL (delete batch / rollback). */
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
