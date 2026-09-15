import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  getFirestore,
} from 'firebase/firestore';
import { resolveStoreOwnerDisplayName } from '@/lib/storeOwnerDisplay';

export type CrmAssignableAgent = {
  id: string;
  name: string;
  email?: string;
  userId?: string;
  role: 'owner' | 'crm_rep' | 'manager' | 'sales';
  assignedTerritory?: string | null;
  dailyVisitTarget?: number | null;
};

/** Same agent list as mobile — owner, CRM reps, sales sub-accounts. */
export async function fetchCrmAssignableAgents(storeId: string): Promise<CrmAssignableAgent[]> {
  const db = getFirestore();
  try {
    const [repResult, subResult, profileResult, usersResult] = await Promise.allSettled([
      getDocs(query(collection(db, 'crmReps'), where('storeId', '==', storeId))),
      getDocs(query(collection(db, 'subAccounts'), where('storeId', '==', storeId))),
      getDoc(doc(db, 'storeProfiles', storeId)),
      getDocs(query(collection(db, 'users'), where('storeId', '==', storeId))),
    ]);

    const repSnap = repResult.status === 'fulfilled' ? repResult.value : null;
    const subSnap = subResult.status === 'fulfilled' ? subResult.value : null;
    const profileSnap = profileResult.status === 'fulfilled' ? profileResult.value : null;

    const userIdBySubAccount = new Map<string, string>();
    if (usersResult.status === 'fulfilled') {
      usersResult.value.docs.forEach((u) => {
        const subId = u.data().subAccountId;
        if (typeof subId === 'string' && subId) userIdBySubAccount.set(subId, u.id);
      });
    }

    if (subSnap) {
      await Promise.all(
        subSnap.docs.map(async (subDoc) => {
          try {
            if (userIdBySubAccount.has(subDoc.id)) return;
            const linked = await getDocs(
              query(collection(db, 'users'), where('subAccountId', '==', subDoc.id)),
            );
            if (!linked.empty) userIdBySubAccount.set(subDoc.id, linked.docs[0].id);
          } catch {
            // Peer user reads may fail for sub-accounts — subAccount row still lists the agent.
          }
        }),
      );
    }

    const agents: CrmAssignableAgent[] = [];
    const seen = new Set<string>();

    const ownerId = `owner:${storeId}`;
    const profile = profileSnap?.data() || {};
    const ownerName = await resolveStoreOwnerDisplayName(storeId);
    const ownerUid = typeof profile.ownerId === 'string' ? profile.ownerId : '';
    agents.push({
      id: ownerId,
      name: ownerName,
      email: typeof profile.email === 'string' ? profile.email : undefined,
      userId: ownerUid || undefined,
      role: 'owner',
    });
    seen.add(ownerId);

    repSnap?.docs.forEach((d) => {
      const data = d.data();
      if (data.status === 'inactive') return;
      agents.push({
        id: d.id,
        name: String(data.name || 'Rep'),
        email: data.email,
        role: 'crm_rep',
        assignedTerritory: typeof data.assignedTerritory === 'string' ? data.assignedTerritory : null,
        dailyVisitTarget: typeof data.dailyVisitTarget === 'number' ? data.dailyVisitTarget : null,
      });
      seen.add(d.id);
    });

    subSnap?.docs.forEach((d) => {
      const data = d.data();
      if (data.status === 'inactive') return;
      const rawRole = String(data.role || 'sales').toLowerCase();
      if (rawRole === 'delivery') return;
      const id = `sub:${d.id}`;
      if (seen.has(id)) return;
      const isManager = rawRole === 'manager';
      const baseName = String(data.name || (isManager ? 'Manager' : 'Sales')).trim();
      agents.push({
        id,
        name: baseName,
        email: data.email,
        userId:
          userIdBySubAccount.get(d.id) ||
          (typeof data.userId === 'string' ? data.userId : undefined),
        role: isManager ? 'manager' : 'sales',
        assignedTerritory: typeof data.assignedTerritory === 'string' ? data.assignedTerritory : null,
        dailyVisitTarget: typeof data.dailyVisitTarget === 'number' ? data.dailyVisitTarget : null,
      });
      seen.add(id);
    });

    return agents.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn('[crmAssignableAgents] fetch failed', e);
    return [];
  }
}

export function agentDisplayName(agents: CrmAssignableAgent[], repId?: string | null): string {
  if (!repId) return 'Unassigned';
  const found = agents.find((a) => a.id === repId);
  if (found) return found.name;
  if (repId.startsWith('owner:')) return 'Store owner';
  if (repId.startsWith('sub:')) return 'Team member';
  if (repId.startsWith('user:')) return 'Team member';
  return 'Assigned rep';
}

export function agentsForFilterChips(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  return agents.filter((a) => a.role !== 'owner');
}

