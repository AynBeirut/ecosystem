import { getApp } from 'firebase/app';
import { auth, authReady, db, storage } from '@/lib/firebase';
import { setFinanceFirebaseBridge } from '../../suba eco sys/finance/beirut-finance-flow-main/src/integrations/firebase/embedBridge';

let wired = false;

/** Idempotent — also runs via wireFinanceOnLoad side-effect before finance imports. */
export function wireFinanceFirebaseFromGrabio(): void {
  if (wired) return;
  setFinanceFirebaseBridge({
    app: getApp(),
    auth,
    authReady,
    db,
    storage,
  });
  wired = true;
}

export function isFinanceFirebaseWired(): boolean {
  return wired;
}
