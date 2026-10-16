import { useEffect } from 'react';
import {
  getMessaging,
  onMessage,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { useAuth } from '../context/AuthContext';
import {
  attachFcmTokenRefresh,
  ensureAndroidNotificationChannel,
  registerPushNotifications,
  showFinanceReminderPush,
} from '../lib/pushNotifications';
import { useFinanceReminders } from './useFinanceReminders';

export function usePushNotifications() {
  const { user } = useAuth();

  useFinanceReminders();

  useEffect(() => {
    void ensureAndroidNotificationChannel();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    void registerPushNotifications(user.uid, user.storeId);
    return attachFcmTokenRefresh(user.uid, user.storeId);
  }, [user?.uid, user?.storeId]);

  useEffect(() => {
    const msg = getMessaging();
    const unsubForeground = onMessage(msg, async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      const title = remoteMessage.notification?.title || 'Grabio Invoice';
      const body = remoteMessage.notification?.body || '';
      const raw = remoteMessage.data || {};
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string') data[k] = v;
      }
      const id = data?.taskId || data?.invoiceId || data?.estimateId || `fcm_${Date.now()}`;
      await showFinanceReminderPush(`fcm_${id}`, title, body, data);
    });
    return unsubForeground;
  }, []);
}
