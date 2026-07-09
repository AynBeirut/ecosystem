import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

/** Issue a Firebase custom token so Grabio Admin app can SSO into Invoice Manager WebView. */
export async function createFinanceSsoToken(req: Request, res: Response): Promise<void> {
  try {
    const idToken = getBearerToken(req);
    if (!idToken) {
      res.status(401).json({ error: 'Missing authorization' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const customToken = await admin.auth().createCustomToken(decoded.uid);
    res.json({ customToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    res.status(401).json({ error: message });
  }
}
