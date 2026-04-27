import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const BASE_URL = 'https://grabio.space';

interface AuthUser {
  uid: string;
}

type SubmissionTarget = 'bing';

interface SubmissionResult {
  target: SubmissionTarget;
  ok: boolean;
  status?: number;
  detail?: string;
}

function normalizePath(path: string): string {
  const trimmed = String(path || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc: string, lastmod?: string, priority = '0.8'): string {
  const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${mod}\n    <priority>${priority}</priority>\n  </url>`;
}

export async function getSitemap(req: Request, res: Response): Promise<void> {
  try {
    const db = admin.firestore();

    // 1. Fetch all published stores
    const storesSnap = await db.collection('storeProfiles').get();
    const storeEntries: string[] = [];
    const storeSlugMap: Record<string, string> = {}; // id → slug

    for (const d of storesSnap.docs) {
      const data = d.data();
      const slug: string = data.slug || d.id;
      storeSlugMap[d.id] = slug;
      const lastmod: string | undefined = data.updatedAt
        ? new Date(data.updatedAt).toISOString().split('T')[0]
        : undefined;
      storeEntries.push(urlEntry(`${BASE_URL}/${escapeXml(slug)}`, lastmod, '0.9'));
    }

    // 2. Fetch all products that have a slug
    const productsSnap = await db.collection('products').where('slug', '!=', '').get();
    const productEntries: string[] = [];

    for (const d of productsSnap.docs) {
      const data = d.data();
      const productSlug: string = data.slug;
      const storeSlug = storeSlugMap[data.storeId];
      if (!storeSlug || !productSlug) continue;
      const lastmod: string | undefined = data.updatedAt
        ? new Date(data.updatedAt).toISOString().split('T')[0]
        : undefined;
      productEntries.push(
        urlEntry(`${BASE_URL}/${escapeXml(storeSlug)}/product/${escapeXml(productSlug)}`, lastmod, '0.7')
      );
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urlEntry(`${BASE_URL}/`, undefined, '1.0'),
      ...storeEntries,
      ...productEntries,
      '</urlset>',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap generation error:', err);
    res.status(500).send('Failed to generate sitemap');
  }
}

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (_err) {
    return null;
  }
}

async function canAccessStore(user: AuthUser, storeId: string): Promise<boolean> {
  if (!storeId) return false;
  if (user.uid === storeId) return true;

  const db = admin.firestore();
  const [storeSnap, userSnap, sellerSnap] = await Promise.all([
    db.collection('storeProfiles').doc(storeId).get(),
    db.collection('users').doc(user.uid).get(),
    db.collection('sellers').doc(user.uid).get(),
  ]);

  if (!storeSnap.exists) return false;

  const storeData = storeSnap.data() as Record<string, unknown>;
  if (typeof storeData.ownerId === 'string' && storeData.ownerId === user.uid) return true;

  if (userSnap.exists) {
    const userData = userSnap.data() as Record<string, unknown>;
    if (typeof userData.storeId === 'string' && userData.storeId === storeId) return true;
  }

  if (sellerSnap.exists) {
    const sellerData = sellerSnap.data() as Record<string, unknown>;
    if (typeof sellerData.storeId === 'string' && sellerData.storeId === storeId) return true;
  }

  return false;
}

function getPublicBaseUrl(req: Request): string {
  const fromEnv = String(process.env.SITEMAP_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const host = String(req.get('host') || '').trim();
  if (!host) return BASE_URL;

  const isLocal = /localhost|127\.0\.0\.1/i.test(host);
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${host}`;
}

async function submitToBing(sitemapUrl: string): Promise<SubmissionResult> {
  const targetUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  try {
    const response = await fetch(targetUrl, { method: 'GET' });
    const body = await response.text();
    return {
      target: 'bing',
      ok: response.ok,
      status: response.status,
      detail: body.slice(0, 300),
    };
  } catch (err) {
    return {
      target: 'bing',
      ok: false,
      detail: err instanceof Error ? err.message : 'Unknown submission error',
    };
  }
}

/**
 * POST /seo/sitemap/submit
 * Body: { storeId }
 * Triggers sitemap submission workflow to supported engines and stores last submission metadata.
 */
export async function submitSitemap(req: Request, res: Response): Promise<void> {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      return;
    }

    const storeId = String(req.body?.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Missing required field: storeId' });
      return;
    }

    const hasAccess = await canAccessStore(user, storeId);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden: no access to this store' });
      return;
    }

    const baseUrl = getPublicBaseUrl(req);
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const submittedAt = new Date().toISOString();

    const results = await Promise.all([submitToBing(sitemapUrl)]);

    await admin.firestore().collection('storeProfiles').doc(storeId).set({
      seoSettings: {
        lastSitemapSubmission: {
          submittedAt,
          by: user.uid,
          sitemapUrl,
          results,
        },
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const okCount = results.filter((item) => item.ok).length;
    const failed = results.filter((item) => !item.ok).map((item) => item.target);

    res.status(200).json({
      ok: true,
      submittedAt,
      sitemapUrl,
      results,
      summary: {
        successCount: okCount,
        total: results.length,
        failedTargets: failed,
      },
    });
  } catch (err) {
    console.error('Sitemap submission error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to submit sitemap' });
  }
}

export async function getRobotsTxt(req: Request, res: Response): Promise<void> {
  try {
    const db = admin.firestore();
    const storesSnap = await db.collection('storeProfiles').get();

    const disallowLines: string[] = [];
    const customDirectiveLines: string[] = [];

    for (const doc of storesSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const slugRaw = typeof data.slug === 'string' ? data.slug.trim() : '';
      if (!slugRaw) continue;

      const seo = (data.seoSettings || {}) as Record<string, unknown>;
      const paths = Array.isArray(seo.robotsDisallowPaths) ? seo.robotsDisallowPaths : [];

      for (const value of paths) {
        const normalized = normalizePath(String(value || ''));
        if (!normalized) continue;
        disallowLines.push(`Disallow: /${slugRaw}${normalized}`);
      }

      const customRaw = typeof seo.robotsCustomDirectives === 'string' ? seo.robotsCustomDirectives : '';
      if (customRaw.trim()) {
        customDirectiveLines.push(`# store:${slugRaw}`);
        customRaw
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .forEach((line) => customDirectiveLines.push(line));
      }
    }

    const uniqueDisallowLines = Array.from(new Set(disallowLines)).sort();

    const output = [
      'User-agent: *',
      'Allow: /',
      ...uniqueDisallowLines,
      `Sitemap: ${BASE_URL}/sitemap.xml`,
      ...(customDirectiveLines.length > 0 ? ['', ...customDirectiveLines] : []),
      '',
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(output);
  } catch (err) {
    console.error('robots.txt generation error:', err);
    res.status(500).send('Failed to generate robots.txt');
  }
}
