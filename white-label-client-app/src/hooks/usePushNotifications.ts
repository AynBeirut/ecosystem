import { useEffect } from 'react';
import {
  getMessaging,
  AuthorizationStatus,
  requestPermission,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import { Alert } from 'react-native';

export function usePushNotifications() {
  useEffect(() => {
    const msg = getMessaging();

    // Request permission
    requestPermission(msg).then((authStatus) => {
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        console.log('Push notification permission denied');
      }
    });

    // Handle foreground messages
    const unsubForeground = onMessage(msg, async (remoteMessage) => {
      const title = remoteMessage.notification?.title || 'Notification';
      const body = remoteMessage.notification?.body || '';
      Alert.alert(title, body);
    });

    // Handle notification opened while app was in background
    onNotificationOpenedApp(msg, (remoteMessage) => {
      console.log('Notification opened from background:', remoteMessage);
    });

    // Handle notification that opened the app from quit state
    getInitialNotification(msg).then((remoteMessage) => {
      if (remoteMessage) {
        console.log('App opened from quit state notification:', remoteMessage);
      }
    });

    return unsubForeground;
  }, []);
}
