import { useEffect } from 'react';
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import { useAuth } from '../context/AuthContext';
import {
  attachFcmTokenRefresh,
  ensureAndroidNotificationChannel,
  registerPushNotifications,
  showLocalPush,
} from '../lib/pushNotifications';
import { useStoreOrderAlerts } from './useStoreOrderAlerts';

export function usePushNotifications() {
  const { user } = useAuth();

  useStoreOrderAlerts(user?.storeId);

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

    const unsubForeground = onMessage(msg, async (remoteMessage) => {
      const title = remoteMessage.notification?.title || 'Grabio';
      const body = remoteMessage.notification?.body || '';
      await showLocalPush(title, body);
    });

    onNotificationOpenedApp(msg, () => {});
    getInitialNotification(msg).then(() => {});

    return unsubForeground;
  }, []);
}
