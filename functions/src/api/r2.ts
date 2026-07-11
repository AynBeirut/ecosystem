import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { presignPutUrl, sanitizeFileName, type R2PresignConfig } from '../lib/r2Presign';

const db = admin.firestore();

const ALLOWED_FOLDERS = new Set(['products', 'templates', 'builder']);
const MAX_BYTES = 1_572_864; // ~1.5 MB, matches client R2_MAX_BYTES
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

function getR2Config(): R2PresignConfig | null {
  const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(process.env.R2_BUCKET || '').trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getPublicBaseUrl(): string {
  return String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
}

/** Confirm the authenticated user owns the store (store doc id == uid, or ownerId == uid). */
async function isStoreOwner(storeId: string, uid: string): Promise<boolean> {
  if (!storeId || !uid) return false;
  if (storeId === uid) return true;
  const snap = await db.collection('storeProfiles').doc(storeId).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  return (
    (typeof data.ownerId === 'string' && data.ownerId === uid) ||
    (typeof data.userId === 'string' && data.userId === uid) ||
    (typeof data.adminId === 'string' && data.adminId === uid)
  );
}

/** POST /r2/presign — issue a presigned R2 PUT URL for an authenticated store owner. */
export async function presignR2Upload(req: Request, res: Response): Promise<void> {
  try {
    const idToken = getBearerToken(req);
    if (!idToken) {
      res.status(401).json({ error: 'Sign in required to upload' });
      return;
    }

    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      res.status(401).json({ error: 'Invalid auth token' });
      return;
    }

    const config = getR2Config();
    const publicBase = getPublicBaseUrl();
    if (!config || !publicBase) {
      res.status(503).json({ error: 'R2 storage is not configured' });
      return;
    }

    const storeId = String(req.body?.storeId || '').trim();
    const folder = String(req.body?.folder || '').trim();
    const fileName = String(req.body?.fileName || '').trim();
    const contentType = String(req.body?.contentType || '').trim().toLowerCase();
    const sizeBytes = Number(req.body?.sizeBytes || 0);

    if (!storeId) {
      res.status(400).json({ error: 'Missing storeId' });
      return;
    }
    if (!ALLOWED_FOLDERS.has(folder)) {
      res.status(400).json({ error: 'Invalid folder' });
      return;
    }
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      res.status(400).json({ error: 'Unsupported image type' });
      return;
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
      res.status(400).json({ error: `Image must be under ${Math.round(MAX_BYTES / 1024 / 1024)}MB` });
      return;
    }

    const owns = await isStoreOwner(storeId, uid);
    if (!owns) {
      res.status(403).json({ error: 'Not authorized for this store' });
      return;
    }

    const safeName = sanitizeFileName(fileName);
    const key = `${folder}/${storeId}/${Date.now()}_${safeName}`;

    const uploadUrl = presignPutUrl(config, { key, expiresSeconds: 300 });
    const publicUrl = `${publicBase}/${key}`;

    res.json({ uploadUrl, publicUrl, key, contentType });
  } catch (err) {
    console.error('R2 presign failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Presign failed' });
  }
}
