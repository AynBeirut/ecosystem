import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { canUseModule } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';
import type { CrmPipelineStage } from '@/types/crm';

const STAGE_RANK: Record<CrmPipelineStage, number> = {
  new_lead: 0,
  contacted: 1,
  interested: 2,
  proposal_sent: 3,
  negotiation: 4,
  closed: 5,
  lost: -1,
};

export type SyncOrderCrmInput = {
  storeId: string;
  orderId: string;
  customerId: string;
  assignedSalesPerson?: string;
  assignedSalesPersonName?: string;
  invoiceNumber?: string;
  total: number;
  status?: string;
  paymentStatus?: string;
  createdAt: string;
  createdBy: string;
};

function pipelineFromOrder(input: SyncOrderCrmInput): CrmPipelineStage | null {
  if (input.status === 'cancelled') return null;
  const paid = input.paymentStatus === 'paid';
  const done = ['delivered', 'completed', 'confirmed'].includes(input.status || '');
  if (paid || done) return 'closed';
  return 'negotiation';
}

function shouldAdvanceStage(current: string | undefined, next: CrmPipelineStage): boolean {
  if (!current || !(current in STAGE_RANK)) return true;
  if (current === 'lost') return false;
  return STAGE_RANK[next as CrmPipelineStage] > STAGE_RANK[current as CrmPipelineStage];
}

async function resolveCreatorRep(
  storeId: string,
  createdBy: string,
): Promise<{ repId: string; repName: string }> {
  const uid = createdBy || storeId;
  const db = getFirestore();
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (userSnap.exists()) {
    const u = userSnap.data();
    const name = String(u?.name || u?.displayName || u?.email || 'Store admin');
    if (uid === storeId) return { repId: `owner:${storeId}`, repName: name };
    return { repId: `user:${uid}`, repName: name };
  }
  return { repId: `owner:${storeId}`, repName: 'Store admin' };
}

async function resolveRep(
  storeId: string,
  salesPersonId: string,
  salesPersonName: string,
): Promise<{ repId: string; repName: string; assignedRepId?: string }> {
  const db = getFirestore();
  const subSnap = await getDoc(doc(db, 'subAccounts', salesPersonId));
  if (subSnap.exists() && subSnap.data()?.storeId === storeId) {
    const sub = subSnap.data()!;
    const name = String(sub.name || salesPersonName || 'Sales');
    const email = String(sub.email || '').trim().toLowerCase();
    if (email) {
      const repQ = await getDocs(
        query(collection(db, 'crmReps'), where('storeId', '==', storeId), where('email', '==', email)),
      );
      if (!repQ.empty) {
        const rep = repQ.docs[0];
        return {
          repId: rep.id,
          repName: String(rep.data().name || name),
          assignedRepId: rep.id,
        };
      }
    }
    return { repId: `sub:${salesPersonId}`, repName: name };
  }

  const staffSnap = await getDoc(doc(db, 'staff', salesPersonId));
  if (staffSnap.exists()) {
    return {
      repId: `staff:${salesPersonId}`,
      repName: String(staffSnap.data()?.name || salesPersonName || 'Sales'),
    };
  }

  return { repId: `sales:${salesPersonId}`, repName: salesPersonName || 'Sales' };
}

/** Client-side mirror of order → CRM (owner sessions). Cloud Function covers sub-accounts too. */
export async function syncOrderToCrmClient(input: SyncOrderCrmInput): Promise<void> {
  if (!input.storeId || !input.customerId) return;

  const db = getFirestore();
  const storeSnap = await getDoc(doc(db, 'storeProfiles', input.storeId));
  if (!storeSnap.exists() || !canUseModule(storeSnap.data() as StoreProfile, 'crm')) return;

  const customerSnap = await getDoc(doc(db, 'customers', input.customerId));
  if (!customerSnap.exists()) return;
  const customer = customerSnap.data();
  if (customer?.storeId && customer.storeId !== input.storeId) return;

  const stageAfter = pipelineFromOrder(input);
  if (!stageAfter) return;

  const activityId = `order_${input.orderId}`;
  const activityRef = doc(db, 'crmActivities', activityId);
  if ((await getDoc(activityRef)).exists()) return;

  const rep = input.assignedSalesPerson
    ? await resolveRep(
        input.storeId,
        input.assignedSalesPerson,
        input.assignedSalesPersonName || '',
      )
    : await resolveCreatorRep(input.storeId, input.createdBy);
  const result = stageAfter === 'closed' ? 'closed' : 'interested';
  const invoice = input.invoiceNumber || input.orderId.slice(-8);
  const notes = `Sales order ${invoice}${input.total ? ` — $${input.total.toFixed(2)}` : ''}${
    input.status ? ` (${input.status})` : ''
  }`;

  await setDoc(activityRef, {
    storeId: input.storeId,
    customerId: input.customerId,
    repId: rep.repId,
    repName: rep.repName,
    type: 'order',
    loggedAt: input.createdAt,
    result,
    notes,
    followUpAt: null,
    location: null,
    pipelineStageAfter: stageAfter,
    orderId: input.orderId,
    orderTotal: input.total,
    invoiceNumber: input.invoiceNumber || null,
    repKind: rep.repId.includes(':') ? rep.repId.split(':')[0] : 'crm',
    source: 'order',
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });

  const customerUpdate: Record<string, unknown> = {
    crmEnabled: true,
    lastActivityAt: input.createdAt,
    lastActivityResult: result,
    updatedAt: new Date().toISOString(),
  };

  // Only auto-assign rep on first order AND only if admin hasn't intentionally unassigned
  const adminUnassigned = customer?.crmAdminUnassigned === true;
  if (!adminUnassigned && 'assignedRepId' in rep && rep.assignedRepId && !customer?.assignedRepId) {
    customerUpdate.assignedRepId = rep.assignedRepId;
  }
  if (shouldAdvanceStage(customer?.pipelineStage as string | undefined, stageAfter)) {
    customerUpdate.pipelineStage = stageAfter;
  }
  if (input.total > 0 && (customer?.dealValue == null || customer?.dealValue === 0)) {
    customerUpdate.dealValue = input.total;
  }

  await updateDoc(doc(db, 'customers', input.customerId), customerUpdate);
}
