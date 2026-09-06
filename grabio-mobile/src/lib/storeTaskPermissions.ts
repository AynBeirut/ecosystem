import type { CrmAssignableAgent } from './crmMobileService';
import { agentsForFilterChips, agentsForTaskAssignment } from './crmMobileService';
import type { StoreTask } from './storeTaskService';
import { isFieldSalesRep } from './crmRepResolve';

/** Store owner / Firestore admin (mapped to owner in AuthContext). */
export function isStoreTaskAdmin(userRole?: string): boolean {
  return userRole === 'owner';
}

export function isSalesTaskManager(userRole?: string, subAccountRole?: string): boolean {
  return userRole === 'sub_manager' || subAccountRole === 'manager';
}

export function canManageTeamTaskList(userRole?: string, subAccountRole?: string): boolean {
  return isStoreTaskAdmin(userRole) || isSalesTaskManager(userRole, subAccountRole);
}

function withOwnerUserId(
  agents: CrmAssignableAgent[],
  selfUserId?: string,
): CrmAssignableAgent[] {
  return agents.map((a) => {
    if (a.userId) return a;
    if (a.role === 'owner' && selfUserId) return { ...a, userId: selfUserId };
    return a;
  }).filter((a) => Boolean(a.userId || a.id));
}

/** All keys that may appear on assignedToUserId / assignedToRepId for an agent. */
export function assigneeKeysForAgent(agent: CrmAssignableAgent): string[] {
  const keys = new Set<string>();
  if (agent.userId) {
    keys.add(agent.userId);
    keys.add(`user:${agent.userId}`);
  }
  if (agent.id) keys.add(agent.id);
  return [...keys];
}

export function taskMatchesAgent(task: StoreTask, agent: CrmAssignableAgent): boolean {
  const keys = assigneeKeysForAgent(agent);
  if (keys.includes(task.assignedToUserId)) return true;
  if (task.assignedToRepId && keys.includes(task.assignedToRepId)) return true;
  return false;
}

export function filterTasksByAssigneeFilter(
  tasks: StoreTask[],
  assigneeFilter: string,
  agents: CrmAssignableAgent[] = [],
): StoreTask[] {
  if (assigneeFilter === 'all') return tasks;
  const agent = agents.find((a) => a.userId === assigneeFilter || a.id === assigneeFilter);
  if (agent) return tasks.filter((t) => taskMatchesAgent(t, agent));
  return tasks.filter(
    (t) => t.assignedToUserId === assigneeFilter || t.assignedToRepId === assigneeFilter,
  );
}

