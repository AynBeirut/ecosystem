/**
 * One-shot SEO status pull — GSC token from Firestore, demo_start counts, sitemap ping log.
 * Usage: NODE_PATH=functions/node_modules node scripts/seo-status-report.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import admin from 'firebase-admin';

const KEY_PATH = resolve(process.cwd(), 'serviceAccountKey.json');
const DEMO_SLUGS = ['shop', 'cafe', 'restaurant', 'manufacturing', 'ecommerce'];
const DEMO_URLS = DEMO_SLUGS.map((s) => `https://grabio.space/demo/${s}`);
const GSC_SITE_CANDIDATES = [
  'https://grabio.space/',
  'sc-domain:grabio.space',
  'https://www.grabio.space/',
];

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function getGscToken() {
  const snap = await db.doc('seo_technical/gsc_oauth').get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const token = data.accessToken ?? data.token ?? null;
  const expires = Number(data.expires ?? data.expiresAt ?? 0);
  if (!token) return null;
  if (expires && Date.now() > expires) return { expired: true, expires: new Date(expires).toISOString() };
  return { token, expires: expires ? new Date(expires).toISOString() : null };
}

async function inspectUrl(token, siteUrl, inspectionUrl) {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 400) };
  const data = JSON.parse(text);
  const idx = data.inspectionResult?.indexStatusResult ?? {};
  return {
    ok: true,
    verdict: idx.verdict ?? null,
    coverageState: idx.coverageState ?? null,
    indexingState: idx.indexingState ?? null,
    robotsTxtState: idx.robotsTxtState ?? null,
    pageFetchState: idx.pageFetchState ?? null,
    lastCrawlTime: idx.lastCrawlTime ?? null,
  };
}

async function searchAnalytics(token, siteUrl, urlPrefix) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        dimensions: ['page'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'contains',
                expression: urlPrefix,
              },
            ],
          },
        ],
        rowLimit: 50,
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 400) };
  const data = JSON.parse(text);
  return { ok: true, rows: data.rows ?? [] };
}

async function demoStartCounts() {
  const snap = await db.collection('seo_events').where('event_name', '==', 'demo_start').get();
  const total = snap.size;
  const byVertical = {};
  const byLabel = {};
  let latest = null;
  for (const doc of snap.docs) {
    const d = doc.data();
    const v = d.vertical ?? d.label ?? 'unknown';
    byVertical[v] = (byVertical[v] ?? 0) + 1;
    const lbl = d.label ?? 'unknown';
    byLabel[lbl] = (byLabel[lbl] ?? 0) + 1;
    const created = d.created_at?.toDate?.() ?? null;
    if (created && (!latest || created > latest)) latest = created;
  }
  return { total, byVertical, byLabel, latest: latest?.toISOString() ?? null };
}

async function indexingSubmissionLog() {
  const snap = await db.doc('seo_reporting/sitemap').get();
  const indexingAttempts = [];
  // Any stored URL submission metadata
  for (const slug of DEMO_SLUGS) {
    const d = await db.collection('seo_reporting').doc('indexing_requests').collection('urls').doc(slug).get();
    if (d.exists) indexingAttempts.push({ slug, ...d.data() });
  }
  return {
    sitemapPing: snap.exists ? snap.data() : null,
    perUrlDocs: indexingAttempts,
  };
}

async function resolveWorkingGscSite(token) {
  for (const siteUrl of GSC_SITE_CANDIDATES) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) return siteUrl;
  }
  // list all sites
  const list = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!list.ok) return null;
  const data = await list.json();
  return (data.siteEntry ?? []).map((s) => s.siteUrl);
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    gsc: { connected: false },
    demoStart: await demoStartCounts(),
    indexingLog: await indexingSubmissionLog(),
    urlInspections: [],
    performance: [],
  };

  const gsc = await getGscToken();
  if (!gsc || gsc.expired) {
    report.gsc = {
      connected: false,
      reason: gsc?.expired ? 'token_expired' : 'no_token_in_seo_technical/gsc_oauth',
      expires: gsc?.expires ?? null,
    };
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  report.gsc.connected = true;
  report.gsc.tokenExpires = gsc.expires;

  const site = await resolveWorkingGscSite(gsc.token);
  report.gsc.property = site;

  if (typeof site === 'string') {
    for (const url of DEMO_URLS) {
      const inspection = await inspectUrl(gsc.token, site, url);
      report.urlInspections.push({ url, ...inspection });
    }
    const perf = await searchAnalytics(gsc.token, site, '/demo/');
    report.performance = perf;
  } else {
    report.gsc.availableSites = site;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
