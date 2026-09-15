import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { OWNER_RECEIVABLE_CLIENT_IDS } from '@/lib/ownerReceivables';

/** Primary service-income clients (always shown first in reports). */
export const OWNER_SERVICE_INCOME_CLIENTS = [
  { id: 'cli-youssif-malek-electrical', label: 'Youssif Malek', kind: 'electrical' as const },
  { id: 'cli-wissam-web-app', label: 'Wissam Mansour', kind: 'dev' as const },
  { id: 'cli-ali-webi-borej-hajal', label: 'Ali Webi — Borej le Hajal', kind: 'electrical' as const },
] as const;

export type OwnerServiceIncomeClientId = string;

export type OwnerServiceIncomeClient = {
  id: OwnerServiceIncomeClientId;
  label: string;
  kind: 'electrical' | 'dev' | 'yoga' | 'other';
};

export type OwnerServiceIncomeReceipt = {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  voucherNumber: string;
  notes?: string;
  sourceId?: string;
};

function toPaymentDate(data: Record<string, unknown>): string {
  const raw =
    (typeof data.paymentDate === 'string' && data.paymentDate) ||
    (typeof data.paidAt === 'string' && data.paidAt) ||
    (typeof data.date === 'string' && data.date) ||
    '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'pending') return '';
  return trimmed.slice(0, 10);
}

function clientKind(clientId: string, customerType?: string): OwnerServiceIncomeClient['kind'] {
  if (clientId.includes('yoga') || customerType === 'yoga') return 'yoga';
  if (clientId.includes('web-app') || clientId.includes('wissam')) return 'dev';
  if (clientId.includes('electrical') || customerType === 'electrical_project') return 'electrical';
  return 'other';
}

function clientLabel(clientId: string, clientName?: string, known?: OwnerServiceIncomeClient): string {
  if (known?.label) return known.label;
  if (clientName?.trim()) return clientName.trim();
  return clientId.replace(/^cli-/, '').replace(/-/g, ' ');
}

export async function discoverOwnerServiceIncomeClients(
  db: Firestore,
  storeId: string,
): Promise<OwnerServiceIncomeClient[]> {
  const [rcptSnap, custSnap] = await Promise.all([
    getDocs(collection(db, 'stores', storeId, 'financeReceipts')),
    getDocs(query(collection(db, 'customers'), where('storeId', '==', storeId))),
  ]);

  const customerById = new Map(custSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>]));
  const totals = new Map<string, { label: string; total: number; kind: OwnerServiceIncomeClient['kind'] }>();

  for (const docSnap of rcptSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const clientId = String(data.clientId || '');
    if (!clientId || OWNER_RECEIVABLE_CLIENT_IDS.has(clientId)) continue;
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const cust = customerById.get(clientId);
    const known = OWNER_SERVICE_INCOME_CLIENTS.find((c) => c.id === clientId);
    const label = clientLabel(clientId, String(data.clientName || cust?.name || ''), known);
    const kind = known?.kind || clientKind(clientId, String(cust?.customerType || ''));
    const cur = totals.get(clientId) || { label, total: 0, kind };
    cur.total += amount;
    totals.set(clientId, cur);
  }

  const primary = OWNER_SERVICE_INCOME_CLIENTS.map((c) => ({
    id: c.id,
    label: c.label,
    kind: c.kind,
  }));

  const extra = [...totals.entries()]
    .filter(([id]) => !primary.some((p) => p.id === id))
    .map(([id, meta]) => ({ id, label: meta.label, kind: meta.kind }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...primary, ...extra];
}

export async function listOwnerServiceIncomeReceipts(
  db: Firestore,
  storeId: string,
  clients?: OwnerServiceIncomeClient[],
): Promise<OwnerServiceIncomeReceipt[]> {
  const clientList = clients ?? (await discoverOwnerServiceIncomeClients(db, storeId));
  const allowed = new Set(clientList.map((c) => c.id));
  if (allowed.size === 0) return [];

  const snap = await getDocs(collection(db, 'stores', storeId, 'financeReceipts'));

  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const clientId = String(data.clientId || '');
      if (!allowed.has(clientId) || OWNER_RECEIVABLE_CLIENT_IDS.has(clientId)) return null;
      const paymentDate = toPaymentDate(data);
      if (!paymentDate) return null;
      return {
        id: docSnap.id,
        clientId,
        clientName: clientLabel(clientId, String(data.clientName || '')),
        amount: Math.round(amount * 100) / 100,
        currency: String(data.currency || 'USD'),
        paymentDate,
        voucherNumber: String(data.voucherNumber || data.number || docSnap.id),
        notes: typeof data.notes === 'string' ? data.notes : undefined,
        sourceId: typeof data.sourceId === 'string' ? data.sourceId : undefined,
      } satisfies OwnerServiceIncomeReceipt;
    })
    .filter((row): row is OwnerServiceIncomeReceipt => Boolean(row))
    .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : a.paymentDate > b.paymentDate ? -1 : 0));
}

export type OwnerIncomeMonthRow = {
  month: string;
  label: string;
  byClient: Record<string, number>;
  total: number;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_LABELS[m - 1] ?? ym} ${y}`;
}

export function aggregateOwnerServiceIncomeByMonth(
  receipts: OwnerServiceIncomeReceipt[],
  clients: OwnerServiceIncomeClient[],
  startDate?: string,
  endDate?: string,
): { rows: OwnerIncomeMonthRow[]; grandByClient: Record<string, number>; grandTotal: number } {
  const grandByClient = Object.fromEntries(clients.map((c) => [c.id, 0])) as Record<string, number>;
  let grandTotal = 0;

  const bucket = new Map<string, Record<string, number>>();

  for (const receipt of receipts) {
    if (startDate && receipt.paymentDate < startDate) continue;
    if (endDate && receipt.paymentDate > endDate) continue;
    const month = receipt.paymentDate.slice(0, 7);
    if (!month || month.length < 7) continue;
    const row =
      bucket.get(month) ??
      (Object.fromEntries(clients.map((c) => [c.id, 0])) as Record<string, number>);
    if (!(receipt.clientId in row)) {
      row[receipt.clientId] = 0;
    }
    row[receipt.clientId] = Math.round((row[receipt.clientId] + receipt.amount) * 100) / 100;
    bucket.set(month, row);
    grandByClient[receipt.clientId] = Math.round(((grandByClient[receipt.clientId] || 0) + receipt.amount) * 100) / 100;
    grandTotal = Math.round((grandTotal + receipt.amount) * 100) / 100;
  }

  const rows = [...bucket.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([month, byClient]) => ({
      month,
      label: monthLabel(month),
      byClient,
      total: Math.round(clients.reduce((sum, c) => sum + (byClient[c.id] || 0), 0) * 100) / 100,
    }));

  return { rows, grandByClient, grandTotal };
}
