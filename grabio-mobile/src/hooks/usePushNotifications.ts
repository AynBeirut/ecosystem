import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import {
  attachFcmTokenRefresh,
  ensureAndroidNotificationChannel,
  registerPushNotifications,
  showLocalPush,
} from '../lib/pushNotifications';
import { useStoreOrderAlerts } from './useStoreOrderAlerts';
import { useCrmVisitReminders, markCrmReminderDismissed } from './useCrmVisitReminders';
import { useCrmActivityAlerts } from './useCrmActivityAlerts';
import { useSmartWorkAssistant } from './useSmartWorkAssistant';
import { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function usePushNotifications() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  useStoreOrderAlerts(user?.storeId);
  useCrmVisitReminders();
  useCrmActivityAlerts(user?.storeId, user?.userRole, user?.subAccountRole);
  useSmartWorkAssistant();

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
      await showLocalPush(title, body, remoteMessage.data as Record<string, string> | undefined);
    });

    onNotificationOpenedApp(msg, () => {});
    getInitialNotification(msg).then(() => {});

    return unsubForeground;
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        customerId?: string;
        followUpAt?: string;
      };
      if (data?.type === 'crm_visit_reminder' && data.customerId) {
        void markCrmReminderDismissed(data.customerId, String(data.followUpAt || ''));
        navigation.navigate('CrmClientDetail', {
          clientId: data.customerId,
          clientName: 'Client',
        });
      }
    });
    return () => sub.remove();
  }, [navigation]);
}
