import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useMobileEntitlements } from './useMobileEntitlements';
import { hasStoreAdminAccess, resolveMobileCrmRepId } from '../lib/crmRepResolve';
import { showCrmReminderPush, dismissCrmReminder } from '../lib/pushNotifications';
import {
  buildVisitReminder,
  formatVisitTimeLabel,
  isWithinWorkHours,
} from '../lib/smartAssistantNotifications';

const DISMISS_PREFIX = 'crm_reminder_dismissed:';
const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const POLL_MS = 120_000;

async function isDismissed(customerId: string, followUpAt: string): Promise<boolean> {
  const key = `${DISMISS_PREFIX}${customerId}:${followUpAt}`;
  const val = await AsyncStorage.getItem(key);
  return val === '1';
}

export async function markCrmReminderDismissed(customerId: string, followUpAt: string): Promise<void> {
  await AsyncStorage.setItem(`${DISMISS_PREFIX}${customerId}:${followUpAt}`, '1');
  await dismissCrmReminder(customerId);
}

function dueSoon(followUpAt?: string): boolean {
  if (!followUpAt) return false;
  const t = new Date(followUpAt).getTime();
  if (Number.isNaN(t)) return false;
  const diff = t - Date.now();
  return diff <= REMINDER_WINDOW_MS && diff >= -REMINDER_WINDOW_MS;
}

/** Personalized CRM visit reminders — work hours only, role-scoped. */
export function useCrmVisitReminders() {
  const { user } = useAuth();
  const { canUse, loading } = useMobileEntitlements();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.storeId || loading || !canUse('crm')) return;

    let cancelled = false;

    const checkClients = async () => {
      if (cancelled || !isWithinWorkHours()) return;
      const snap = await firestore()
        .collection('customers')
        .where('storeId', '==', user.storeId)
        .where('crmEnabled', '==', true)
        .limit(200)
        .get()
        .catch(() =>
          firestore()
            .collection('customers')
            .where('storeId', '==', user.storeId)
            .limit(200)
            .get(),
        );

      if (cancelled) return;
      const isManager = hasStoreAdminAccess(user.userRole, user.subAccountRole);
      const repId = await resolveMobileCrmRepId(user);
      if (!isManager && !repId) return;

      const displayName = user.teamMemberName || user.displayName || user.email || 'there';

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const assigned = data.assignedRepId as string | undefined;
        if (!isManager && repId && assigned && assigned !== repId) continue;

        const followUpAt = String(data.nextFollowUpAt || '');
        if (!dueSoon(followUpAt)) continue;

        const dedupeKey = `${docSnap.id}:${followUpAt}`;
        if (firedRef.current.has(dedupeKey)) continue;
        if (await isDismissed(docSnap.id, followUpAt)) continue;

        firedRef.current.add(dedupeKey);
        const clientName = String(data.name || 'your client');
        const whenLabel = formatVisitTimeLabel(followUpAt);
        const { title, body } = buildVisitReminder(displayName, clientName, whenLabel);
        await showCrmReminderPush(docSnap.id, title, body, followUpAt);
      }
    };

    void checkClients();
    const timer = setInterval(() => {
      void checkClients();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.storeId, user?.uid, user?.userRole, user?.subAccountRole, user?.email, user?.crmRepId, user?.subAccountId, user?.teamMemberName, user?.displayName, loading, canUse]);
}
