import { useEffect, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import { showLocalPush } from '../lib/pushNotifications';

/** Real-time order alerts while app is running — backup when FCM is delayed. */
export function useStoreOrderAlerts(storeId?: string) {
  const primedRef = useRef(false);

  useEffect(() => {
    if (!storeId) return;

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

        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const data = change.doc.data();
          const name = String(data.customerName || 'Customer');
          const total = Number(data.total || 0).toFixed(2);
          const currency = String(data.currency || 'USD');
          void showLocalPush('🛒 New order', `${name} · ${currency} ${total}`);
        });
      });

    return unsub;
  }, [storeId]);
}
