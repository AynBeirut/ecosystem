import { Platform, PermissionsAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  requestPermission,
  AuthorizationStatus,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import { requestAndroidPermission } from './androidPermissions';
import { isWithinWorkHours } from './workHours';

export const ANDROID_FINANCE_CHANNEL_ID = 'grabio_finance_reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function requestAndroidPostNotifications(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  try {
    await requestAndroidPermission(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // best effort
  }
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_FINANCE_CHANNEL_ID, {
    name: 'Invoice & task reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function showFinanceReminderPush(
  identifier: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!isWithinWorkHours()) return;
  await ensureAndroidNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data,
    },
    trigger: null,
  });
}

async function saveFcmToken(userId: string, token: string, storeId?: string): Promise<void> {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('fcmTokens')
    .doc(token)
    .set(
      {
        token,
        platform: Platform.OS,
        app: 'grabio-invoice-mobile',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  const userPatch: Record<string, unknown> = {
    fcmTokenUpdatedAt: new Date().toISOString(),
    fcmPlatform: Platform.OS,
  };
  if (storeId) userPatch.storeId = storeId;
  await firestore().collection('users').doc(userId).set(userPatch, { merge: true });
}

export async function registerPushNotifications(userId: string, storeId?: string): Promise<void> {
  if (!userId) return;

  await ensureAndroidNotificationChannel();
  await requestAndroidPostNotifications();

  const expoPerm = await Notifications.requestPermissionsAsync();
  if (!expoPerm.granted && expoPerm.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    // Continue — FCM may still work on some devices
  }

  const msg = getMessaging();
  const authStatus = await requestPermission(msg);
  const enabled =
    authStatus === AuthorizationStatus.AUTHORIZED
    || authStatus === AuthorizationStatus.PROVISIONAL;
  if (!enabled) return;

  const token = await getToken(msg);
  if (!token) return;

  await saveFcmToken(userId, token, storeId);
}

let tokenRefreshUnsub: (() => void) | null = null;

export function attachFcmTokenRefresh(userId: string, storeId?: string): () => void {
  tokenRefreshUnsub?.();
  tokenRefreshUnsub = null;

  const msg = getMessaging();
  const unsub = onTokenRefresh(msg, async (token: string) => {
    await saveFcmToken(userId, token, storeId);
  });
  tokenRefreshUnsub = unsub;
  return unsub;
}
