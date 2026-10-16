import firestore from '@react-native-firebase/firestore';
import type { BillingType, FinanceClientPlan } from '../types';
import { FINANCE_COLLECTIONS } from './dataModel';

const nowIso = () => new Date().toISOString();

function plansCol(storeId: string) {
  return firestore().collection('stores').doc(storeId).collection(FINANCE_COLLECTIONS.clientPlans);
}

function currentUsageMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mapPlan(id: string, data: Record<string, unknown>): FinanceClientPlan {
  return {
    id,
    storeId: data.storeId ? String(data.storeId) : undefined,
    clientId: String(data.clientId || ''),
    clientName: String(data.clientName || ''),
    productId: data.productId ? String(data.productId) : undefined,
    productName: data.productName ? String(data.productName) : undefined,
    title: String(data.title || ''),
    billingType: (data.billingType as BillingType) || 'one_time',
    amount: Number(data.amount) || 0,
    currency: String(data.currency || 'USD'),
    monthlyUnits: data.monthlyUnits != null ? Number(data.monthlyUnits) : undefined,
    paymentMethod: String(data.paymentMethod || 'cash'),
    paymentSource: data.paymentSource ? String(data.paymentSource) : undefined,
    status: data.status === 'cancelled' ? 'cancelled' : 'active',
    unitsUsedThisMonth: data.unitsUsedThisMonth != null ? Number(data.unitsUsedThisMonth) : 0,
    usageMonth: data.usageMonth ? String(data.usageMonth) : undefined,
    lastPaymentAt: data.lastPaymentAt ? String(data.lastPaymentAt) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export async function listClientPlans(storeId: string): Promise<FinanceClientPlan[]> {
  const snap = await plansCol(storeId).orderBy('clientName').limit(300).get();
  return snap.docs.map((d) => mapPlan(d.id, d.data() as Record<string, unknown>));
}

export async function getClientPlan(storeId: string, planId: string): Promise<FinanceClientPlan | null> {
  const snap = await plansCol(storeId).doc(planId).get();
  if (!snap.exists()) return null;
  return mapPlan(snap.id, snap.data() as Record<string, unknown>);
}

export async function saveClientPlan(
  storeId: string,
  input: Omit<FinanceClientPlan, 'id'> & { id?: string },
): Promise<string> {
  const now = nowIso();
  const ref = input.id ? plansCol(storeId).doc(input.id) : plansCol(storeId).doc();
  const month = currentUsageMonth();
  await ref.set(
    {
      storeId,
      clientId: input.clientId,
      clientName: input.clientName,
      productId: input.productId || null,
      productName: input.productName || null,
      title: input.title,
      billingType: input.billingType,
      amount: input.amount,
      currency: input.currency || 'USD',
      monthlyUnits: input.billingType === 'monthly' ? Number(input.monthlyUnits) || 0 : null,
      paymentMethod: input.paymentMethod || 'cash',
      paymentSource: input.paymentSource || '',
      status: input.status || 'active',
      unitsUsedThisMonth: input.unitsUsedThisMonth ?? 0,
      usageMonth: input.usageMonth || month,
      lastPaymentAt: input.lastPaymentAt || null,
      notes: input.notes || '',
      updatedAt: now,
      ...(input.id ? {} : { createdAt: now }),
    },
    { merge: true },
  );
  return ref.id;
}

export async function deleteClientPlan(storeId: string, planId: string): Promise<void> {
  await plansCol(storeId).doc(planId).delete();
}

export function planUnitsRemaining(plan: FinanceClientPlan): number | null {
  if (plan.billingType !== 'monthly' || !plan.monthlyUnits) return null;
  const month = currentUsageMonth();
  const used = plan.usageMonth === month ? plan.unitsUsedThisMonth || 0 : 0;
  return Math.max(0, plan.monthlyUnits - used);
}

export async function incrementClientPlanTaskUsage(storeId: string, planId: string): Promise<void> {
  const plan = await getClientPlan(storeId, planId);
  if (!plan || plan.status !== 'active') throw new Error('Service plan not found');
  if (plan.billingType !== 'monthly') return;
  const month = currentUsageMonth();
  const used = plan.usageMonth === month ? plan.unitsUsedThisMonth || 0 : 0;
  const limit = plan.monthlyUnits || 0;
  if (limit > 0 && used >= limit) throw new Error(`Monthly limit reached (${limit} tasks)`);
  await plansCol(storeId).doc(planId).update({
    unitsUsedThisMonth: used + 1,
    usageMonth: month,
    updatedAt: nowIso(),
  });
}
