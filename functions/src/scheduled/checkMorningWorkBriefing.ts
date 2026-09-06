import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';
import {
  buildMorningBriefing,
  isWithinWorkHours,
  todayYmdBeirut,
  type MorningBriefingStats,
} from '../services/smartAssistantCopy';
import { getStoreTeamMembers, sendPersonalizedPush } from '../services/teamMembers';

const db = admin.firestore();

function countRouteStopsForDay(routes: FirebaseFirestore.QueryDocumentSnapshot[], today: string): number {
  let total = 0;
  routes.forEach((docSnap) => {
    const data = docSnap.data();
    const visitDate = String(data.visitDate || '');
    const repeatRule = String(data.repeatRule || 'none');
    const applies = visitDate === today || repeatRule !== 'none';
    if (!applies) return;
    if (visitDate !== today && repeatRule === 'none') return;
    const stops = Array.isArray(data.stops) ? data.stops.length : 0;
    total += stops;
  });
  return total;
}

/**
 * Weekday mornings ~8:15 Beirut — personalized work briefing per team member.
 */
export const checkMorningWorkBriefing = functions.onSchedule(
  {
    schedule: '15 8 * * 1-6',
    timeZone: 'Asia/Beirut',
    memory: '512MiB',
  },
  async () => {
    if (!isWithinWorkHours()) {
      console.log('Morning briefing skipped — outside work hours.');
      return;
    }

    const today = todayYmdBeirut();
    let sent = 0;
    const storesSnap = await db.collection('storeProfiles').get();

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const members = await getStoreTeamMembers(storeId);
      if (members.length === 0) continue;

      const [routesSnap, ordersSnap, customersSnap, tasksSnap] = await Promise.all([
        db.collection('crmVisitRoutes').where('storeId', '==', storeId).where('status', '==', 'active').get(),
        db.collection('orders').where('storeId', '==', storeId).where('status', '==', 'pending').limit(50).get(),
        db.collection('customers').where('storeId', '==', storeId).limit(400).get(),
        db.collection('storeTasks').where('storeId', '==', storeId).limit(200).get(),
      ]);

      const teamVisitsToday = countRouteStopsForDay(routesSnap.docs, today);
      const pendingApprovals = ordersSnap.size;
      let followUpsToday = 0;
      customersSnap.docs.forEach((c: FirebaseFirestore.QueryDocumentSnapshot) => {
        const fu = String(c.data().nextFollowUpAt || '');
        if (fu.startsWith(today)) followUpsToday += 1;
      });

      for (const member of members) {
        const userSnap = await db.collection('users').doc(member.userId).get();
        const lastSent = String(userSnap.data()?.assistantBriefingSentAt || '');
        if (lastSent === today) continue;

        const stats: MorningBriefingStats = {
          routeStops: 0,
          followUpsToday: member.role === 'sales' || member.role === 'crm_rep' ? followUpsToday : 0,
          tasksToday: tasksSnap.docs.filter((t: FirebaseFirestore.QueryDocumentSnapshot) => {
            const task = t.data();
            if (task.assignedToUserId !== member.userId) return false;
            const due = String(task.dueAt || '');
            return due.startsWith(today) && task.status !== 'done' && task.status !== 'cancelled';
          }).length,
          pendingApprovals: member.role === 'manager' || member.role === 'owner' ? pendingApprovals : 0,
          teamVisitsToday: member.role === 'manager' || member.role === 'owner' ? teamVisitsToday : 0,
        };

        if (member.role === 'sales' || member.role === 'crm_rep') {
          const repIds = new Set<string>();
          if (member.subAccountId) repIds.add(`sub:${member.subAccountId}`);
          repIds.add(`user:${member.userId}`);
          stats.routeStops = routesSnap.docs
            .filter((r: FirebaseFirestore.QueryDocumentSnapshot) => repIds.has(String(r.data().assignedRepId || '')))
            .reduce((sum: number, r: FirebaseFirestore.QueryDocumentSnapshot) => sum + (Array.isArray(r.data().stops) ? r.data().stops.length : 0), 0);
        }

        const { title, body } = buildMorningBriefing(member.role, member.displayName, stats);
        const ok = await sendPersonalizedPush(member.userId, title, body, {
          type: 'morning_briefing',
          storeId,
        });
        if (ok) {
          await db.collection('users').doc(member.userId).set({ assistantBriefingSentAt: today }, { merge: true });
          sent += 1;
        }
      }
    }

    console.log(`Morning work briefings sent: ${sent}`);
  },
);
