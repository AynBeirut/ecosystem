/** Phase 1 marketing URLs — submit to Google Indexing API after GSC OAuth (indexing scope). */

export const MARKETING_SEO_INDEX_URLS = [
  'https://grabio.space/demo/shop',
  'https://grabio.space/demo/cafe',
  'https://grabio.space/demo/restaurant',
  'https://grabio.space/demo/manufacturing',
  'https://grabio.space/demo/ecommerce',
  'https://grabio.space/compare/grabio-vs-square-retail',
  'https://grabio.space/compare/grabio-vs-touchbistro-restaurant',
  'https://grabio.space/compare/grabio-vs-katana-manufacturing',
  'https://grabio.space/compare/grabio-vs-shopify-ecommerce',
  'https://grabio.space/compare/grabio-vs-odoo-small-business',
] as const;

export type IndexingSubmitResult = {
  url: string;
  ok: boolean;
  status: number;
  detail?: string;
};

export async function submitMarketingUrlsForIndexing(accessToken: string): Promise<IndexingSubmitResult[]> {
  const results: IndexingSubmitResult[] = [];

  for (const url of MARKETING_SEO_INDEX_URLS) {
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    const body = await res.text();
    results.push({
      url,
      ok: res.ok,
      status: res.status,
      detail: body.slice(0, 200),
    });
  }

  return results;
}

export async function submitGscSitemap(accessToken: string, sitemapUrl = 'https://grabio.space/sitemap.xml'): Promise<boolean> {
  const site = encodeURIComponent('https://grabio.space/');
  const sitemap = encodeURIComponent(sitemapUrl);
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/sitemaps/${sitemap}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  return res.ok;
}
