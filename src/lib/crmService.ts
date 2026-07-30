import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import type { Customer } from '@/types/order';
import type {
  CrmActivity,
  CrmActivityResult,
  CrmActivitySource,
  CrmActivityType,
  CrmGeoLocation,
  CrmPipelineStage,
  CrmRep,
} from '@/types/crm';
import { pipelineStageFromActivityResult } from '@/lib/crm';

export type CrmClient = Customer & {
  customerCode?: string | null;
  customerType?: string | null;
  district?: string | null;
  area?: string | null;
  location?: CrmGeoLocation | null;
  lastVisitDate?: string | null;
  pipelineStage?: CrmPipelineStage;
  assignedRepId?: string | null;
  crmEnabled?: boolean;
};

export type ActivityFilters = {
  repId?: string;
  customerId?: string;
  type?: CrmActivityType;
  result?: CrmActivityResult;
  fromDate?: string;
  toDate?: string;
};

function db() {
  return getFirestore();
}

export async function fetchCrmReps(storeId: string): Promise<CrmRep[]> {
  const snap = await getDocs(query(collection(db(), 'crmReps'), where('storeId', '==', storeId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as CrmRep))
    .filter((r) => r.status === 'active' || r.status === 'suspended')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCrmClients(
  storeId: string,
  opts?: { repId?: string; crmOnly?: boolean },
): Promise<CrmClient[]> {
  const constraints: QueryConstraint[] = [where('storeId', '==', storeId)];
  if (opts?.repId) constraints.push(where('assignedRepId', '==', opts.repId));
  const snap = await getDocs(query(collection(db(), 'customers'), ...constraints));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CrmClient));
  if (opts?.crmOnly) list = list.filter((c) => c.crmEnabled);
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function fetchCrmClient(clientId: string): Promise<CrmClient | null> {
  const snap = await getDoc(doc(db(), 'customers', clientId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CrmClient;
}

export async function createCrmClient(
  storeId: string,
  data: {
    name: string;
    customerCode?: string;
    customerType?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    district?: string;
    area?: string;
    location?: CrmGeoLocation | null;
    assignedRepId?: string;
    dealValue?: number;
    notes?: string;
    status?: 'active' | 'inactive';
  },
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db(), 'customers'), {
    storeId,
    name: data.name.trim(),
    customerCode: data.customerCode?.trim() || null,
    customerType: data.customerType || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    country: data.country?.trim() || null,
    district: data.district?.trim() || null,
    area: data.area?.trim() || null,
    location: data.location || null,
    notes: data.notes?.trim() || null,
    crmEnabled: true,
    pipelineStage: 'new_lead',
    assignedRepId: data.assignedRepId || null,
    dealValue: data.dealValue ?? null,
    dealCurrency: 'USD',
    status: data.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateCrmClientFields(
  clientId: string,
  fields: Partial<CrmClient>,
): Promise<void> {
  await updateDoc(doc(db(), 'customers', clientId), {
    ...fields,
    updatedAt: new Date().toISOString(),
  });
}

export async function setPipelineStage(
  clientId: string,
  stage: CrmPipelineStage,
): Promise<void> {
  await updateCrmClientFields(clientId, { pipelineStage: stage, crmEnabled: true });
}

export async function fetchActivities(
  storeId: string,
  filters?: ActivityFilters,
  max = 500,
): Promise<CrmActivity[]> {
  const constraints: QueryConstraint[] = [
    where('storeId', '==', storeId),
    orderBy('loggedAt', 'desc'),
  ];
  if (filters?.repId) constraints.splice(1, 0, where('repId', '==', filters.repId));
  if (filters?.customerId) constraints.splice(1, 0, where('customerId', '==', filters.customerId));
  const snap = await getDocs(query(collection(db(), 'crmActivities'), ...constraints));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CrmActivity));

  if (filters?.type) list = list.filter((a) => a.type === filters.type);
  if (filters?.result) list = list.filter((a) => a.result === filters.result);
  if (filters?.fromDate) {
    const from = new Date(filters.fromDate).getTime();
    list = list.filter((a) => new Date(a.loggedAt).getTime() >= from);
  }
  if (filters?.toDate) {
    const to = new Date(filters.toDate).getTime() + 86400000;
    list = list.filter((a) => new Date(a.loggedAt).getTime() < to);
  }

  return list.slice(0, max);
}

export async function updateCrmRep(
  repId: string,
  fields: Partial<Pick<CrmRep, 'assignedTerritory' | 'dailyVisitTarget' | 'phone' | 'name'>>,
): Promise<void> {
  await updateDoc(doc(db(), 'crmReps', repId), {
    ...fields,
    updatedAt: new Date().toISOString(),
  });
}

export async function logCrmActivity(input: {
  storeId: string;
  customerId: string;
  repId: string;
  repName: string;
  type: CrmActivityType;
  loggedAt: string;
  result: CrmActivityResult;
  notes?: string;
  followUpAt?: string | null;
  location?: CrmGeoLocation | null;
  timeIn?: string | null;
  timeOut?: string | null;
  visitCompleted?: boolean;
  orderTaken?: boolean;
  source: CrmActivitySource;
  createdBy: string;
  advancePipeline?: boolean;
}): Promise<string> {
  const stageAfter = pipelineStageFromActivityResult(input.result);
  const timeIn = input.timeIn || input.loggedAt;
  const activityPayload = {
    storeId: input.storeId,
    customerId: input.customerId,
    repId: input.repId,
    repName: input.repName,
    type: input.type,
    loggedAt: input.loggedAt,
    timeIn,
    timeOut: input.timeOut || null,
    result: input.result,
    notes: input.notes?.trim() || '',
    followUpAt: input.followUpAt || null,
    location: input.location || null,
    visitCompleted: input.visitCompleted ?? (input.type === 'visit'),
    orderTaken: input.orderTaken ?? false,
    pipelineStageAfter: stageAfter,
    createdBy: input.createdBy,
    source: input.source,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db(), 'crmActivities'), activityPayload);

  const customerUpdate: Record<string, unknown> = {
    lastActivityAt: input.loggedAt,
    lastActivityResult: input.result,
    crmEnabled: true,
    updatedAt: new Date().toISOString(),
  };
  if (input.followUpAt) customerUpdate.nextFollowUpAt = input.followUpAt;
  if (input.advancePipeline !== false && stageAfter) {
    customerUpdate.pipelineStage = stageAfter;
  }
  const visitDone = activityPayload.visitCompleted === true;
  if (input.type === 'visit' && visitDone) {
    customerUpdate.lastVisitDate = input.loggedAt;
  }

  await updateDoc(doc(db(), 'customers', input.customerId), customerUpdate);
  return ref.id;
}

export async function removeFromCrm(clientId: string): Promise<void> {
  await updateDoc(doc(db(), 'customers', clientId), {
    crmEnabled: true,
    assignedRepId: null,
    pipelineStage: 'new_lead',
    crmAdminUnassigned: true,
    updatedAt: new Date().toISOString(),
  });
}

export function isFollowUpOverdue(client: CrmClient): boolean {
  if (!client.nextFollowUpAt) return false;
  return new Date(client.nextFollowUpAt).getTime() < Date.now();
}

export function daysSinceLastActivity(client: CrmClient): number | null {
  if (!client.lastActivityAt) return null;
  const diff = Date.now() - new Date(client.lastActivityAt).getTime();
  return Math.floor(diff / 86400000);
}
