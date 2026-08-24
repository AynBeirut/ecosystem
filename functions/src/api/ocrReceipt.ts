import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import { parseOcrText } from '../lib/ocrParse';

const db = admin.firestore();

/** Max decoded bytes (~4MB). Client should resize images; PDFs stay under this. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function canAccessStore(uid: string, storeId: string): Promise<boolean> {
  if (!storeId || !uid) return false;
  if (storeId === uid) return true;

  const [storeSnap, userSnap, sellerSnap] = await Promise.all([
    db.collection('storeProfiles').doc(storeId).get(),
    db.collection('users').doc(uid).get(),
    db.collection('sellers').doc(uid).get(),
  ]);

  if (storeSnap.exists) {
    const data = storeSnap.data() || {};
    if (
      data.ownerId === uid ||
      data.userId === uid ||
      data.adminId === uid
    ) {
      return true;
    }
  }
  if (userSnap.exists && userSnap.data()?.storeId === storeId) return true;
  if (sellerSnap.exists && sellerSnap.data()?.storeId === storeId) return true;
  return false;
}

function stripDataUrl(input: string): { mime: string; base64: string } {
  const m = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (m) {
    return { mime: m[1].trim().toLowerCase(), base64: m[2].replace(/\s/g, '') };
  }
  return { mime: 'image/jpeg', base64: input.replace(/\s/g, '') };
}

async function getVisionAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-vision'],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) {
    throw new Error('Could not obtain Google access token for Vision API');
  }
  return accessToken.token;
}

async function annotateImageWithVision(base64: string): Promise<string> {
  const token = await getVisionAccessToken();
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    }),
  });

  const body = (await res.json()) as {
    error?: { message?: string };
    responses?: Array<{
      error?: { message?: string };
      fullTextAnnotation?: { text?: string };
      textAnnotations?: Array<{ description?: string }>;
    }>;
  };

  if (!res.ok) {
    throw new Error(body.error?.message || `Vision API HTTP ${res.status}`);
  }

  const first = body.responses?.[0];
  if (first?.error?.message) {
    throw new Error(first.error.message);
  }

  const full = first?.fullTextAnnotation?.text?.trim();
  if (full) return full;
  const legacy = first?.textAnnotations?.[0]?.description?.trim();
  if (legacy) return legacy;
  return '';
}

/** Sync PDF OCR via Vision files:annotate (first pages). */
async function annotatePdfWithVision(base64: string): Promise<string> {
  const token = await getVisionAccessToken();
  const res = await fetch('https://vision.googleapis.com/v1/files:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          inputConfig: {
            content: base64,
            mimeType: 'application/pdf',
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          // First 5 pages is enough for invoices
          pages: [1, 2, 3, 4, 5],
        },
      ],
    }),
  });

  const body = (await res.json()) as {
    error?: { message?: string };
    responses?: Array<{
      error?: { message?: string };
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
      }>;
    }>;
  };

  if (!res.ok) {
    throw new Error(body.error?.message || `Vision PDF API HTTP ${res.status}`);
  }

  const fileResp = body.responses?.[0];
  if (fileResp?.error?.message) {
    throw new Error(fileResp.error.message);
  }

  const pages = fileResp?.responses || [];
  const parts: string[] = [];
  for (const page of pages) {
    const full = page.fullTextAnnotation?.text?.trim();
    if (full) {
      parts.push(full);
      continue;
    }
    const legacy = page.textAnnotations?.[0]?.description?.trim();
    if (legacy) parts.push(legacy);
  }
  return parts.join('\n\n').trim();
}

async function annotateWithVision(base64: string, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return annotatePdfWithVision(base64);
  }
  return annotateImageWithVision(base64);
}

/**
 * POST /ocr/receipt
 * Body: { storeId, imageBase64, mimeType? } — image or PDF; never stored.
 * Auth: Bearer Firebase ID token
 */
export async function ocrReceipt(req: Request, res: Response): Promise<void> {
  try {
    const idToken = getBearerToken(req);
    if (!idToken) {
      res.status(401).json({ error: 'Sign in required' });
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

    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing storeId' });
      return;
    }

    const allowed = await canAccessStore(uid, storeId);
    if (!allowed) {
      res.status(403).json({ error: 'Not authorized for this store' });
      return;
    }

    const rawImage = String(req.body?.imageBase64 || '').trim();
    if (!rawImage) {
      res.status(400).json({ error: 'Missing imageBase64' });
      return;
    }

    const { mime, base64 } = stripDataUrl(rawImage);
    const declaredMime = String(req.body?.mimeType || mime || 'image/jpeg').toLowerCase();
    const resolvedMime = ALLOWED_MIME.has(declaredMime)
      ? declaredMime
      : ALLOWED_MIME.has(mime)
        ? mime
        : '';
    if (!resolvedMime) {
      res.status(400).json({ error: 'Unsupported file type (use jpeg/png/webp/pdf)' });
      return;
    }

    const approxBytes = Math.floor((base64.length * 3) / 4);
    if (approxBytes <= 0 || approxBytes > MAX_IMAGE_BYTES) {
      res.status(400).json({ error: 'File must be under 4MB' });
      return;
    }

    const rawText = await annotateWithVision(base64, resolvedMime);
    if (!rawText) {
      res.status(422).json({ error: 'No text found on this file' });
      return;
    }

    const draft = parseOcrText(rawText);
    res.json({ draft });
  } catch (err) {
    console.error('[ocr/receipt]', err);
    const message = err instanceof Error ? err.message : 'OCR failed';
    const visionDisabled =
      /PERMISSION_DENIED|Cloud Vision API has not been used|API has not been enabled/i.test(
        message,
      );
    res.status(visionDisabled ? 503 : 500).json({
      error: visionDisabled
        ? 'Cloud Vision API is not enabled on this Google Cloud project'
        : message,
    });
  }
}
