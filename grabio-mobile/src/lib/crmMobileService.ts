import firestore from '@react-native-firebase/firestore';
import type { CrmActivityResult, CrmActivityType } from './crmConstants';
import { pipelineFromResult } from './crmConstants';

export type CrmClient = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  pipelineStage?: string;
  assignedRepId?: string;
  nextFollowUpAt?: string;
  dealValue?: number;
  lastActivityAt?: string;
  crmEnabled?: boolean;
};

export async function fetchAssignedClients(storeId: string, repId: string): Promise<CrmClient[]> {
  const snap = await firestore()
    .collection('customers')
    .where('storeId', '==', storeId)
    .where('assignedRepId', '==', repId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as CrmClient))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function fetchClientActivities(storeId: string, customerId: string) {
  const snap = await firestore()
    .collection('crmActivities')
    .where('storeId', '==', storeId)
    .where('customerId', '==', customerId)
    .orderBy('loggedAt', 'desc')
    .limit(100)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function logActivity(input: {
  storeId: string;
  customerId: string;
  repId: string;
  repName: string;
  type: CrmActivityType;
  loggedAt: string;
  result: CrmActivityResult;
  notes: string;
  followUpAt: string | null;
  location: { lat: number; lng: number; accuracy?: number } | null;
  createdBy: string;
}) {
  const stageAfter = pipelineFromResult(input.result);
  await firestore().collection('crmActivities').add({
    storeId: input.storeId,
    customerId: input.customerId,
    repId: input.repId,
    repName: input.repName,
    type: input.type,
    loggedAt: input.loggedAt,
    result: input.result,
    notes: input.notes,
    followUpAt: input.followUpAt,
    location: input.location,
    pipelineStageAfter: stageAfter,
    createdBy: input.createdBy,
    source: 'mobile',
    createdAt: new Date().toISOString(),
  });

  const customerUpdate: Record<string, unknown> = {
    lastActivityAt: input.loggedAt,
    lastActivityResult: input.result,
    crmEnabled: true,
    updatedAt: new Date().toISOString(),
  };
  if (input.followUpAt) customerUpdate.nextFollowUpAt = input.followUpAt;
  if (stageAfter) customerUpdate.pipelineStage = stageAfter;

  await firestore().collection('customers').doc(input.customerId).update(customerUpdate);
}
