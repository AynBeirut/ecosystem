/**
 * Invoice Manager team to-dos — Firestore `invoiceTeamTasks` only (not CRM / NGO).
 */
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { filterStoreTasks, isTaskDueToday, isTaskOverdue, sortTasks } from './invoiceTeamTaskLogic';
import {
  INVOICE_TEAM_TASKS_COLLECTION,
  INVOICE_TEAM_TASK_DOMAIN,
  type StoreTask,
  type StoreTaskFilter,
  type StoreTaskInput,
  type StoreTaskPriority,
  type StoreTaskStatus,
} from './invoiceTeamTaskTypes';

export {
  INVOICE_TEAM_TASKS_COLLECTION,
  INVOICE_TEAM_TASK_DOMAIN,
  type StoreTask,
  type StoreTaskFilter,
  type StoreTaskInput,
  type StoreTaskPriority,
  type StoreTaskStatus,
};
export { filterStoreTasks, isTaskDueToday, isTaskOverdue, sortTasks };

export async function fetchStoreTasks(
  storeId: string,
  opts?: { assigneeUserId?: string; assigneeRepId?: string | null; managerView?: boolean },
): Promise<StoreTask[]> {
  const base = firestore().collection(INVOICE_TEAM_TASKS_COLLECTION).where('storeId', '==', storeId);
  if (opts?.managerView) {
    const snap = await base.limit(500).get();
    return mapAndSortTasks(snap);
  }
  if (opts?.assigneeUserId) {
    const [byUserSnap, byRepSnap] = await Promise.all([
      base.where('assignedToUserId', '==', opts.assigneeUserId).limit(500).get(),
      opts.assigneeRepId
        ? base.where('assignedToRepId', '==', opts.assigneeRepId).limit(500).get()
        : Promise.resolve(null),
    ]);
    const seen = new Set<string>();
    const rows: StoreTask[] = [];
    for (const snap of [byUserSnap, byRepSnap]) {
      if (!snap) continue;
      snap.docs.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        rows.push({ id: d.id, ...d.data() } as StoreTask);
      });
    }
    return sortTasks(rows);
  }
  const snap = await base.limit(500).get();
  return mapAndSortTasks(snap);
}

function mapAndSortTasks(
  snap: FirebaseFirestoreTypes.QuerySnapshot,
): StoreTask[] {
  return sortTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreTask)));
}

export async function createStoreTask(
  storeId: string,
  input: StoreTaskInput,
  creator: { uid: string; name: string },
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await firestore().collection(INVOICE_TEAM_TASKS_COLLECTION).add({
    storeId,
    taskDomain: INVOICE_TEAM_TASK_DOMAIN,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: 'todo',
    priority: input.priority || 'medium',
    assignedToUserId: input.assignedToUserId,
    assignedToName: input.assignedToName,
    assignedToRepId: input.assignedToRepId || null,
    createdBy: creator.uid,
    createdByName: creator.name,
    dueAt: input.dueAt || null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateStoreTask(
  taskId: string,
  patch: Partial<Pick<StoreTask, 'title' | 'description' | 'status' | 'priority' | 'dueAt' | 'assignedToUserId' | 'assignedToName' | 'assignedToRepId' | 'completedAt' | 'completionFeedback' | 'feedbackAt'>>,
): Promise<void> {
  await firestore().collection(INVOICE_TEAM_TASKS_COLLECTION).doc(taskId).update({
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteStoreTask(taskId: string): Promise<void> {
  await firestore().collection(INVOICE_TEAM_TASKS_COLLECTION).doc(taskId).delete();
}

export function formatTaskDueDate(task: StoreTask): string {
  if (!task.dueAt) return 'No due date';
  if (isTaskOverdue(task)) {
    return `Overdue · ${new Date(task.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }
  return new Date(task.dueAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export const TASK_STATUS_LABELS: Record<StoreTaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const TASK_PRIORITY_LABELS: Record<StoreTaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
