import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { canUseModule } from '../lib/entitlements';

const db = admin.firestore();

/**
 * Express middleware — returns 403 when store lacks module entitlement.
 * Set ECOSYSTEM_ENFORCE_MODULES=true to activate in staging.
 */
export function requireModule(moduleId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.ECOSYSTEM_ENFORCE_MODULES !== 'true') {
      return next();
    }

    const storeId =
      (req.body?.storeId as string) ||
      (req.query?.storeId as string) ||
      (req.headers['x-store-id'] as string);

    if (!storeId) {
      return res.status(400).json({ error: 'storeId required' });
    }

    const snap = await db.collection('storeProfiles').doc(storeId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    if (!canUseModule(snap.data(), moduleId)) {
      return res.status(403).json({ error: `Module not enabled: ${moduleId}` });
    }

    return next();
  };
}