/** Who the current user may assign a new task to. */
export function assignableTaskMembers(
  userRole?: string,
  subAccountRole?: string,
  agents: CrmAssignableAgent[] = [],
  selfUserId?: string,
  selfRepId?: string | null,
): CrmAssignableAgent[] {
  if (!selfUserId) return [];
  const resolved = withOwnerUserId(agents, selfUserId);
  const isSelf = (a: CrmAssignableAgent) =>
    a.userId === selfUserId || (selfRepId != null && a.id === selfRepId);

  if (isStoreTaskAdmin(userRole)) {
    return resolved.length > 0
      ? resolved.filter((a) => Boolean(a.userId))
      : [{ id: selfRepId || selfUserId, name: 'Me', userId: selfUserId, role: 'owner' }];
  }

  if (isSalesTaskManager(userRole, subAccountRole)) {
    const team = agentsForTaskAssignment(resolved).filter(
      (a) => isSelf(a) || a.role === 'sales' || a.role === 'crm_rep' || a.role === 'manager',
    );
    const deduped = new Map<string, CrmAssignableAgent>();
    team.forEach((a) => {
      const key = a.userId || a.email?.toLowerCase() || a.id;
      const existing = deduped.get(key);
      if (!existing || (!existing.userId && a.userId)) deduped.set(key, a);
    });
    if (selfUserId && !deduped.has(selfUserId) && !team.some(isSelf)) {
      deduped.set(selfUserId, {
        id: selfRepId || `user:${selfUserId}`,
        name: 'Me',
        userId: selfUserId,
        role: 'manager',
      });
    }
    const list = [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
    return list.length > 0 ? list : resolved.filter((a) => isSelf(a));
  }

  return resolved.filter((a) => isSelf(a) && Boolean(a.userId));
}

export function taskFilterAgents(
  userRole?: string,
  subAccountRole?: string,
  agents: CrmAssignableAgent[] = [],
  selfUserId?: string,
): CrmAssignableAgent[] {
  const resolved = withOwnerUserId(agents, selfUserId);
  const team = agentsForFilterChips(resolved);
  if (isStoreTaskAdmin(userRole)) return team;
  if (isSalesTaskManager(userRole, subAccountRole)) {
    return team.filter(
      (a) =>
        a.userId === selfUserId
        || a.role === 'sales'
        || a.role === 'crm_rep'
        || a.role === 'manager',
    );
  }
  return [];
}

export function taskAssigneeFilterKey(agent: CrmAssignableAgent): string {
  return agent.userId || agent.id;
}

/** Chip / select value in the task form. */
export function taskAssigneeSelectionKey(agent: CrmAssignableAgent): string {
  return taskAssigneeFilterKey(agent);
}

export function isTaskAssignedToOwner(
  task: StoreTask,
  agents: CrmAssignableAgent[],
  selfUserId?: string,
): boolean {
  const owners = withOwnerUserId(agents, selfUserId).filter((a) => a.role === 'owner');
  return owners.some((a) => taskMatchesAgent(task, a));
}

function tasksVisibleToSalesManager(
  tasks: StoreTask[],
  userRole?: string,
  subAccountRole?: string,
  selfUserId?: string,
  agents: CrmAssignableAgent[] = [],
): StoreTask[] {
  const visibleAgents = taskFilterAgents(userRole, subAccountRole, agents, selfUserId);
  if (visibleAgents.length === 0) return [];
  return tasks.filter((t) => {
    if (isTaskAssignedToOwner(t, agents, selfUserId)) return false;
    return visibleAgents.some((a) => taskMatchesAgent(t, a));
  });
}

export function findTaskAssigneeMember(
  assignable: CrmAssignableAgent[],
  selectionKey: string,
): CrmAssignableAgent | undefined {
  return assignable.find(
    (a) => taskAssigneeSelectionKey(a) === selectionKey || a.userId === selectionKey || a.id === selectionKey,
  );
}

/** Tasks visible in the list for the signed-in user. */
export function filterTasksForViewer(
  tasks: StoreTask[],
  userRole?: string,
  subAccountRole?: string,
  selfUserId?: string,
  agents: CrmAssignableAgent[] = [],
  selfRepId?: string | null,
): StoreTask[] {
  if (!selfUserId) return [];

  // Admin / owner — every task in the store
  if (isStoreTaskAdmin(userRole)) return tasks;

  // Sales manager — own tasks + sales agents; never store owner / admin tasks
  if (isSalesTaskManager(userRole, subAccountRole)) {
    return tasksVisibleToSalesManager(tasks, userRole, subAccountRole, selfUserId, agents);
  }

  const selfKeys = new Set<string>([selfUserId, `user:${selfUserId}`]);
  if (selfRepId) selfKeys.add(selfRepId);
  withOwnerUserId(agents, selfUserId)
    .filter((a) => a.userId === selfUserId || a.id === selfRepId)
    .forEach((a) => assigneeKeysForAgent(a).forEach((k) => selfKeys.add(k)));

  return tasks.filter(
    (t) =>
      selfKeys.has(t.assignedToUserId)
      || (t.assignedToRepId && selfKeys.has(t.assignedToRepId)),
  );
}

export function canAssignTaskToMember(
  assigneeSelectionKey: string,
  selfUserId: string,
  allowed: CrmAssignableAgent[],
  userRole?: string,
  subAccountRole?: string,
): boolean {
  if (!assigneeSelectionKey || assigneeSelectionKey === selfUserId) return true;
  if (isFieldSalesRep(userRole) && subAccountRole !== 'manager') return false;
  return allowed.some(
    (a) =>
      taskAssigneeSelectionKey(a) === assigneeSelectionKey
      || a.userId === assigneeSelectionKey
      || a.id === assigneeSelectionKey,
  );
}

export function canViewTaskFeedback(
  task: StoreTask,
  userRole?: string,
  subAccountRole?: string,
  selfUserId?: string,
  agents: CrmAssignableAgent[] = [],
): boolean {
  const feedback = String(task.completionFeedback || '').trim();
  if (!feedback || !selfUserId) return false;
  if (isStoreTaskAdmin(userRole)) return true;
  if (task.assignedToUserId === selfUserId) return true;
  if (isSalesTaskManager(userRole, subAccountRole)) {
    if (isTaskAssignedToOwner(task, agents, selfUserId)) return false;
    const visibleAgents = taskFilterAgents(userRole, subAccountRole, agents, selfUserId);
    return visibleAgents.some((a) => taskMatchesAgent(task, a));
  }
  return false;
}

export function tasksWithVisibleFeedback(
  tasks: StoreTask[],
  userRole?: string,
  subAccountRole?: string,
  selfUserId?: string,
  agents: CrmAssignableAgent[] = [],
): StoreTask[] {
  return tasks.filter(
    (t) => t.status === 'done' && canViewTaskFeedback(t, userRole, subAccountRole, selfUserId, agents),
  );
}
