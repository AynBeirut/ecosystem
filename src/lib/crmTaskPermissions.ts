import type { CrmAssignableAgent } from '@/lib/crmAssignableAgents';
import { agentsForFilterChips } from '@/lib/crmAssignableAgents';
import type { StoreTask } from '@/lib/crmTasks';
import { taskAssigneeUserIds } from '@/lib/crmTasks';

export function webTaskUserRole(user: {
  role?: string;
  subAccountRole?: string;
}): { userRole: string; subAccountRole?: string } {
  if (user.role === 'admin') return { userRole: 'owner' };
  if (user.role === 'sub_account') {
    const sub = user.subAccountRole;
    if (sub === 'manager') return { userRole: 'sub_manager', subAccountRole: 'manager' };
    if (sub === 'sales') return { userRole: 'sub_seller', subAccountRole: 'sales' };
    return { userRole: 'sub_seller', subAccountRole: sub };
  }
  return { userRole: 'owner' };
}

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
  return agents
    .map((a) => {
      if (a.userId) return a;
      if (a.role === 'owner' && selfUserId) return { ...a, userId: selfUserId };
      return a;
    })
    .filter((a) => Boolean(a.userId || a.id));
}

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
  if (task.assignees?.length) {
    return task.assignees.some(
      (a) => keys.includes(a.userId) || (a.repId && keys.includes(a.repId)),
    );
  }
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
    const team = resolved.filter(
      (a) =>
        Boolean(a.userId) &&
        (isSelf(a) || a.role === 'sales' || a.role === 'crm_rep' || a.role === 'manager'),
    );
    return team.length > 0 ? team : resolved.filter((a) => isSelf(a) && Boolean(a.userId));
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
        a.userId === selfUserId ||
        a.role === 'sales' ||
        a.role === 'crm_rep' ||
        a.role === 'manager',
    );
  }
  return [];
}

export function taskAssigneeFilterKey(agent: CrmAssignableAgent): string {
  return agent.userId || agent.id;
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

export function filterTasksForViewer(
  tasks: StoreTask[],
  userRole?: string,
  subAccountRole?: string,
  selfUserId?: string,
  agents: CrmAssignableAgent[] = [],
  selfRepId?: string | null,
): StoreTask[] {
  if (!selfUserId) return [];
  if (isStoreTaskAdmin(userRole)) return tasks;
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
      taskAssigneeUserIds(t).some((id) => selfKeys.has(id)) ||
      (t.assignedToRepId && selfKeys.has(t.assignedToRepId)),
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
  if (task.assignees?.length) {
    return task.assignees.some((a) => a.userId === selfUserId);
  }
  if (task.assignedToUserId === selfUserId) return true;
  if (isSalesTaskManager(userRole, subAccountRole)) {
    if (isTaskAssignedToOwner(task, agents, selfUserId)) return false;
    const visibleAgents = taskFilterAgents(userRole, subAccountRole, agents, selfUserId);
    return visibleAgents.some((a) => taskMatchesAgent(task, a));
  }
  return false;
}
