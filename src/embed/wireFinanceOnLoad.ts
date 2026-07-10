/**
 * Side-effect: wire Grabio Firebase into finance embed BEFORE any @finance module
 * imports integrations/firebase/client (must be first import in FinanceAppBridge).
 */
import { getApp } from 'firebase/app';
import { auth, authReady, db, storage } from '@/lib/firebase';
import { setFinanceFirebaseBridge } from '../../vendor/beirut-finance-flow-main/src/integrations/firebase/embedBridge';

setFinanceFirebaseBridge({
  app: getApp(),
  auth,
  authReady,
  db,
  storage,
});
