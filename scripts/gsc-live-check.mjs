import { readFileSync } from 'fs';
import { resolve } from 'path';

const KEY_PATH = resolve(process.cwd(), 'serviceAccountKey.json');
const sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'));

async function main() {
  const snap = await fetch('https://firestore.googleapis.com/v1/projects/market-flow-7b074/databases/(default)/documents/seo_technical/gsc_oauth').catch(() => null);
  // use admin instead
  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  const doc = await db.doc('seo_technical/gsc_oauth').get();
  const token = doc.data()?.token;
  if (!token) { console.log('NO_TOKEN'); return; }

  const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('sites status', sitesRes.status);
  const sites = await sitesRes.json();
  if (!sitesRes.ok) { console.log(JSON.stringify(sites).slice(0,500)); return; }
  const entries = (sites.siteEntry ?? []).map((s) => `${s.siteUrl} (${s.permissionLevel})`);
  console.log('GSC properties:', entries);

  const siteUrl = entries.find((e) => e.includes('grabio'))?.split(' ')[0] ?? 'https://grabio.space/';
  const DEMO = ['shop','cafe','restaurant','manufacturing','ecommerce'].map(s => `https://grabio.space/demo/${s}`);

  for (const url of DEMO) {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl }),
    });
    const body = await res.json().catch(async () => ({ raw: await res.text() }));
    if (!res.ok) {
      console.log('INSPECT FAIL', url, res.status, JSON.stringify(body).slice(0,300));
      continue;
    }
    const idx = body.inspectionResult?.indexStatusResult ?? {};
    console.log('URL', url);
    console.log('  verdict:', idx.verdict);
    console.log('  coverageState:', idx.coverageState);
    console.log('  indexingState:', idx.indexingState);
    console.log('  robotsTxtState:', idx.robotsTxtState);
    console.log('  lastCrawlTime:', idx.lastCrawlTime);
  }

  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 28*86400000).toISOString().split('T')[0];
  for (const site of (sites.siteEntry ?? []).map(s => s.siteUrl).filter(u => u.includes('grabio'))) {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: start, endDate: end,
        dimensions: ['page'],
        dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: '/demo/' }] }],
        rowLimit: 25,
      }),
    });
    const data = await res.json();
    console.log('PERF', site, 'status', res.status, 'rows', (data.rows ?? []).length);
    for (const row of data.rows ?? []) {
      console.log(' ', row.keys[0], 'clicks', row.clicks, 'impressions', row.impressions);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
