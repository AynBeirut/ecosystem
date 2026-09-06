/**
 * Submit Phase 1 /demo/* URLs to Google Indexing API (URL_UPDATED).
 * Requires Firebase service account added as Owner in Search Console for grabio.space.
 *
 * Usage: node scripts/submit-demo-urls-indexing.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GoogleAuth } from 'google-auth-library';

const KEY_PATH = resolve(process.cwd(), 'serviceAccountKey.json');
const DEMO_URLS = [
  'https://grabio.space/demo/shop',
  'https://grabio.space/demo/cafe',
  'https://grabio.space/demo/restaurant',
  'https://grabio.space/demo/manufacturing',
  'https://grabio.space/demo/ecommerce',
];

async function main() {
  const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Failed to obtain access token');

  const results = [];
  for (const url of DEMO_URLS) {
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    const body = await res.text();
    results.push({ url, ok: res.ok, status: res.status, body: body.slice(0, 200) });
    console.log(`${res.ok ? 'OK' : 'FAIL'} ${res.status} ${url}`);
    if (!res.ok) console.log(`  ${body.slice(0, 300)}`);
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nSubmitted ${okCount}/${DEMO_URLS.length} URLs`);
  if (okCount < DEMO_URLS.length) {
    console.error(
      'Some URLs failed — add firebase-adminsdk service account as Owner in GSC, or request indexing manually in URL Inspection.',
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
