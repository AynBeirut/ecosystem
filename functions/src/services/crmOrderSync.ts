import * as admin from 'firebase-admin';
import { checkRealStoreForCommerce } from './storeCommerceGuard';

const SALES_CRM_ADDON = 'salesCrm';
const STAGE_RANK: Record<string, number> = {
  new_lead: 0,
  contacted: 1,
  interested: 2,
  proposal_sent: 3,
  negotiation: 4,
  closed: 5,
  lost: -1,
};

export type OrderCrmPayload = {
  storeId?: string;
  customerId?: string;
  customerName?: string;
  assignedSalesPerson?: string;
  assignedSalesPersonName?: string;
  invoiceNumber?: string;
  total?: number;
  status?: string;
  paymentStatus?: string;
  createdAt?: string | FirebaseFirestore.Timestamp;
  createdBy?: string;
};

function storeHasSalesCrm(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  const addOns = data.addOns;
  if (Array.isArray(addOns) && addOns.includes(SALES_CRM_ADDON)) return true;
  const meta = data.addOnsMeta as Record<string, unknown> | undefined;
  return Boolean(meta?.[SALES_CRM_ADDON]);
}

function orderLoggedAt(createdAt: unknown): string {
  if (createdAt && typeof (createdAt as FirebaseFirestore.Timestamp).toDate === 'function') {
    return (createdAt as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  if (typeof createdAt === 'string' && createdAt) return createdAt;
  return new Date().toISOString();
}

function pipelineFromOrder(order: OrderCrmPayload): 'negotiation' | 'closed' | null {
  if (order.status === 'cancelled') return null;
  const paid = order.paymentStatus === 'paid';
  const done = ['delivered', 'completed', 'confirmed'].includes(String(order.status || ''));
  if (paid || done) return 'closed';
  return 'negotiation';
}

function shouldAdvanceStage(current: string | undefined, next: 'negotiation' | 'closed'): boolean {
  if (!current || !(current in STAGE_RANK)) return true;
  if (current === 'lost') return false;
  return STAGE_RANK[next] > STAGE_RANK[current];
}

async function resolveCreatorRep(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  createdBy: string,
): Promise<{ repId: string; repName: string }> {
  const uid = createdBy || storeId;
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists) {
    const u = userSnap.data()!;
    const name = String(u.name || u.displayName || u.email || 'Store admin');
    if (uid === storeId) return { repId: `owner:${storeId}`, repName: name };
    return { repId: `user:${uid}`, repName: name };
  }
  return { repId: `owner:${storeId}`, repName: 'Store admin' };
}

async function resolveRep(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  salesPersonId: string,
  salesPersonName: string,
): Promise<{ repId: string; repName: string; assignedRepId?: string }> {
  const subSnap = await db.collection('subAccounts').doc(salesPersonId).get();
  if (subSnap.exists && subSnap.data()?.storeId === storeId) {
    const sub = subSnap.data()!;
    const name = String(sub.name || salesPersonName || 'Sales');
    const email = String(sub.email || '').trim().toLowerCase();
    if (email) {
      const repQ = await db
        .collection('crmReps')
        .where('storeId', '==', storeId)
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!repQ.empty) {
        const rep = repQ.docs[0];
        return { repId: rep.id, repName: String(rep.data().name || name), assignedRepId: rep.id };
      }
    }
    return { repId: `sub:${salesPersonId}`, repName: name };
  }

  const staffSnap = await db.collection('staff').doc(salesPersonId).get();
  if (staffSnap.exists) {
    const name = String(staffSnap.data()?.name || salesPersonName || 'Sales');
    return { repId: `staff:${salesPersonId}`, repName: name };
  }

  return {
    repId: `sales:${salesPersonId}`,
    repName: salesPersonName || 'Sales',
  };
}

/**
 * When a salesperson creates an order for a store customer, mirror it into Sales CRM.
 */
export async function syncOrderToCrm(orderId: string, order: OrderCrmPayload): Promise<void> {
  const db = admin.firestore();
  const storeId = String(order.storeId || '').trim();
  const customerId = String(order.customerId || '').trim();
  const salesPersonId = String(order.assignedSalesPerson || '').trim();
  const salesPersonName = String(order.assignedSalesPersonName || '').trim();
  const createdBy = String(order.createdBy || storeId).trim();

  if (!storeId || !customerId) return;

  const commerceCheck = await checkRealStoreForCommerce(db, storeId);
  if (!commerceCheck.eligible) {
    console.warn('[crmOrderSync] skipped non-real store', storeId, commerceCheck.code);
    return;
  }

  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  if (!storeSnap.exists || !storeHasSalesCrm(storeSnap.data())) return;

  const customerSnap = await db.collection('customers').doc(customerId).get();
  if (!customerSnap.exists) return;
  const customer = customerSnap.data()!;
  if (customer.storeId && customer.storeId !== storeId) return;

  const stageAfter = pipelineFromOrder(order);
  if (!stageAfter) return;

  const activityId = `order_${orderId}`;
  const activityRef = db.collection('crmActivities').doc(activityId);
  const existing = await activityRef.get();
  if (existing.exists) return;

  const loggedAt = orderLoggedAt(order.createdAt);
  const total = typeof order.total === 'number' ? order.total : 0;
  const invoice = order.invoiceNumber || orderId.slice(-8);
  const rep = salesPersonId
    ? await resolveRep(db, storeId, salesPersonId, salesPersonName)
    : await resolveCreatorRep(db, storeId, createdBy);

  const result = stageAfter === 'closed' ? 'closed' : 'interested';
  const notes = `Sales order ${invoice}${total ? ` — $${total.toFixed(2)}` : ''}${order.status ? ` (${order.status})` : ''}`;

  await activityRef.set({
    storeId,
    customerId,
    repId: rep.repId,
    repName: rep.repName,
    type: 'order',
    loggedAt,
    result,
    notes,
    followUpAt: null,
    location: null,
    pipelineStageAfter: stageAfter,
    orderId,
    orderTotal: total,
    invoiceNumber: order.invoiceNumber || null,
    repKind: rep.repId.includes(':') ? rep.repId.split(':')[0] : 'crm',
    source: 'order',
    createdBy: order.createdBy || storeId,
    createdAt: new Date().toISOString(),
  });

  const customerUpdate: Record<string, unknown> = {
    crmEnabled: true,
    lastActivityAt: loggedAt,
    lastActivityResult: result,
    updatedAt: new Date().toISOString(),
  };

  // Only auto-assign rep on first order AND only if admin hasn't intentionally unassigned
  const adminUnassigned = customer.crmAdminUnassigned === true;
  const linkedRepId = 'assignedRepId' in rep ? rep.assignedRepId : undefined;
  if (!adminUnassigned && linkedRepId && !customer.assignedRepId) {
    customerUpdate.assignedRepId = linkedRepId;
  }

  const currentStage = customer.pipelineStage as string | undefined;
  if (shouldAdvanceStage(currentStage, stageAfter)) {
    customerUpdate.pipelineStage = stageAfter;
  }

  if (total > 0 && (customer.dealValue == null || customer.dealValue === 0)) {
    customerUpdate.dealValue = total;
  }

  await db.collection('customers').doc(customerId).set(customerUpdate, { merge: true });
}
