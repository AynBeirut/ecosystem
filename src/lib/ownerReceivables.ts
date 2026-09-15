import { collection, getDocs, type Firestore } from 'firebase/firestore';

export type OwnerReceivable = {
  id: string;
  debtorName: string;
  amountUsd: number;
  amountLabel?: string;
  program?: string;
  financeClientId?: string;
  financeInvoiceId?: string;
  invoiceNumber?: string;
  nextPaymentDue?: string;
  updatedAt?: string;
};

/** Receivable AR clients — excluded from Whish service-income rollups. */
export const OWNER_RECEIVABLE_CLIENT_IDS = new Set(['client-stayha-solar', 'client-borj-el-hajal']);

function resolveAmount(data: Record<string, unknown>): { amount: number; label?: string } {
  if (typeof data.amountUsd === 'number' && data.amountUsd > 0) {
    return { amount: data.amountUsd };
  }
  if (typeof data.balanceDueUsd === 'number' && data.balanceDueUsd > 0) {
    return { amount: data.balanceDueUsd };
  }
  if (typeof data.stillFromStayhaUsd === 'number' && data.stillFromStayhaUsd > 0) {
    return { amount: data.stillFromStayhaUsd, label: 'Invoice balance (Stayha)' };
  }
  if (typeof data.outstandingPersonalUsd === 'number' && data.outstandingPersonalUsd > 0) {
    return { amount: data.outstandingPersonalUsd, label: 'Personal outstanding' };
  }
  if (typeof data.contractRemainingUsd === 'number' && data.contractRemainingUsd > 0) {
    return { amount: data.contractRemainingUsd, label: 'Contract remaining' };
  }
  return { amount: 0 };
}

export async function listOwnerReceivables(db: Firestore, storeId: string): Promise<OwnerReceivable[]> {
  const snap = await getDocs(collection(db, 'stores', storeId, 'ownerReceivables'));
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const { amount, label } = resolveAmount(data);
      const nextPayment = data.nextPayment as { dueDate?: string } | undefined;
      return {
        id: d.id,
        debtorName: String(data.debtorName || data.name || d.id),
        amountUsd: Math.round(amount * 100) / 100,
        amountLabel: label,
        program: data.program ? String(data.program) : undefined,
        financeClientId: data.financeClientId ? String(data.financeClientId) : undefined,
        financeInvoiceId: data.financeInvoiceId ? String(data.financeInvoiceId) : undefined,
        invoiceNumber: data.invoiceNumber ? String(data.invoiceNumber) : undefined,
        nextPaymentDue: nextPayment?.dueDate ? String(nextPayment.dueDate) : undefined,
        updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
      };
    })
    .filter((row) => row.amountUsd > 0)
    .sort((a, b) => b.amountUsd - a.amountUsd);
}

export function summarizeOwnerReceivables(rows: OwnerReceivable[]) {
  const total = rows.reduce((sum, row) => sum + row.amountUsd, 0);
  return { count: rows.length, totalUsd: Math.round(total * 100) / 100 };
}
