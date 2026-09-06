import { useEffect, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { hasStoreAdminAccess } from '../lib/crmRepResolve';
import { showAssistantPush } from '../lib/pushNotifications';
import { buildManagerVisitAlert, isWithinWorkHours } from '../lib/smartAssistantNotifications';

/** Notify managers when sales reps log a visit — personalized, work hours only. */
export function useCrmActivityAlerts(storeId?: string, userRole?: string, subAccountRole?: string) {
  const { user } = useAuth();
  const primedRef = useRef(false);
  const isManager = hasStoreAdminAccess(userRole, subAccountRole);

  useEffect(() => {
    if (!storeId || !isManager || !user) return;

    const unsub = firestore()
      .collection('crmActivities')
      .where('storeId', '==', storeId)
      .limit(30)
      .onSnapshot((snap) => {
        if (!snap || !primedRef.current) {
          primedRef.current = true;
          return;
        }
        if (!isWithinWorkHours()) return;

        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const data = change.doc.data();
          if (data.type !== 'visit') return;
          if (data.createdBy === user.uid) return;

          const repName = String(data.repName || 'A team member');
          const clientName = String(data.customerName || data.clientName || 'a client');
          const managerName = user.teamMemberName || user.displayName || user.email || 'there';
          const { title, body } = buildManagerVisitAlert(managerName, repName, clientName);
          void showAssistantPush(title, body, {
            type: 'crm_activity',
            customerId: String(data.customerId || ''),
          });
        });
      });

    return unsub;
  }, [storeId, isManager, user?.uid, user?.teamMemberName, user?.displayName, user?.email]);
}
