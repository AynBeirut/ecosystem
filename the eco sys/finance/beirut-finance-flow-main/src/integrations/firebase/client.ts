import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFinanceFirebaseBridge } from './embedBridge';

/** Public Firebase web config (market-flow-7b074). Env vars override for local/staging. */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'grabio.space',
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
  const app = initializeApp(firebaseConfig);
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

const runtime = resolveRuntime();

export const auth = runtime.auth;
export const authReady = runtime.authReady;
export const db = runtime.db;
export const storage = runtime.storage;
