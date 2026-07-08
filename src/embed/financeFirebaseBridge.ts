import { getApp } from 'firebase/app';
import { auth, authReady, db, storage } from '@/lib/firebase';
import { setFinanceFirebaseBridge } from '../../the eco sys/finance/beirut-finance-flow-main/src/integrations/firebase/embedBridge';

let wired = false;

/** Must run before any @finance module imports integrations/firebase/client. */
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
