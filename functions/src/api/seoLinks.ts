import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function assertPlatformAdmin(req: Request): Promise<void> {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');

  const decoded = await admin.auth().verifyIdToken(token);
  const userSnap = await admin.firestore().collection('users').doc(decoded.uid).get();
  if (String(userSnap.data()?.role ?? '') !== 'admin') {
    throw new Error('Platform admin access required');
  }
}

export async function checkSeoLink(req: Request, res: Response): Promise<void> {
  try {
    await assertPlatformAdmin(req);

    const url = String(req.body?.url || '').trim();
    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      res.status(400).json({ success: false, message: 'Invalid URL' });
      return;
    }

    const response = await fetch(parsedUrl.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'GrabioLinkChecker/1.0' },
    }).catch(async () => {
      return fetch(parsedUrl.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'GrabioLinkChecker/1.0' },
      });
    });

    res.json({ success: true, status: response.status, url: parsedUrl.toString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Link check failed';
    const status = message.includes('admin') ? 403 : message.includes('Missing bearer') ? 401 : 500;
    res.status(status).json({ success: false, message });
  }
}
