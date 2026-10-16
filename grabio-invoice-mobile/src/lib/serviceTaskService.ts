import firestore from '@react-native-firebase/firestore';
import type {
  BillingType,
  FinanceServiceTask,
  ServiceTaskCompletionOutcome,
  ServiceTaskDirection,
} from '../types';
import { FINANCE_COLLECTIONS } from './dataModel';
import { clearServiceTaskDailyEntry, syncServiceTaskDailyEntry } from './serviceTaskDailySync';
import {
  currentUsageMonth,
  mapCompletions,
  serviceTaskUnitsCompleted,
  serviceTaskUnitsRemaining,
} from './serviceTaskLogic';
import {
  computeNextFromWeekdays,
  normalizeScheduleWeekdays,
  resolveServiceTaskNextDue,
} from './serviceTaskSchedule';

const nowIso = () => new Date().toISOString();

export type ServiceTaskActor = { uid: string; name: string };

function tasksCol(storeId: string) {
  return firestore().collection('stores').doc(storeId).collection(FINANCE_COLLECTIONS.serviceTasks);
}

function legacyPlansCol(storeId: string) {
  return firestore().collection('stores').doc(storeId).collection(FINANCE_COLLECTIONS.clientPlans);
}

function mapTask(id: string, data: Record<string, unknown>): FinanceServiceTask {
  const direction: ServiceTaskDirection =
    data.direction === 'to_freelancer' ? 'to_freelancer' : 'from_client';
  const legacyStatus = String(data.status || 'open');
  const status = legacyStatus === 'cancelled' || legacyStatus === 'closed' ? 'closed' : 'open';
  const counterpartyId = String(data.counterpartyId || data.clientId || '');
  const counterpartyName = String(data.counterpartyName || data.clientName || '');
  const task: FinanceServiceTask = {
    id,
    storeId: data.storeId ? String(data.storeId) : undefined,
    direction,
    counterpartyId,
    counterpartyName,
    title: String(data.title || ''),
    billingType: (data.billingType as BillingType) || 'one_time',
    amount: Number(data.amount) || 0,
    isFree: data.isFree === true,
    currency: String(data.currency || 'USD'),
    monthlyUnits: data.monthlyUnits != null ? Number(data.monthlyUnits) : undefined,
    paymentMethod: String(data.paymentMethod || 'cash'),
    paymentSource: data.paymentSource ? String(data.paymentSource) : undefined,
    status: legacyStatus === 'active' ? 'open' : status,
    unitsCompleted: data.unitsCompleted != null ? Number(data.unitsCompleted) : undefined,
    completions: mapCompletions(data.completions),
    unitsUsedThisMonth: data.unitsUsedThisMonth != null ? Number(data.unitsUsedThisMonth) : 0,
    usageMonth: data.usageMonth ? String(data.usageMonth) : undefined,
    scheduledAt: data.scheduledAt ? String(data.scheduledAt) : undefined,
    scheduleWeekday: data.scheduleWeekday != null ? Number(data.scheduleWeekday) : undefined,
    scheduleWeekdays: Array.isArray(data.scheduleWeekdays)
      ? (data.scheduleWeekdays as number[]).map(Number)
      : undefined,
    scheduleHour: data.scheduleHour != null ? Number(data.scheduleHour) : undefined,
    scheduleMinute: data.scheduleMinute != null ? Number(data.scheduleMinute) : undefined,
    nextDueAt: data.nextDueAt ? String(data.nextDueAt) : undefined,
    linkedDailyTaskId: data.linkedDailyTaskId ? String(data.linkedDailyTaskId) : undefined,
    lastPaymentAt: data.lastPaymentAt ? String(data.lastPaymentAt) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
  if (task.unitsCompleted == null && task.unitsUsedThisMonth) {
    task.unitsCompleted = task.unitsUsedThisMonth;
  }
  if (!task.nextDueAt) {
    task.nextDueAt = resolveServiceTaskNextDue(task) || undefined;
  }
  return task;
}

async function refreshDailyLink(
  storeId: string,
  taskId: string,
  actor: ServiceTaskActor,
): Promise<void> {
  const task = await getServiceTask(storeId, taskId);
  if (!task) return;
  const linkedId = await syncServiceTaskDailyEntry(storeId, task, actor);
  if (linkedId && linkedId !== task.linkedDailyTaskId) {
    await tasksCol(storeId).doc(taskId).set({ linkedDailyTaskId: linkedId }, { merge: true });
  }
}

export async function listServiceTasks(storeId: string): Promise<FinanceServiceTask[]> {
  const [taskSnap, legacySnap] = await Promise.all([
    tasksCol(storeId).limit(300).get().catch(() => null),
    legacyPlansCol(storeId).limit(300).get().catch(() => null),
  ]);
  const byId = new Map<string, FinanceServiceTask>();
  if (taskSnap) {
    for (const d of taskSnap.docs) {
      byId.set(d.id, mapTask(d.id, d.data() as Record<string, unknown>));
    }
  }
  if (legacySnap) {
    for (const d of legacySnap.docs) {
      if (!byId.has(d.id)) {
        byId.set(d.id, mapTask(d.id, d.data() as Record<string, unknown>));
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.counterpartyName.localeCompare(b.counterpartyName));
}

export async function getServiceTask(storeId: string, taskId: string): Promise<FinanceServiceTask | null> {
  let snap = await tasksCol(storeId).doc(taskId).get();
  if (!snap.exists()) {
    snap = await legacyPlansCol(storeId).doc(taskId).get();
  }
  if (!snap.exists()) return null;
  return mapTask(snap.id, snap.data() as Record<string, unknown>);
}

export async function saveServiceTask(
  storeId: string,
  input: Omit<FinanceServiceTask, 'id'> & { id?: string },
  actor?: ServiceTaskActor,
): Promise<string> {
  const now = nowIso();
  const ref = input.id ? tasksCol(storeId).doc(input.id) : tasksCol(storeId).doc();
  const nextDueAt = resolveServiceTaskNextDue(input);
  await ref.set(
    {
      storeId,
      direction: input.direction,
      counterpartyId: input.counterpartyId,
      counterpartyName: input.counterpartyName,
      clientId: input.direction === 'from_client' ? input.counterpartyId : null,
      clientName: input.direction === 'from_client' ? input.counterpartyName : null,
      title: input.title,
      billingType: input.billingType,
      amount: input.isFree ? 0 : input.amount,
      isFree: !!input.isFree,
      currency: input.currency || 'USD',
      monthlyUnits: input.billingType === 'monthly' ? Number(input.monthlyUnits) || 0 : null,
      paymentMethod: input.paymentMethod || 'cash',
      paymentSource: input.paymentSource || '',
      status: input.status || 'open',
      unitsCompleted: input.unitsCompleted ?? 0,
      completions: input.completions ?? [],
      scheduledAt: input.billingType === 'one_time' ? input.scheduledAt || null : null,
      scheduleWeekday: input.billingType === 'monthly'
        ? normalizeScheduleWeekdays(input.scheduleWeekdays, input.scheduleWeekday)[0] ?? null
        : null,
      scheduleWeekdays: input.billingType === 'monthly'
        ? normalizeScheduleWeekdays(input.scheduleWeekdays, input.scheduleWeekday)
        : [],
      scheduleHour: input.scheduleHour ?? null,
      scheduleMinute: input.scheduleMinute ?? 0,
      nextDueAt,
      linkedDailyTaskId: input.linkedDailyTaskId || null,
      lastPaymentAt: input.lastPaymentAt || null,
      notes: input.notes || '',
      updatedAt: now,
      ...(input.id ? {} : { createdAt: now }),
    },
    { merge: true },
  );
  const taskId = ref.id;
  if (actor) {
    await refreshDailyLink(storeId, taskId, actor);
  }
  return taskId;
}

export async function deleteServiceTask(storeId: string, taskId: string): Promise<void> {
  const task = await getServiceTask(storeId, taskId);
  if (task) await clearServiceTaskDailyEntry(task);
  await tasksCol(storeId).doc(taskId).delete();
  try {
    await legacyPlansCol(storeId).doc(taskId).delete();
  } catch {
    /* legacy doc may not exist */
  }
}

export { serviceTaskUnitsRemaining };

export async function logServiceTaskDelivery(
  storeId: string,
  taskId: string,
  outcome: ServiceTaskCompletionOutcome = 'done',
  actor?: ServiceTaskActor,
): Promise<void> {
  const task = await getServiceTask(storeId, taskId);
  if (!task || task.status !== 'open') throw new Error('Service task not found');

  const entry = { at: nowIso(), outcome };
  const completions = [...(task.completions || []), entry];
  const now = nowIso();

  if (task.billingType === 'one_time') {
    await tasksCol(storeId).doc(taskId).set(
      {
        completions,
        unitsCompleted: 1,
        status: 'closed',
        updatedAt: now,
      },
      { merge: true },
    );
    const closed = await getServiceTask(storeId, taskId);
    if (closed) await clearServiceTaskDailyEntry(closed);
    return;
  }

  const used = serviceTaskUnitsCompleted(task);
  const limit = task.monthlyUnits || 0;
  if (limit > 0 && used >= limit) {
    throw new Error(`Monthly limit reached (${limit} this month)`);
  }
  const month = currentUsageMonth();
  const monthUsed = task.usageMonth === month ? used : 0;
  const newUsed = monthUsed + 1;
  const weekdays = normalizeScheduleWeekdays(task.scheduleWeekdays, task.scheduleWeekday);
  let nextDueAt: string | null = null;
  if (weekdays.length && task.scheduleHour != null) {
    const next = computeNextFromWeekdays(weekdays, task.scheduleHour, task.scheduleMinute ?? 0, new Date());
    nextDueAt = next?.toISOString() || null;
  }

  await tasksCol(storeId).doc(taskId).set(
    {
      unitsCompleted: newUsed,
      usageMonth: month,
      completions,
      nextDueAt,
      updatedAt: now,
      status: 'open',
    },
    { merge: true },
  );
  const updated = await getServiceTask(storeId, taskId);
  if (!updated) return;
  if (actor) {
    await refreshDailyLink(storeId, taskId, actor);
  }
}

export async function closeServiceTask(
  storeId: string,
  taskId: string,
  outcome: ServiceTaskCompletionOutcome = 'done',
): Promise<void> {
  const task = await getServiceTask(storeId, taskId);
  const completions = [...(task?.completions || []), { at: nowIso(), outcome }];
  await tasksCol(storeId).doc(taskId).set(
    { status: 'closed', completions, updatedAt: nowIso() },
    { merge: true },
  );
  await legacyPlansCol(storeId).doc(taskId).set({ status: 'cancelled', updatedAt: nowIso() }, { merge: true }).catch(() => undefined);
  const closed = await getServiceTask(storeId, taskId);
  if (closed) await clearServiceTaskDailyEntry(closed);
}

// Legacy aliases
export const listClientPlans = listServiceTasks;
export const getClientPlan = getServiceTask;
export const saveClientPlan = saveServiceTask;
export const deleteClientPlan = deleteServiceTask;
export const planUnitsRemaining = serviceTaskUnitsRemaining;
export const incrementClientPlanTaskUsage = logServiceTaskDelivery;
