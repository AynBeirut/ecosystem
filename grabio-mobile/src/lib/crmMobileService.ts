import firestore from '@react-native-firebase/firestore';
import type { CrmActivityResult, CrmActivityType } from './crmConstants';
import { pipelineFromResult } from './crmConstants';
import type { RepUser } from './crmRepResolve';
import { collectMobileCrmRepIds } from './crmRepResolve';
import { invalidateCachePrefix, readCache, writeCache } from './crmDataCache';
import { resolveClientPhoneFromData, clientAreaOrDistrict } from './crmCustomerPhone';
import { resolveStoreOwnerDisplayName } from './storeProfileSync';

const repIdsCache = new Map<string, { at: number; ids: string[] }>();
const REP_IDS_TTL = 120_000;
const ownerNameByStore = new Map<string, string>();

export function cacheOwnerAgentName(storeId: string, name: string): void {
  if (storeId && name) ownerNameByStore.set(storeId, name);
}

export type CrmClient = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  customerCode?: string;
  customerType?: string;
  district?: string;
  area?: string;
  notes?: string;
  location?: { lat: number; lng: number; accuracy?: number };
  lastVisitDate?: string;
  pipelineStage?: string;
  assignedRepId?: string;
  nextFollowUpAt?: string;
  dealValue?: number;
  lastActivityAt?: string;
  crmEnabled?: boolean;
  status?: string;
};

export type CrmRep = {
  id: string;
  name: string;
  email?: string;
  storeId: string;
  status?: string;
  dailyVisitTarget?: number;
  assignedTerritory?: string;
};

export type CrmAssignableAgent = {
  id: string;
  name: string;
  email?: string;
  userId?: string;
  role?: 'sales' | 'manager' | 'crm_rep' | 'owner';
};

export type CrmRepLiveLocation = {
  userId: string;
  storeId: string;
  repId: string;
  repName: string;
  role?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAtIso?: string;
};

export type CrmClientInput = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  district?: string;
  area?: string;
  notes?: string;
  location?: { lat: number; lng: number; accuracy?: number } | null;
  assignedRepId?: string | null;
  customerCode?: string;
  customerType?: string;
  dealValue?: number;
};

function mapCustomerDoc(id: string, data: Record<string, unknown>): CrmClient {
  const phone = resolveClientPhoneFromData(data);
  return { id, ...data, phone } as CrmClient;
}

export { clientAreaOrDistrict };

export async function fetchCrmReps(storeId: string): Promise<CrmRep[]> {
  const snap = await firestore().collection('crmReps').where('storeId', '==', storeId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as CrmRep))
    .filter((r) => r.status !== 'inactive')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/** CRM reps + sales/manager sub-accounts + store owner — ids match assignedRepId on customers. */
export async function fetchCrmAssignableAgents(
  storeId: string,
  opts?: { bypassCache?: boolean },
): Promise<CrmAssignableAgent[]> {
  const cacheKey = `agents:v7:${storeId}`;
  if (!opts?.bypassCache) {
    const cached = readCache<CrmAssignableAgent[]>(cacheKey);
    if (cached && agentsForFilterChips(cached).length > 0) return cached;
  }

  try {
    const [repResult, subResult, profileResult] = await Promise.allSettled([
      firestore().collection('crmReps').where('storeId', '==', storeId).get(),
      firestore().collection('subAccounts').where('storeId', '==', storeId).get(),
      firestore().collection('storeProfiles').doc(storeId).get(),
    ]);

    const repSnap = repResult.status === 'fulfilled' ? repResult.value : null;
    const subSnap = subResult.status === 'fulfilled' ? subResult.value : null;
    const profileSnap = profileResult.status === 'fulfilled' ? profileResult.value : null;

    const userIdBySubAccount = new Map<string, string>();

    if (subSnap) {
      await Promise.all(
        subSnap.docs.map(async (subDoc) => {
          try {
            if (userIdBySubAccount.has(subDoc.id)) return;
            const linked = await firestore()
              .collection('users')
              .where('subAccountId', '==', subDoc.id)
              .limit(1)
              .get();
            if (!linked.empty) userIdBySubAccount.set(subDoc.id, linked.docs[0].id);
          } catch {
            // Managers cannot query peer user docs — subAccount row still lists the agent.
          }
        }),
      );
    }

    const agents: CrmAssignableAgent[] = [];
    const seen = new Set<string>();

    const ownerId = `owner:${storeId}`;
    const profile = profileSnap?.data() || {};
    const ownerName = await resolveStoreOwnerDisplayName(storeId);
    cacheOwnerAgentName(storeId, ownerName);
    agents.push({
      id: ownerId,
      name: ownerName,
      email: typeof profile.email === 'string' ? profile.email : undefined,
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
      const baseName = String(data.name || (isManager ? 'Sales manager' : 'Sales')).trim();
      agents.push({
        id,
        name: isManager ? `${baseName} (Sales manager)` : baseName,
        email: data.email,
        userId: userIdBySubAccount.get(d.id) || (typeof data.userId === 'string' ? data.userId : undefined),
        role: isManager ? 'manager' : 'sales',
      });
      seen.add(id);
    });

    agents.sort((a, b) => a.name.localeCompare(b.name));
    if (agentsForFilterChips(agents).length > 0) writeCache(cacheKey, agents);
    return agents;
  } catch (e) {
    console.warn('[crmAssignableAgents] fetch failed', e);
    return [];
  }
}

