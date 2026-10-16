import type { FinanceServiceTask } from '../types';
import { createStoreTask, deleteStoreTask, updateStoreTask } from './invoiceTeamTaskService';
import {
  cancelFinanceNotification,
  scheduleServiceTaskReminder,
} from './scheduledFinanceNotifications';

type TaskUser = { uid: string; name: string };

function dailyTaskTitle(task: FinanceServiceTask): string {
  return `${task.title} — ${task.counterpartyName}`;
}

function dailyTaskDescription(task: FinanceServiceTask): string {
  const price = task.isFree ? 'Free' : `${task.currency} ${task.amount.toFixed(2)}`;
  return `Service task · ${task.billingType === 'monthly' ? 'Monthly' : 'One-time'} · ${price}`;
}

export async function syncServiceTaskDailyEntry(
  storeId: string,
  task: FinanceServiceTask,
  user: TaskUser,
): Promise<string | null> {
  if (task.status === 'closed' || !task.nextDueAt) {
    if (task.linkedDailyTaskId) {
      await updateStoreTask(task.linkedDailyTaskId, { status: 'cancelled' }).catch(() => undefined);
      await cancelFinanceNotification(`finance_service_task_${task.id}`);
    }
    return null;
  }

  const payload = {
    title: dailyTaskTitle(task),
    description: dailyTaskDescription(task),
    dueAt: task.nextDueAt,
    status: 'todo' as const,
    assignedToUserId: user.uid,
    assignedToName: user.name,
  };

  if (task.linkedDailyTaskId) {
    await updateStoreTask(task.linkedDailyTaskId, payload);
    await scheduleServiceTaskReminder(task.id, task.title, task.nextDueAt);
    return task.linkedDailyTaskId;
  }

  const id = await createStoreTask(
    storeId,
    {
      title: payload.title,
      description: payload.description,
      assignedToUserId: user.uid,
      assignedToName: user.name,
      dueAt: task.nextDueAt,
      priority: 'medium',
    },
    user,
  );
  await scheduleServiceTaskReminder(task.id, task.title, task.nextDueAt);
  return id;
}

export async function clearServiceTaskDailyEntry(task: FinanceServiceTask): Promise<void> {
  await cancelFinanceNotification(`finance_service_task_${task.id}`);
  if (task.linkedDailyTaskId) {
    await deleteStoreTask(task.linkedDailyTaskId).catch(() => undefined);
  }
}
