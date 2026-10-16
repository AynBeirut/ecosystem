import type { StoreTask, StoreTaskFilter } from './invoiceTeamTaskTypes';

function startOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

export function isTaskOverdue(task: StoreTask): boolean {
  if (task.status === 'done' || task.status === 'cancelled') return false;
  if (!task.dueAt) return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

export function isTaskDueToday(task: StoreTask): boolean {
  if (!task.dueAt || task.status === 'done' || task.status === 'cancelled') return false;
  const t = new Date(task.dueAt).getTime();
  return t >= startOfDayMs(new Date()) && t <= endOfDayMs(new Date());
}

export function sortTasks(rows: StoreTask[]): StoreTask[] {
  return rows.sort((a, b) => {
    const aOver = isTaskOverdue(a);
    const bOver = isTaskOverdue(b);
    if (aOver !== bOver) return aOver ? -1 : 1;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

export function filterStoreTasks(tasks: StoreTask[], filter: StoreTaskFilter, userId: string): StoreTask[] {
  switch (filter) {
    case 'mine':
      return tasks.filter((t) => t.assignedToUserId === userId);
    case 'overdue':
      return tasks.filter((t) => isTaskOverdue(t));
    case 'today':
      return tasks.filter((t) => isTaskDueToday(t));
    case 'done':
      return tasks.filter((t) => t.status === 'done');
    case 'feedback':
      return tasks.filter((t) => t.status === 'done' && String(t.completionFeedback || '').trim().length > 0);
    default:
      return tasks.filter((t) => t.status !== 'cancelled');
  }
}