export function agentDisplayName(agents: CrmAssignableAgent[], repId?: string | null): string {
  if (!repId) return 'Unassigned';
  const found = agents.find((a) => a.id === repId);
  if (found) return found.name;
  if (repId.startsWith('owner:')) {
    const storeId = repId.slice('owner:'.length);
    return ownerNameByStore.get(storeId) || 'Store owner';
  }
  if (repId.startsWith('sub:')) return 'Team member';
  if (repId.startsWith('user:')) return 'Team member';
  return 'Assigned rep';
}

/** Filter chips — hide store-admin pseudo rep (NIPCO / owner id). */
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
  const baseName = String(data.name || (isManager ? 'Sales manager' : 'Sales')).trim();
  return {
    id: `sub:${subDocId}`,
    name: isManager ? `${baseName} (Sales manager)` : baseName,
    email: typeof data.email === 'string' ? data.email : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    role: isManager ? 'manager' : 'sales',
  };
}

/** Agents for map/orders/tasks chips — always merge live subAccounts (avoids stale partial cache). */
export async function fetchTeamFilterAgents(
  storeId: string,
  force = false,
): Promise<CrmAssignableAgent[]> {
  if (force) {
    invalidateCachePrefix('agents:');
  } else {
    invalidateCachePrefix(`agents:v5:${storeId}`);
    invalidateCachePrefix(`agents:v6:${storeId}`);
    invalidateCachePrefix(`agents:v7:${storeId}`);
  }

  let agents = await fetchCrmAssignableAgents(storeId, { bypassCache: force });

  const seen = new Set(agents.map((a) => a.id));
  const extra: CrmAssignableAgent[] = [];

  try {
    const subSnap = await firestore().collection('subAccounts').where('storeId', '==', storeId).get();
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
      const repSnap = await firestore().collection('crmReps').where('storeId', '==', storeId).get();
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
    writeCache(`agents:v7:${storeId}`, agents);
  }
  return agents;
}

/** Create Order — no sales agent on the order. */
export const ORDER_AGENT_UNASSIGNED = '__unassigned__';

/** Order POS — sales + managers + CRM reps (not store-owner pseudo id). */
export function agentsForOrderAssignment(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  return agents.filter((a) => a.role === 'sales' || a.role === 'manager' || a.role === 'crm_rep');
}

/** Create Order picker — owner + sales + managers + CRM reps; link owner row to uid when self is owner. */
export function agentsForOrderPicker(
  agents: CrmAssignableAgent[],
  selfUserId?: string,
): CrmAssignableAgent[] {
  const withOwnerUser = agents.map((a) => {
    if (a.role === 'owner' && selfUserId && !a.userId) {
      return { ...a, userId: selfUserId };
    }
    return a;
  });
  return withOwnerUser.filter(
    (a) => a.role === 'owner' || a.role === 'sales' || a.role === 'manager' || a.role === 'crm_rep',
  );
}

/** Client assignment picker — sales agents + sales managers only (not store owner). */
export function agentsForClientAssignment(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  return agentsForOrderAssignment(agents);
}

/** Task assignee picker — sales + managers + CRM reps (deduped). */
export function agentsForTaskAssignment(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  return agents.filter((a) => a.role === 'sales' || a.role === 'manager' || a.role === 'crm_rep');
}

