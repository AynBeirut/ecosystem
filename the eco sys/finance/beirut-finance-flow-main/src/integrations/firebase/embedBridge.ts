import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

export type FinanceFirebaseBridge = {
  app: FirebaseApp;
  auth: Auth;
  authReady: Promise<void>;
  db: Firestore;
  storage: FirebaseStorage;
};

let bridge: FinanceFirebaseBridge | null = null;

export function setFinanceFirebaseBridge(next: FinanceFirebaseBridge): void {
  bridge = next;
}

export function getFinanceFirebaseBridge(): FinanceFirebaseBridge | null {
  return bridge;
}

export function isFinanceFirebaseEmbedded(): boolean {
  return bridge !== null;
}
