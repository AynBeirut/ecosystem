import { Platform, PermissionsAndroid } from 'react-native';
import { requestAndroidPermission } from './androidPermissions';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  requestPermission,
  AuthorizationStatus,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import { isWithinWorkHours } from './smartAssistantNotifications';

export const ANDROID_CHANNEL_ID = 'grabio_alerts';
export const ANDROID_CRM_CHANNEL_ID = 'grabio_crm_reminders';
export const ANDROID_ASSISTANT_CHANNEL_ID = 'grabio_assistant';

const activeCrmReminderIds = new Set<string>();

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
    // best effort — still try FCM token
  }
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Order alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(ANDROID_CRM_CHANNEL_ID, {
    name: 'CRM visit reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(ANDROID_ASSISTANT_CHANNEL_ID, {
    name: 'Work assistant',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 120],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Gentle assistant push — only during work hours. Returns false if suppressed. */
export async function showAssistantPush(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<boolean> {
  if (!isWithinWorkHours()) return false;
  await ensureAndroidNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      data,
    },
    trigger: null,
  });
  return true;
}

export async function showLocalPush(title: string, body: string, data?: Record<string, string>): Promise<void> {
  if (!isWithinWorkHours()) return;
  await ensureAndroidNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data,
    },
    trigger: null,
  });
}

export async function showCrmReminderPush(
  customerId: string,
  title: string,
  body: string,
  followUpAt: string,
): Promise<void> {
  if (!isWithinWorkHours()) return;
  if (activeCrmReminderIds.has(customerId)) return;
  activeCrmReminderIds.add(customerId);
  await ensureAndroidNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: `crm_visit_${customerId}`,
    content: {
      title,
      body,
      sound: true,
      sticky: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: {
        type: 'crm_visit_reminder',
        customerId,
        followUpAt,
      },
    },
    trigger: null,
  });
}

export async function dismissCrmReminder(customerId: string): Promise<void> {
  activeCrmReminderIds.delete(customerId);
  try {
    await Notifications.dismissNotificationAsync(`crm_visit_${customerId}`);
    await Notifications.cancelScheduledNotificationAsync(`crm_visit_${customerId}`);
  } catch {
    // ignore
  }
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
        app: 'grabio-mobile',
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

/** Persist FCM token — always attempts getToken (no early exit on permission UI). */
export async function registerPushNotifications(
  userId: string,
  storeId?: string,
): Promise<void> {
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
  const unsub = onTokenRefresh(msg, async (token) => {
    await saveFcmToken(userId, token, storeId);
  });
  tokenRefreshUnsub = unsub;
  return unsub;
}
