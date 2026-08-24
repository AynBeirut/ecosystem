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

function extractJsonLdBlocks(html: string) {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: Array<{
    index: number;
    types: string[];
    valid: boolean;
    errors: string[];
    rawPreview: string;
  }> = [];

  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    const errors: string[] = [];
    let types: string[] = [];
    let valid = true;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        types = (parsed['@graph'] as Array<Record<string, unknown>>)
          .map((node) => String(node['@type'] ?? 'Unknown'))
          .filter(Boolean);
      } else if (parsed['@type']) {
        types = [String(parsed['@type'])];
      } else {
        errors.push('Missing @type');
        valid = false;
      }
      if (!parsed['@context']) errors.push('Missing @context (recommended)');
    } catch {
      errors.push('Invalid JSON');
      valid = false;
    }

    blocks.push({
      index,
      types,
      valid,
      errors,
      rawPreview: raw.slice(0, 180) + (raw.length > 180 ? '…' : ''),
    });
    index += 1;
  }

  return blocks;
}

export async function validateSeoSchema(req: Request, res: Response): Promise<void> {
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

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ success: false, message: 'Only http(s) URLs supported' });
      return;
    }

    const fetchRes = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'GrabioSEOValidator/1.0' },
    });

    if (!fetchRes.ok) {
      res.status(502).json({
        success: false,
        message: `Failed to fetch URL (${fetchRes.status})`,
      });
      return;
    }

    const html = await fetchRes.text();
    const blocks = extractJsonLdBlocks(html);

    res.json({
      success: true,
      url: parsedUrl.toString(),
      blockCount: blocks.length,
      blocks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    const status = message.includes('admin') ? 403 : message.includes('Missing bearer') ? 401 : 500;
    res.status(status).json({ success: false, message });
  }
}
