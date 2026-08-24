import { getApp } from 'firebase/app';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFinanceFirebaseBridge } from './embedBridge';

function resolveFinanceAuthDomain(): string {
  const envAuthDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  if (envAuthDomain) return envAuthDomain;
  if (typeof window === 'undefined') return 'grabio.space';
  const hostname = window.location.hostname.toLowerCase();
  const isFirebasePreview = /^market-flow-7b074--[a-z0-9-]+\.web\.app$/i.test(hostname);
  const isFirebaseHosted =
    hostname === 'market-flow-7b074.web.app' || hostname === 'market-flow-7b074.firebaseapp.com';
  if (isFirebasePreview || isFirebaseHosted || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'market-flow-7b074.firebaseapp.com';
  }
  return 'grabio.space';
}

/** Public Firebase web config (market-flow-7b074). Env vars override for local/staging. */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveFinanceAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'market-flow-7b074',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'market-flow-7b074.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '997465465802',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:997465465802:web:3c6789ea41a9458a98e533',
};

type FinanceFirebaseRuntime = {
  app: FirebaseApp;
  auth: Auth;
  authReady: Promise<void>;
  db: Firestore;
  storage: FirebaseStorage;
};

function initStandalone(): FinanceFirebaseRuntime {
  let app: FirebaseApp;
  try {
    app = getApp();
  } catch {
    app = initializeApp(firebaseConfig);
  }
  const auth = getAuth(app);
  const authReady = setPersistence(auth, browserLocalPersistence);
  const db = getFirestore(app);
  const storage = getStorage(app);
  return { app, auth, authReady, db, storage };
}

function resolveRuntime(): FinanceFirebaseRuntime {
  const embedded = getFinanceFirebaseBridge();
  if (embedded) {
    return embedded;
  }
  return initStandalone();
}

/** Resolve at call time — required when finance is embedded in Grabio admin. */
export function getFinanceDb(): Firestore {
  return resolveRuntime().db;
}

export function getFinanceAuth(): Auth {
  return resolveRuntime().auth;
}

export function getFinanceAuthReady(): Promise<void> {
  return resolveRuntime().authReady;
}

export function getFinanceStorage(): FirebaseStorage {
  return resolveRuntime().storage;
}
