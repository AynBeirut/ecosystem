import firestore from '@react-native-firebase/firestore';

export type CrmAssignableAgent = {
  id: string;
  name: string;
  email?: string;
  userId?: string;
  role?: 'sales' | 'manager' | 'crm_rep' | 'owner';
};

const ownerNameByStore = new Map<string, string>();

export function agentsForFilterChips(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  return agents.filter((a) => a.role !== 'owner');
}

export function agentsForTaskAssignment(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  return agents.filter((a) => a.role === 'sales' || a.role === 'manager' || a.role === 'crm_rep');
}

export function dedupeAssignableAgents(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  const byKey = new Map<string, CrmAssignableAgent>();
  for (const agent of agents) {
    const key = agent.userId || agent.email?.trim().toLowerCase() || agent.id;
    const existing = byKey.get(key);
    if (!existing || (!existing.userId && agent.userId)) byKey.set(key, agent);
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function agentDisplayName(agents: CrmAssignableAgent[], repId?: string | null): string {
  if (!repId) return 'Unassigned';
  const found = agents.find((a) => a.id === repId || a.userId === repId);
  if (found) return found.name;
  if (repId.startsWith('owner:')) {
    const storeId = repId.slice('owner:'.length);
    return ownerNameByStore.get(storeId) || 'Store owner';
  }
  return 'Team member';
}

export async function enrichAgentsWithUserIds(
  storeId: string,
  agents: CrmAssignableAgent[],
): Promise<CrmAssignableAgent[]> {
  const needsLookup = agents.some((a) => !a.userId);
  if (!needsLookup) return agents;
  try {
    const usersSnap = await firestore().collection('users').where('storeId', '==', storeId).get();
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
  } catch {
    return agents;
  }
}

export async function fetchTaskTeamAgents(storeId: string): Promise<CrmAssignableAgent[]> {
  const [subSnap, repsSnap, profileSnap] = await Promise.all([
    firestore().collection('subAccounts').where('storeId', '==', storeId).get(),
    firestore().collection('crmReps').where('storeId', '==', storeId).get(),
    firestore().collection('storeProfiles').doc(storeId).get(),
  ]);

  const built: CrmAssignableAgent[] = [];
  if (profileSnap.exists()) {
    const p = profileSnap.data() || {};
    const ownerName = String(p.name || p.storeName || 'Store owner');
    ownerNameByStore.set(storeId, ownerName);
    built.push({
      id: `owner:${storeId}`,
      name: ownerName,
      userId: String(p.ownerId || ''),
      role: 'owner',
    });
  }

  subSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.status === 'inactive') return;
    const rawRole = String(data.role || 'sales').toLowerCase();
    if (rawRole === 'delivery') return;
    const isManager = rawRole === 'manager';
    const baseName = String(data.name || (isManager ? 'Manager' : 'Sales')).trim();
    built.push({
      id: `sub:${d.id}`,
      name: baseName,
      email: typeof data.email === 'string' ? data.email : undefined,
      userId: typeof data.userId === 'string' ? data.userId : undefined,
      role: isManager ? 'manager' : 'sales',
    });
  });

  repsSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.status === 'inactive') return;
    const email = (data.email || '').trim().toLowerCase();
    if (email && built.some((b) => (b.email || '').toLowerCase() === email)) return;
    if (built.some((b) => b.id === d.id)) return;
    built.push({
      id: d.id,
      name: String(data.name || 'Rep'),
      email: data.email,
      role: 'crm_rep',
    });
  });

  return enrichAgentsWithUserIds(storeId, dedupeAssignableAgents(built));
}
