import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useMobileEntitlements } from './useMobileEntitlements';
import { collectMobileCrmRepIds, hasStoreAdminAccess } from '../lib/crmRepResolve';
import { fetchVisitRoutes, filterRoutesForDate } from '../lib/crmVisitRouteService';
import { fetchStoreTasks, isTaskDueToday } from '../lib/storeTaskService';
import { showAssistantPush } from '../lib/pushNotifications';
import {
  buildMorningBriefing,
  buildPendingApprovalNudge,
  isWithinWorkHours,
  mapUserRoleToAssistant,
  todayYmdBeirut,
  type MorningBriefingStats,
} from '../lib/smartAssistantNotifications';

const BRIEFING_PREFIX = 'assistant_morning:';
const APPROVAL_NUDGE_PREFIX = 'assistant_approval:';
const BRIEFING_POLL_MS = 15 * 60 * 1000;

function countRouteStops(
  routes: Awaited<ReturnType<typeof fetchVisitRoutes>>,
  today: string,
  repIds: string[],
): number {
  const matched = filterRoutesForDate(routes, today, undefined, repIds);
  return matched.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
}

function countTeamRouteStops(
  routes: Awaited<ReturnType<typeof fetchVisitRoutes>>,
  today: string,
): number {
  const matched = filterRoutesForDate(routes, today);
  return matched.reduce((sum, r) => sum + (r.stops?.length || 0), 0);
}

async function countFollowUpsToday(storeId: string, repIds?: string[]): Promise<number> {
  const snap = await firestore()
    .collection('customers')
    .where('storeId', '==', storeId)
    .limit(300)
    .get();
  const today = todayYmdBeirut();
  let count = 0;
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const followUp = String(data.nextFollowUpAt || '');
    if (!followUp || !followUp.startsWith(today)) return;
    if (repIds && repIds.length > 0) {
      const assigned = String(data.assignedRepId || '');
      if (assigned && !repIds.includes(assigned)) return;
    }
    count += 1;
  });
  return count;
}

async function countPendingApprovals(storeId: string): Promise<number> {
  const snap = await firestore()
    .collection('orders')
    .where('storeId', '==', storeId)
    .where('status', '==', 'pending')
    .limit(50)
    .get();
  return snap.size;
}

/** Role-aware morning briefing + manager approval nudges — work hours only. */
export function useSmartWorkAssistant() {
  const { user } = useAuth();
  const { canUse, loading } = useMobileEntitlements();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!user?.storeId || !user.uid || loading) return undefined;

    const run = async () => {
      if (!isWithinWorkHours() || runningRef.current) return;
      runningRef.current = true;
      try {
        const today = todayYmdBeirut();
        const role = mapUserRoleToAssistant(user.userRole, user.subAccountRole);
        const displayName = user.teamMemberName || user.displayName || user.email || 'there';
        const isManager = hasStoreAdminAccess(user.userRole, user.subAccountRole);
        const hasCrm = canUse('crm');

        const stats: MorningBriefingStats = {
          routeStops: 0,
          followUpsToday: 0,
          tasksToday: 0,
          pendingApprovals: 0,
          teamVisitsToday: 0,
        };

        const tasks = await fetchStoreTasks(user.storeId, {
          assigneeUserId: isManager ? undefined : user.uid,
          managerView: isManager,
        }).catch(() => []);
        stats.tasksToday = tasks.filter(isTaskDueToday).length;

        if (hasCrm) {
          const routes = await fetchVisitRoutes(user.storeId).catch(() => []);
          if (isManager) {
            stats.teamVisitsToday = countTeamRouteStops(routes, today);
            stats.followUpsToday = await countFollowUpsToday(user.storeId);
            stats.pendingApprovals = await countPendingApprovals(user.storeId);
          } else {
            const repIds = await collectMobileCrmRepIds(user);
            stats.routeStops = countRouteStops(routes, today, repIds);
            stats.followUpsToday = await countFollowUpsToday(user.storeId, repIds);
          }
        } else if (isManager) {
          stats.pendingApprovals = await countPendingApprovals(user.storeId);
        }

        const briefingKey = `${BRIEFING_PREFIX}${user.uid}:${today}`;
        const alreadyBriefed = await AsyncStorage.getItem(briefingKey);
        const beirutHour = Number(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Beirut',
            hour: 'numeric',
            hour12: false,
          }).format(new Date()),
        );

        if (!alreadyBriefed && beirutHour >= 7 && beirutHour <= 10) {
          const { title, body } = buildMorningBriefing(role, displayName, stats);
          const sent = await showAssistantPush(title, body, { type: 'morning_briefing' });
          if (sent) await AsyncStorage.setItem(briefingKey, '1');
        }

        if (isManager && stats.pendingApprovals > 0 && hasCrm) {
          const nudgeKey = `${APPROVAL_NUDGE_PREFIX}${user.uid}:${today}`;
          const nudged = await AsyncStorage.getItem(nudgeKey);
          if (!nudged && beirutHour >= 9 && beirutHour <= 17) {
            const { title, body } = buildPendingApprovalNudge(displayName, stats.pendingApprovals);
            const sent = await showAssistantPush(title, body, { type: 'pending_approvals' });
            if (sent) await AsyncStorage.setItem(nudgeKey, '1');
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    void run();
    const timer = setInterval(() => {
      void run();
    }, BRIEFING_POLL_MS);

    return () => clearInterval(timer);
  }, [
    user?.uid,
    user?.storeId,
    user?.userRole,
    user?.subAccountRole,
    user?.teamMemberName,
    user?.displayName,
    user?.email,
    loading,
    canUse,
  ]);
}
