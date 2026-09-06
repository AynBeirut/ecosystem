/**
 * Store team tasks — shared Firestore collection `storeTasks`.
 * Mobile: grabio-mobile/src/lib/storeTaskService.ts
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  getFirestore,
} from 'firebase/firestore';

export type StoreTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type StoreTaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type StoreTaskFilter = 'all' | 'mine' | 'overdue' | 'today' | 'done' | 'feedback';

export type StoreTask = {
  id: string;
  storeId: string;
  title: string;
  description?: string | null;
  status: StoreTaskStatus;
  priority: StoreTaskPriority;
  assignedToUserId: string;
  assignedToName: string;
  assignedToRepId?: string | null;
  createdBy: string;
  createdByName: string;
  dueAt?: string | null;
  completedAt?: string | null;
  completionFeedback?: string | null;
  feedbackAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoreTaskInput = {
  title: string;
  description?: string;
  priority?: StoreTaskPriority;
  assignedToUserId: string;
  assignedToName: string;
  assignedToRepId?: string | null;
  dueAt?: string | null;
};

const COL = 'storeTasks';

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

export async function fetchStoreTasks(storeId: string): Promise<StoreTask[]> {
  const snap = await getDocs(query(collection(getFirestore(), COL), where('storeId', '==', storeId)));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreTask));
  return rows.sort((a, b) => {
    const aOver = isTaskOverdue(a);
    const bOver = isTaskOverdue(b);
    if (aOver !== bOver) return aOver ? -1 : 1;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

export async function createStoreTask(
  storeId: string,
  input: StoreTaskInput,
  creator: { uid: string; name: string },
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(getFirestore(), COL), {
    storeId,
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
    completionFeedback: null,
    feedbackAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateStoreTask(
  taskId: string,
  patch: Partial<
    Pick<
      StoreTask,
      | 'title'
      | 'description'
      | 'status'
      | 'priority'
      | 'dueAt'
      | 'assignedToUserId'
      | 'assignedToName'
      | 'assignedToRepId'
      | 'completedAt'
      | 'completionFeedback'
      | 'feedbackAt'
    >
  >,
): Promise<void> {
  await updateDoc(doc(getFirestore(), COL, taskId), {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteStoreTask(taskId: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), COL, taskId));
}

export function filterStoreTasks(
  tasks: StoreTask[],
  filter: StoreTaskFilter,
  userId: string,
): StoreTask[] {
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
      return tasks.filter(
        (t) => t.status === 'done' && String(t.completionFeedback || '').trim().length > 0,
      );
    default:
      return tasks.filter((t) => t.status !== 'cancelled');
  }
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
