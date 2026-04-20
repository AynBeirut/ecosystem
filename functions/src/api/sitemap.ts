import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const BASE_URL = 'https://grabio.space';

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
