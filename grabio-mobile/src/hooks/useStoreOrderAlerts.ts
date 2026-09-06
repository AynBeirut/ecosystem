import { useEffect, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { showAssistantPush } from '../lib/pushNotifications';
import {
  buildOrderAlert,
  isWithinWorkHours,
  mapUserRoleToAssistant,
} from '../lib/smartAssistantNotifications';

/** Real-time order alerts — personalized, work hours only. */
export function useStoreOrderAlerts(storeId?: string) {
  const { user } = useAuth();
  const primedRef = useRef(false);

  useEffect(() => {
    if (!storeId || !user) return;

    const unsub = firestore()
      .collection('orders')
      .where('storeId', '==', storeId)
      .orderBy('createdAt', 'desc')
      .limit(25)
      .onSnapshot((snap) => {
        if (!snap) return;

        if (!primedRef.current) {
          primedRef.current = true;
          return;
        }

        if (!isWithinWorkHours()) return;

        const role = mapUserRoleToAssistant(user.userRole, user.subAccountRole);
        const displayName = user.teamMemberName || user.displayName || user.email || 'there';

        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const data = change.doc.data();
          const name = String(data.customerName || 'Customer');
          const total = Number(data.total || 0).toFixed(2);
          const currency = String(data.currency || 'USD');
          const totalLabel = `${currency} ${total}`;
          const { title, body } = buildOrderAlert(displayName, name, totalLabel, role);
          void showAssistantPush(title, body, { type: 'new_order', orderId: change.doc.id });
        });
      });

    return unsub;
  }, [storeId, user?.uid, user?.userRole, user?.subAccountRole, user?.teamMemberName, user?.displayName, user?.email]);
}
