import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function resolveFirebaseAuthDomain(): string {
  const envAuthDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  if (envAuthDomain) return envAuthDomain;

  if (typeof window === 'undefined') {
    return 'grabio.space';
  }

  const hostname = window.location.hostname.toLowerCase();
  const isFirebasePreview = /^market-flow-7b074--[a-z0-9-]+\.web\.app$/i.test(hostname);
  const isFirebaseHosted =
    hostname === 'market-flow-7b074.web.app' ||
    hostname === 'market-flow-7b074.firebaseapp.com';

  if (isFirebasePreview || isFirebaseHosted || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'market-flow-7b074.firebaseapp.com';
  }

  return 'grabio.space';
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveFirebaseAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'market-flow-7b074',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'market-flow-7b074.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '997465465802',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_GA4_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
/** Await before auth listeners / redirect handling so persistence is ready. */
export const authReady = setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
export const storage = getStorage(app);