/** Prefer one row per person when crmReps + subAccounts overlap. */
export function dedupeAssignableAgents(agents: CrmAssignableAgent[]): CrmAssignableAgent[] {
  const byKey = new Map<string, CrmAssignableAgent>();
  for (const agent of agents) {
    const key = agent.userId || agent.email?.trim().toLowerCase() || agent.id;
    const existing = byKey.get(key);
    if (!existing || (!existing.userId && agent.userId)) {
      byKey.set(key, agent);
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Task screens — team list with subAccounts/crmReps fallback when assignable cache is empty. */
export async function fetchTaskTeamAgents(storeId: string): Promise<CrmAssignableAgent[]> {
  invalidateCachePrefix('agents:');
  let agents = dedupeAssignableAgents(await fetchTeamFilterAgents(storeId));
  agents = await enrichAgentsWithUserIds(storeId, agents);
  if (agentsForTaskAssignment(agents).length > 0) return agents;

  try {
    const [subSnap, reps] = await Promise.all([
      firestore().collection('subAccounts').where('storeId', '==', storeId).get(),
      fetchCrmReps(storeId),
    ]);
    const built: CrmAssignableAgent[] = [];
    subSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.status === 'inactive') return;
      const rawRole = String(data.role || 'sales').toLowerCase();
      if (rawRole === 'delivery') return;
      const isManager = rawRole === 'manager';
      const baseName = String(data.name || (isManager ? 'Sales manager' : 'Sales')).trim();
      built.push({
        id: `sub:${d.id}`,
        name: isManager ? `${baseName} (Sales manager)` : baseName,
        email: typeof data.email === 'string' ? data.email : undefined,
        userId: typeof data.userId === 'string' ? data.userId : undefined,
        role: isManager ? 'manager' : 'sales',
      });
    });
    reps.forEach((r) => {
      const email = (r.email || '').trim().toLowerCase();
      if (email && built.some((b) => (b.email || '').toLowerCase() === email)) return;
      if (built.some((b) => b.id === r.id)) return;
      built.push({
        id: r.id,
        name: String(r.name || 'Rep'),
        email: r.email,
        role: 'crm_rep',
      });
    });
    return enrichAgentsWithUserIds(storeId, dedupeAssignableAgents(built));
  } catch (e) {
    console.warn('[fetchTaskTeamAgents] fallback failed', e);
    return agents;
  }
}

/** Link crmReps / subAccounts to Firebase uid so tasks can be assigned to Jihan, etc. */
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

    const enriched = agents.map((agent) => {
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

    return enriched;
  } catch {
    return agents;
  }
}

export function isClientAssignedToRepIds(client: CrmClient, repIds: string[]): boolean {
  return Boolean(client.assignedRepId && repIds.includes(client.assignedRepId));
}

export async function fetchCrmRepLocations(storeId: string): Promise<CrmRepLiveLocation[]> {
  try {
    const snap = await firestore().collection('crmRepLocations').where('storeId', '==', storeId).get();
    return snap.docs
      .map((d) => ({ userId: d.id, ...d.data() } as CrmRepLiveLocation))
      .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number');
  } catch {
    return [];
  }
}

export async function createCrmClient(storeId: string, data: CrmClientInput): Promise<string> {
  const now = new Date().toISOString();
  const ref = await firestore().collection('customers').add({
    storeId,
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    country: data.country?.trim() || 'Lebanon',
    district: data.district?.trim() || null,
    area: data.area?.trim() || null,
    notes: data.notes?.trim() || null,
    location: data.location || null,
    customerCode: data.customerCode?.trim() || null,
    customerType: data.customerType || null,
    crmEnabled: true,
    pipelineStage: 'new_lead',
    assignedRepId: data.assignedRepId || null,
    dealValue: data.dealValue ?? null,
    dealCurrency: 'USD',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  invalidateCrmStoreCache(storeId);
  return ref.id;
}

export async function updateCrmClient(clientId: string, data: Partial<CrmClientInput>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString(), crmEnabled: true };
  if (data.name != null) patch.name = data.name.trim();
  if (data.phone != null) patch.phone = data.phone.trim() || null;
  if (data.email != null) patch.email = data.email.trim() || null;
  if (data.address != null) patch.address = data.address.trim() || null;
  if (data.city != null) patch.city = data.city.trim() || null;
  if (data.country != null) patch.country = data.country.trim() || null;
  if (data.district != null) patch.district = data.district.trim() || null;
  if (data.area != null) patch.area = data.area.trim() || null;
  if (data.notes != null) patch.notes = data.notes.trim() || null;
  if (data.location !== undefined) patch.location = data.location;
  if (data.assignedRepId !== undefined) patch.assignedRepId = data.assignedRepId;
  if (data.customerCode != null) patch.customerCode = data.customerCode.trim() || null;
  if (data.dealValue !== undefined) patch.dealValue = data.dealValue;
  await firestore().collection('customers').doc(clientId).update(patch);
  const snap = await firestore().collection('customers').doc(clientId).get();
  const sid = snap.data()?.storeId;
  if (typeof sid === 'string') invalidateCrmStoreCache(sid);
}

export async function fetchCrmClient(clientId: string): Promise<CrmClient | null> {
  const snap = await firestore().collection('customers').doc(clientId).get();
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data(), phone: resolveClientPhoneFromData(snap.data() || {}) } as CrmClient;
}

