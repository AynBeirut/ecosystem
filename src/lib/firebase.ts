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

  // Preview channels and Firebase-hosted domains should use the stable Firebase
  // auth domain instead of the production custom domain.
  if (isFirebasePreview || isFirebaseHosted || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'market-flow-7b074.firebaseapp.com';
  }

  return 'grabio.space';
}

const firebaseConfig = {
  apiKey: "AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U",
  authDomain: resolveFirebaseAuthDomain(),
  projectId: "market-flow-7b074",
  storageBucket: "market-flow-7b074.firebasestorage.app",
  messagingSenderId: "997465465802",
  appId: "1:997465465802:web:3c6789ea41a9458a98e533",
  measurementId: "G-YSSWDNYTSW"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
/** Await before auth listeners / redirect handling so persistence is ready. */
export const authReady = setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
export const storage = getStorage(app);
