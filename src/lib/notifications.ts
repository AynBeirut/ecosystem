import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

const FCM_PERMISSION_CHECKED_KEY = 'fcm-permission-checked';

// Re-use the already-initialized Firebase app
let _messaging: ReturnType<typeof getMessaging> | null = null;

function getFirebaseMessaging() {
  if (_messaging) return _messaging;
  // Use the first (and only) initialized app
  const apps = getApps();
  if (apps.length === 0) throw new Error('Firebase app not initialized');
  _messaging = getMessaging(apps[0]);
  return _messaging;
}

/**
 * Requests notification permission and returns the FCM token.
 * Returns null if permission is denied or FCM is not supported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      return null;
    }

    // Avoid repeating the same permission request flow on every remount.
    if (typeof window !== 'undefined' && sessionStorage.getItem(FCM_PERMISSION_CHECKED_KEY) === '1') {
      return null;
    }

    if (Notification.permission === 'denied') {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(FCM_PERMISSION_CHECKED_KEY, '1');
      }
      return null;
    }

    const permission = await Notification.requestPermission();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(FCM_PERMISSION_CHECKED_KEY, '1');
    }

    if (permission !== 'granted') {
      return null;
    }

    // Register firebase-messaging-sw.js and wait until it is active
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Wait for the SW to become active (installing → waiting → active)
    await new Promise<void>((resolve) => {
      if (registration.active) { resolve(); return; }
      const sw = registration.installing || registration.waiting;
      if (!sw) { resolve(); return; }
      sw.addEventListener('statechange', function handler() {
        if (sw.state === 'activated') {
          sw.removeEventListener('statechange', handler);
          resolve();
        }
      });
    });

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VITE_FIREBASE_VAPID_KEY not set. FCM push notifications will not work until this is configured.');
      return null;
    }

    const messaging = getFirebaseMessaging();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    return token || null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

/**
 * Saves an FCM token to Firestore under users/{userId}/fcmTokens/{token}.
 * Uses the token itself as the document ID for easy deduplication.
 */
export async function saveFcmToken(userId: string, token: string): Promise<void> {
  try {
    const db = getFirestore();
    await setDoc(
      doc(db, 'users', userId, 'fcmTokens', token),
      { token, createdAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
}