export async function fetchAssignedClients(
  storeId: string,
  user: RepUser,
  opts?: { managerView?: boolean; repFilter?: string },
): Promise<CrmClient[]> {
  const cacheKey = `clients:v3:${storeId}:${opts?.managerView ? 'mgr' : user.uid}`;
  const cached = readCache<CrmClient[]>(cacheKey);
  if (cached) {
    return applyClientListFilters(cached, opts);
  }

  let snap;
  if (opts?.managerView) {
    try {
      snap = await firestore()
        .collection('customers')
        .where('storeId', '==', storeId)
        .where('crmEnabled', '==', true)
        .get();
    } catch {
      snap = await firestore().collection('customers').where('storeId', '==', storeId).get();
    }
  } else {
    const repKey = `${user.uid}:${user.subAccountId || ''}:${user.crmRepId || ''}`;
    let repIds = repIdsCache.get(repKey)?.ids;
    if (!repIds) {
      repIds = await collectMobileCrmRepIds(user);
      repIdsCache.set(repKey, { at: Date.now(), ids: repIds });
    }
    if (repIds.length === 0) return [];

    try {
      snap = await firestore()
        .collection('customers')
        .where('storeId', '==', storeId)
        .where('assignedRepId', 'in', repIds.slice(0, 10))
        .get();
    } catch {
      snap = await firestore().collection('customers').where('storeId', '==', storeId).get();
    }
  }

  let list = snap.docs.map((d) => mapCustomerDoc(d.id, d.data() as Record<string, unknown>));

  if (opts?.managerView) {
    list = list.filter((c) => c.crmEnabled || c.nextFollowUpAt || c.assignedRepId);
  } else {
    const repKey = `${user.uid}:${user.subAccountId || ''}:${user.crmRepId || ''}`;
    const repIds = repIdsCache.get(repKey)?.ids || [];
    list = list.filter((c) => isClientAssignedToRepIds(c, repIds));
  }

  const sorted = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  writeCache(cacheKey, sorted);
  return applyClientListFilters(sorted, opts);
}

function applyClientListFilters(
  list: CrmClient[],
  opts?: { repFilter?: string },
): CrmClient[] {
  if (!opts?.repFilter || opts.repFilter === 'all') return list;
  return list.filter((c) => c.assignedRepId === opts.repFilter);
}

/** POS / order — prefix search, no full customer download on mount. */
export async function searchStoreCustomers(
  storeId: string,
  term: string,
  limit = 25,
): Promise<CrmClient[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const cacheKey = `customer-search:${storeId}:${q.toLowerCase()}`;
  const cached = readCache<CrmClient[]>(cacheKey);
  if (cached) return cached;

  const cap = q.charAt(0).toUpperCase() + q.slice(1);
  try {
    const snap = await firestore()
      .collection('customers')
      .where('storeId', '==', storeId)
      .where('name', '>=', cap)
      .where('name', '<=', `${cap}\uf8ff`)
      .limit(limit)
      .get();
    const rows = snap.docs.map((d) => mapCustomerDoc(d.id, d.data() as Record<string, unknown>));
    writeCache(cacheKey, rows);
    return rows;
  } catch {
    const allKey = `clients:v3:${storeId}:mgr`;
    let pool = readCache<CrmClient[]>(allKey);
    if (!pool) {
      pool = await fetchAssignedClients(storeId, { uid: 'search', storeId }, { managerView: true });
    }
    const lower = q.toLowerCase();
    const rows = pool
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(lower)
          || (c.phone || '').includes(q),
      )
      .slice(0, limit);
    writeCache(cacheKey, rows);
    return rows;
  }
}

export function invalidateCrmStoreCache(storeId: string): void {
  invalidateCachePrefix(`clients:${storeId}:`);
  invalidateCachePrefix(`clients:v2:${storeId}:`);
  invalidateCachePrefix(`customer-search:${storeId}:`);
  invalidateCachePrefix(`agents:${storeId}`);
  invalidateCachePrefix(`agents:v2:${storeId}`);
  invalidateCachePrefix(`activities:${storeId}`);
}

