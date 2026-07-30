import { ensureDefaultChartOfAccounts } from './postingService';
import {
  autoPostCashCollectionDeposit,
  autoPostDeliveryWalletCodCollected,
  autoPostDeliveryWalletSettlement,
  autoPostExpensePaid,
  autoPostOrderSaleRecognized,
  autoPostOrderSaleReversal,
  autoPostPayrollPayment,
  autoPostPurchaseReceived,
  autoPostProductionComplete,
  autoPostProductionReversal,
  autoPostProductionStart,
  autoPostProductionWipCompleteFlow,
  type PlatformExpenseInput,
  type PlatformPurchaseInput,
  type ProductionReversalInput,
  type OrderCogsLine,
  type PlatformOrderInput,
} from './platformAutoPosting';

export type { OrderCogsLine, PlatformOrderInput };

function wrapGl<T>(scope: string, fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GL][${scope}]`, err);
    throw new Error(`GL posting failed (${scope}): ${message}`);
  });
}

export async function glPostOrderSaleRecognized(storeId: string, order: PlatformOrderInput): Promise<void> {
  await wrapGl('order-sale', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostOrderSaleRecognized(storeId, order, accounts);
  });
}

export async function glPostOrderSaleReversal(
  storeId: string,
  order: PlatformOrderInput,
  reversalId: string,
): Promise<void> {
  await wrapGl('order-reversal', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostOrderSaleReversal(storeId, order, accounts, reversalId);
  });
}

export async function glPostProductionStart(
  storeId: string,
  batchId: string,
  materialsCost: number,
  date: string,
): Promise<void> {
  await wrapGl('production-start', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionStart(storeId, batchId, materialsCost, date, accounts);
  });
}

export async function glPostProductionWipComplete(
  storeId: string,
  batchId: string,
  costStart: number,
  costActual: number,
  date: string,
): Promise<void> {
  await wrapGl('production-complete-wip', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionWipCompleteFlow(storeId, batchId, costStart, costActual, date, accounts);
  });
}

export async function glPostProductionComplete(
  storeId: string,
  batchId: string,
  materialsCost: number,
  date: string,
): Promise<void> {
  await wrapGl('production-complete', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionComplete(storeId, batchId, materialsCost, date, accounts);
  });
}

export async function glPostProductionReversal(
  storeId: string,
  batchId: string,
  reversalId: string,
  input: ProductionReversalInput,
  date: string,
): Promise<void> {
  await wrapGl('production-reversal', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionReversal(storeId, batchId, reversalId, input, date, accounts);
  });
}

export async function glPostPayrollPayment(
  storeId: string,
  paymentId: string,
  totalAmount: number,
  paymentDate: string,
  paymentMethod = 'bank',
): Promise<void> {
  await wrapGl('payroll', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostPayrollPayment(storeId, paymentId, totalAmount, paymentDate, paymentMethod, accounts);
  });
}

export async function glPostPurchaseReceived(
  storeId: string,
  purchase: PlatformPurchaseInput,
): Promise<void> {
  await wrapGl('purchase', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostPurchaseReceived(storeId, purchase, accounts);
  });
}

export async function glPostExpensePaid(
  storeId: string,
  expense: PlatformExpenseInput,
): Promise<void> {
  await wrapGl('expense', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostExpensePaid(storeId, expense, accounts);
  });
}

export async function glPostCashCollectionDeposit(
  storeId: string,
  collectionId: string,
  totalAmount: number,
  collectionDate: string,
): Promise<void> {
  await wrapGl('cash-collection', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostCashCollectionDeposit(storeId, collectionId, totalAmount, collectionDate, accounts);
  });
}

export async function glPostDeliveryWalletCodCollected(
  storeId: string,
  orderId: string,
  amount: number,
  collectionDate: string,
): Promise<void> {
  await wrapGl('delivery-wallet-cod', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostDeliveryWalletCodCollected(storeId, orderId, amount, collectionDate, accounts);
  });
}

export async function glPostDeliveryWalletSettlement(
  storeId: string,
  settlementId: string,
  amount: number,
  settlementDate: string,
  destination: 'cash' | 'bank' = 'cash',
): Promise<void> {
  await wrapGl('delivery-wallet', async () => {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostDeliveryWalletSettlement(storeId, settlementId, amount, settlementDate, accounts, undefined, destination);
  });
}