/** Map / pipeline agent chips — field reps + sales managers (not store owner). */
export function agentsForMapFilterChips(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  const team = agents.filter(
    (a) => a.role === 'sales' || a.role === 'crm_rep' || a.role === 'manager',
  );
  if (team.length > 0) return team;
  return agentsForFilterChips(agents);
}

function mapSubAccountToAgent(subDocId: string, data: Record<string, unknown>): CrmAssignableAgent | null {
  if (data.status === 'inactive') return null;
  const rawRole = String(data.role || 'sales').toLowerCase();
  if (rawRole === 'delivery') return null;
  const isManager = rawRole === 'manager';
  const baseName = String(data.name || (isManager ? 'Manager' : 'Sales')).trim();
  return {
    id: `sub:${subDocId}`,
    name: baseName,
    email: typeof data.email === 'string' ? data.email : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    role: isManager ? 'manager' : 'sales',
    assignedTerritory: typeof data.assignedTerritory === 'string' ? data.assignedTerritory : null,
    dailyVisitTarget: typeof data.dailyVisitTarget === 'number' ? data.dailyVisitTarget : null,
  };
}

export async function enrichAgentsWithUserIds(
  storeId: string,
  agents: CrmAssignableAgent[],
): Promise<CrmAssignableAgent[]> {
  const needsLookup = agents.some((a) => !a.userId);
  if (!needsLookup) return agents;

  const db = getFirestore();
  try {
    const usersSnap = await getDocs(query(collection(db, 'users'), where('storeId', '==', storeId)));
    const byEmail = new Map<string, string>();
    const bySubId = new Map<string, string>();
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      const email = String(data.email || '').trim().toLowerCase();
      if (email) byEmail.set(email, d.id);
      const subId = data.subAccountId;
      if (typeof subId === 'string' && subId) bySubId.set(subId, d.id);
    });

    return agents.map((agent) => {
      if (agent.userId) return agent;
      if (agent.email) {
        const uid = byEmail.get(agent.email.trim().toLowerCase());
        if (uid) return { ...agent, userId: uid };
      }
      if (agent.id.startsWith('sub:')) {
        const uid = bySubId.get(agent.id.slice('sub:'.length));
        if (uid) return { ...agent, userId: uid };
      }
      return agent;
    });
  } catch (e) {
    console.warn('[crmAssignableAgents] enrichAgentsWithUserIds failed', e);
    return agents;
  }
}

export async function fetchTeamFilterAgents(storeId: string): Promise<CrmAssignableAgent[]> {
  let agents = await fetchCrmAssignableAgents(storeId);

  const seen = new Set(agents.map((a) => a.id));
  const extra: CrmAssignableAgent[] = [];

  try {
    const subSnap = await getDocs(
      query(collection(getFirestore(), 'subAccounts'), where('storeId', '==', storeId)),
    );
    subSnap.docs.forEach((d) => {
      const mapped = mapSubAccountToAgent(d.id, d.data());
      if (!mapped || seen.has(mapped.id)) return;
      extra.push(mapped);
      seen.add(mapped.id);
    });
  } catch {
    // keep base list
  }

  if (extra.length === 0) {
    try {
      const repSnap = await getDocs(
        query(collection(getFirestore(), 'crmReps'), where('storeId', '==', storeId)),
      );
      repSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.status === 'inactive' || seen.has(d.id)) return;
        extra.push({
          id: d.id,
          name: String(data.name || 'Rep'),
          email: data.email,
          role: 'crm_rep',
        });
        seen.add(d.id);
      });
    } catch {
      // keep base list
    }
  }

  if (extra.length > 0) {
    agents = [...agents, ...extra].sort((a, b) => a.name.localeCompare(b.name));
  }
  return enrichAgentsWithUserIds(storeId, agents);
}

/** Map mobile-style assignable agents to CrmRep rows for web dropdowns + performance cards. */
export function teamAgentsToCrmReps(
  storeId: string,
  agents: CrmAssignableAgent[],
): import('@/types/crm').CrmRep[] {
  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email || '',
    storeId,
    status: 'active' as const,
    dailyVisitTarget: a.dailyVisitTarget ?? undefined,
    assignedTerritory: a.assignedTerritory ?? undefined,
    createdAt: '',
    updatedAt: '',
    createdBy: '',
  }));
}

/** Territory + daily visit target — works for sub:… and crmReps ids. */
export async function updateTeamRepCrmSettings(
  repId: string,
  fields: { assignedTerritory?: string | null; dailyVisitTarget?: number | null },
): Promise<void> {
  const db = getFirestore();
  const now = new Date().toISOString();
  const payload = { ...fields, updatedAt: now };
  if (repId.startsWith('sub:')) {
    await updateDoc(doc(db, 'subAccounts', repId.slice(4)), payload);
    return;
  }
  await updateDoc(doc(db, 'crmReps', repId), payload);
}

export async function fetchCrmTeamReps(storeId: string): Promise<import('@/types/crm').CrmRep[]> {
  const agents = await fetchTeamFilterAgents(storeId);
  return teamAgentsToCrmReps(storeId, agents);
}