export async function fetchStoreActivities(storeId: string, limit = 150, repFilter?: string) {
  const cacheKey = `activities:${storeId}:${limit}:${repFilter || 'all'}`;
  const cached = readCache<Array<Record<string, unknown>>>(cacheKey);
  if (cached) return cached;

  try {
    const snap = await firestore()
      .collection('crmActivities')
      .where('storeId', '==', storeId)
      .orderBy('loggedAt', 'desc')
      .limit(limit)
      .get();
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (repFilter && repFilter !== 'all') {
      rows = rows.filter((a) => a.repId === repFilter);
    }
    writeCache(cacheKey, rows);
    return rows;
  } catch {
    const snap = await firestore().collection('crmActivities').where('storeId', '==', storeId).limit(limit).get();
    let rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as { id: string; loggedAt?: string; repId?: string }))
      .sort((a, b) => String(b.loggedAt || '').localeCompare(String(a.loggedAt || '')));
    if (repFilter && repFilter !== 'all') {
      rows = rows.filter((a) => a.repId === repFilter);
    }
    writeCache(cacheKey, rows);
    return rows;
  }
}

export async function fetchCustomerOrders(storeId: string, customerId: string, limit = 20) {
  try {
    const snap = await firestore()
      .collection('orders')
      .where('storeId', '==', storeId)
      .where('customerId', '==', customerId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await firestore()
      .collection('orders')
      .where('storeId', '==', storeId)
      .where('customerId', '==', customerId)
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export async function fetchClientActivities(storeId: string, customerId: string, repFilter?: string) {
  try {
    const snap = await firestore()
      .collection('crmActivities')
      .where('storeId', '==', storeId)
      .where('customerId', '==', customerId)
      .orderBy('loggedAt', 'desc')
      .limit(100)
      .get();
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (repFilter && repFilter !== 'all') {
      rows = rows.filter((a) => a.repId === repFilter);
    }
    return rows;
  } catch {
    const snap = await firestore()
      .collection('crmActivities')
      .where('storeId', '==', storeId)
      .where('customerId', '==', customerId)
      .limit(100)
      .get();
    let rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as { id: string; loggedAt?: string; repId?: string }))
      .sort((a, b) => String(b.loggedAt || '').localeCompare(String(a.loggedAt || '')));
    if (repFilter && repFilter !== 'all') {
      rows = rows.filter((a) => a.repId === repFilter);
    }
    return rows;
  }
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
  timeIn?: string;
  timeOut?: string | null;
  visitCompleted?: boolean;
  orderTaken?: boolean;
  createdBy: string;
}) {
  const stageAfter = pipelineFromResult(input.result);
  const timeIn = input.timeIn || input.loggedAt;
  await firestore().collection('crmActivities').add({
    storeId: input.storeId,
    customerId: input.customerId,
    repId: input.repId,
    repName: input.repName,
    type: input.type,
    loggedAt: input.loggedAt,
    timeIn,
    timeOut: input.timeOut || null,
    result: input.result,
    notes: input.notes,
    followUpAt: input.followUpAt,
    location: input.location,
    visitCompleted: input.visitCompleted ?? (input.type === 'visit'),
    orderTaken: input.orderTaken ?? false,
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
    assignedRepId: input.repId,
  };
  if (input.followUpAt) customerUpdate.nextFollowUpAt = input.followUpAt;
  if (stageAfter) customerUpdate.pipelineStage = stageAfter;
  const visitDone = input.visitCompleted ?? (input.type === 'visit');
  if (input.type === 'visit' && visitDone) {
    customerUpdate.lastVisitDate = input.loggedAt;
  }
  if (input.location && input.type === 'visit') {
    customerUpdate.location = input.location;
  }

  await firestore().collection('customers').doc(input.customerId).update(customerUpdate);
  invalidateCrmStoreCache(input.storeId);
}

export async function resolveRepDisplayName(uid: string, fallback: string): Promise<string> {
  const snap = await firestore().collection('users').doc(uid).get();
  if (!snap.exists()) return fallback;
  const d = snap.data() || {};
  const subRecord = await loadSubAccountRecordForRep(
    typeof d.subAccountId === 'string' ? d.subAccountId : undefined,
    String(d.email || ''),
  );
  if (subRecord?.name) return subRecord.name;
  const name = String(d.name || d.displayName || '').trim();
  if (name) return name;
  return fallback;
}

async function loadSubAccountRecordForRep(
  subAccountId?: string,
  email?: string,
): Promise<{ name: string } | null> {
  if (subAccountId) {
    const sub = await firestore().collection('subAccounts').doc(subAccountId).get();
    if (sub.exists()) {
      const name = String(sub.data()?.name || '').trim();
      if (name) return { name };
    }
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const byEmail = await firestore()
    .collection('subAccounts')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();
  if (byEmail.empty) return null;
  const name = String(byEmail.docs[0].data()?.name || '').trim();
  return name ? { name } : null;
}
