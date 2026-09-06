import * as admin from 'firebase-admin';
import { getFcmTokensForUser } from './fcmTokens';
import type { AssistantRole } from './smartAssistantCopy';
import { mapSubRoleToAssistant } from './smartAssistantCopy';

const db = admin.firestore();

export type StoreTeamMember = {
  userId: string;
  displayName: string;
  role: AssistantRole;
  subAccountId?: string;
};

async function resolveSubAccountName(subAccountId: string): Promise<{ name: string; role: string } | null> {
  const snap = await db.collection('subAccounts').doc(subAccountId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    name: String(data.name || '').trim(),
    role: String(data.role || 'sales'),
  };
}

export async function getStoreTeamMembers(storeId: string): Promise<StoreTeamMember[]> {
  const members: StoreTeamMember[] = [];
  const seen = new Set<string>();

  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  const ownerId = storeSnap.exists ? String(storeSnap.data()?.ownerId || '') : '';
  if (ownerId) {
    const ownerSnap = await db.collection('users').doc(ownerId).get();
    const ownerData = ownerSnap.data() || {};
    const ownerName = String(ownerData.name || ownerData.displayName || ownerData.email || 'Owner').trim();
    members.push({ userId: ownerId, displayName: ownerName, role: 'owner' });
    seen.add(ownerId);
  }

  const teamSnap = await db.collection('users').where('storeId', '==', storeId).get();
  for (const docSnap of teamSnap.docs) {
    if (seen.has(docSnap.id)) continue;
    const data = docSnap.data();
    const role = String(data.role || '');
    let subRole = String(data.subAccountRole || '');
    let displayName = String(data.name || data.displayName || data.email || '').trim();

    if (role === 'sub_account' && data.subAccountId) {
      const sub = await resolveSubAccountName(String(data.subAccountId));
      if (sub) {
        if (sub.name) displayName = sub.name;
        subRole = sub.role;
      }
      members.push({
        userId: docSnap.id,
        displayName: displayName || 'Team member',
        role: mapSubRoleToAssistant(role, subRole),
        subAccountId: String(data.subAccountId),
      });
      seen.add(docSnap.id);
      continue;
    }

    if (role === 'crm_rep') {
      members.push({
        userId: docSnap.id,
        displayName: displayName || 'CRM rep',
        role: 'crm_rep',
      });
      seen.add(docSnap.id);
    }
  }

  return members;
}

/** Map assignedRepId → Firebase user ids for personalized push. */
export async function userIdsForAssignedRep(
  storeId: string,
  assignedRepId: string,
): Promise<Array<{ userId: string; displayName: string }>> {
  const out: Array<{ userId: string; displayName: string }> = [];

  if (assignedRepId.startsWith('sub:')) {
    const subId = assignedRepId.slice(4);
    const subSnap = await db.collection('subAccounts').doc(subId).get();
    const subName = subSnap.exists ? String(subSnap.data()?.name || '').trim() : '';
    const usersSnap = await db.collection('users').where('subAccountId', '==', subId).limit(3).get();
    usersSnap.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data();
      out.push({
        userId: d.id,
        displayName: subName || String(data.name || data.email || 'Team member'),
      });
    });
    return out;
  }

  if (assignedRepId.startsWith('owner:')) {
    const ownerId = assignedRepId.slice(6) === storeId
      ? String((await db.collection('storeProfiles').doc(storeId).get()).data()?.ownerId || '')
      : '';
    if (ownerId) {
      const ownerSnap = await db.collection('users').doc(ownerId).get();
      const name = ownerSnap.exists
        ? String(ownerSnap.data()?.name || ownerSnap.data()?.email || 'Owner')
        : 'Owner';
      out.push({ userId: ownerId, displayName: name });
    }
    return out;
  }

  const repSnap = await db.collection('crmReps').doc(assignedRepId).get();
  if (repSnap.exists) {
    const repData = repSnap.data() || {};
    const uid = repData.firebaseUid;
    if (typeof uid === 'string' && uid) {
      out.push({ userId: uid, displayName: String(repData.name || 'Rep') });
      return out;
    }
  }

  const teamSnap = await db.collection('users').where('storeId', '==', storeId).get();
  for (const docSnap of teamSnap.docs) {
    if (docSnap.data().crmRepId === assignedRepId) {
      out.push({
        userId: docSnap.id,
        displayName: String(docSnap.data().name || docSnap.data().email || 'Rep'),
      });
    }
  }

  return out;
}

export async function sendPersonalizedPush(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<boolean> {
  const tokens = await getFcmTokensForUser(userId);
  if (tokens.length === 0) return false;
  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: { channelId: 'grabio_assistant' },
    },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
  return true;
}
