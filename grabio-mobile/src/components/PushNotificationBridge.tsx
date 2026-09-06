import { usePushNotifications } from '../hooks/usePushNotifications';

/** Must render inside NavigationContainer for notification tap routing. */
export default function PushNotificationBridge() {
  usePushNotifications();
  return null;
}
