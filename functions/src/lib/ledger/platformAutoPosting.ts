import { GL_ACCOUNT_CODES } from './defaultChartOfAccounts';
import { hasMaterialVariance, productionVarianceCost } from './productionWipCore';
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
