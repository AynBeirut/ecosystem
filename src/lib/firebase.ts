import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U",
  // Use environment variable for authDomain so it matches the deployed domain in production
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "market-flow-7b074.firebaseapp.com",
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
