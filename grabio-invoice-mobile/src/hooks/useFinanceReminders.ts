import { useEffect, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { FINANCE_COLLECTIONS } from '../lib/dataModel';
import { isInvoiceUnpaid, ymdFromIso } from '../lib/financeDueDates';
import { showFinanceReminderPush } from '../lib/pushNotifications';
import { isWithinWorkHours, todayYmdBeirut } from '../lib/workHours';
import { isTaskOverdue, type StoreTask, INVOICE_TEAM_TASKS_COLLECTION } from '../lib/invoiceTeamTaskService';
import { DAILY_TASK_LABELS } from '../lib/taskDomainLabels';

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const POLL_MS = 120_000;

function dueSoon(iso?: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const diff = t - Date.now();
  return diff <= REMINDER_WINDOW_MS && diff >= -REMINDER_WINDOW_MS;
}

function isTodayBeirut(iso?: string | null): boolean {
  if (!iso) return false;
  const ymd = ymdFromIso(iso);
  return ymd !== '' && ymd === todayYmdBeirut();
}

/** Poll Firestore for task, invoice, and estimate reminders while the app is open. */
export function useFinanceReminders() {
  const { user } = useAuth();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.storeId || !user.uid) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled || !isWithinWorkHours() || !user.storeId) return;

      const storeId = user.storeId;
      const displayName = user.displayName || user.email || 'there';

      const tasksSnap = await firestore()
        .collection(INVOICE_TEAM_TASKS_COLLECTION)
        .where('storeId', '==', storeId)
        .where('assignedToUserId', '==', user.uid)
        .limit(100)
        .get()
        .catch(() => null);

      if (cancelled || !tasksSnap) return;

      for (const docSnap of tasksSnap.docs) {
        const task = docSnap.data() as StoreTask;
        if (task.status === 'done' || task.status === 'cancelled') continue;
        const dueAt = String(task.dueAt || '');
        if (!dueSoon(dueAt) && !isTaskOverdue(task)) continue;

        const key = `task:${docSnap.id}:${dueAt.slice(0, 16)}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);

        const overdue = isTaskOverdue(task);
        await showFinanceReminderPush(
          `finance_task_live_${docSnap.id}`,
          overdue ? DAILY_TASK_LABELS.overdue : DAILY_TASK_LABELS.due,
          overdue
            ? `"${task.title}" is overdue`
            : `"${task.title}" is due now`,
          { type: 'finance_task_due', taskId: docSnap.id, dueAt },
        );
      }

      const invoicesSnap = await firestore()
        .collection('stores')
        .doc(storeId)
        .collection(FINANCE_COLLECTIONS.invoices)
        .limit(200)
        .get()
        .catch(() => null);

      if (cancelled || !invoicesSnap) return;

      for (const docSnap of invoicesSnap.docs) {
        const data = docSnap.data();
        const status = String(data.status || '');
        const total = Number(data.total ?? data.amount) || 0;
        const paidAmount = data.paidAmount != null ? Number(data.paidAmount) : undefined;
        if (!isInvoiceUnpaid(status, paidAmount, total)) continue;

        const dueDate = String(data.dueDate || '');
        if (!isTodayBeirut(dueDate)) continue;

        const key = `invoice:${docSnap.id}:${todayYmdBeirut()}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);

        const clientName = String(data.clientName || 'Client');
        await showFinanceReminderPush(
          `finance_invoice_live_${docSnap.id}`,
          'Invoice due today',
          `Hi ${displayName.split('@')[0]}, unpaid invoice for ${clientName} is due today`,
          { type: 'finance_invoice_due', invoiceId: docSnap.id, dueDate },
        );
      }

      const estimatesSnap = await firestore()
        .collection('stores')
        .doc(storeId)
        .collection(FINANCE_COLLECTIONS.estimates)
        .limit(200)
        .get()
        .catch(() => null);

      if (cancelled || !estimatesSnap) return;

      for (const docSnap of estimatesSnap.docs) {
        const data = docSnap.data();
        const callClientAt = String(data.callClientAt || '');
        if (!isTodayBeirut(callClientAt)) continue;
        if (String(data.status || '') === 'approved') continue;

        const key = `estimate:${docSnap.id}:${todayYmdBeirut()}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);

        const clientName = String(data.clientName || 'client');
        await showFinanceReminderPush(
          `finance_estimate_live_${docSnap.id}`,
          'Call client',
          `Follow up with ${clientName} today`,
          { type: 'finance_estimate_call', estimateId: docSnap.id, callClientAt },
        );
      }
    };

    void check();
    const timer = setInterval(() => {
      void check();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.storeId, user?.uid, user?.displayName, user?.email]);
}
