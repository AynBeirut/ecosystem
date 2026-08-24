import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AUDIT_DOC_ID = 'grabio_space';
const PAGESPEED_DOC = 'seo_technical/pagespeed';
const REDIRECTS_DOC = 'seo_technical/redirects';
const GSC_OAUTH_DOC = 'seo_technical/gsc_oauth';
const BROKEN_LINKS_COL = 'seo_broken_links';

export type BrokenLinkResolution = 'open' | 'fixed' | 'redirect';

export type AuditSnapshot = {
  site: string;
  generated_at: string;
  health_score: number;
  vhost_mode?: 'redirect_stub' | 'standard';
  data_source_note?: string | null;
  total_requests: number;
  findings: {
    broken_urls: number;
    redirects: number;
    scanner_probes?: number;
    bot_subnet: string | null;
    bot_ip_count: number;
  };
  status_breakdown: Record<string, number>;
  top_404_urls?: Array<{ url: string; hits: number }>;
};

export type BrokenLinkRow = {
  id: string;
  url: string;
  hits: number;
  resolution: BrokenLinkResolution;
  updatedAt?: Timestamp;
};

export type PageSpeedRow = {
  url: string;
  mobileScore: number | null;
  desktopScore: number | null;
  lcpSeconds: number | null;
  cls: number | null;
  inpMs: number | null;
  alerts: string[];
  checkedAt: string;
};

export type RedirectChainRow = {
  id: string;
  fromUrl: string;
  toUrl: string;
  hops: number;
  notes?: string;
};

export type GscInspectionRow = {
  url: string;
  verdict: string;
  coverageState: string;
  indexingState: string;
};

const GSC_PROPERTY = import.meta.env.VITE_GSC_PROPERTY as string || 'https://www.grabio.space/';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_KEY = 'grabio_gsc_token';
const PSI_KEY = import.meta.env.VITE_PAGESPEED_API_KEY as string | undefined;

export const DEFAULT_PAGESPEED_URLS = [
  'https://grabio.space/',
  'https://grabio.space/solutions',
  'https://grabio.space/solutions/accounting',
  'https://grabio.space/solutions/inventory',
  'https://grabio.space/pricing',
  'https://grabio.space/features',
];

export function getGscToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw) as { token: string; expires: number };
    if (Date.now() > expires) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    if (!localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, raw);
      sessionStorage.removeItem(TOKEN_KEY);
    }
    return token;
  } catch {
    return null;
  }
}

export function storeGscToken(token: string, expiresInSeconds: number): void {
  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({
      token,
      expires: Date.now() + expiresInSeconds * 1000 - 60_000,
    }),
  );
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function persistGscTokenToFirestore(token: string, expiresInSeconds: number): Promise<void> {
  const expires = Date.now() + expiresInSeconds * 1000 - 60_000;
  storeGscToken(token, expiresInSeconds);
  await setDoc(
    doc(db, ...GSC_OAUTH_DOC.split('/')),
    {
      token,
      expires,
      connectedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function loadGscTokenFromFirestore(): Promise<string | null> {
  const snap = await getDoc(doc(db, ...GSC_OAUTH_DOC.split('/')));
  if (!snap.exists()) return null;
  const data = snap.data();
  const token = String(data.token ?? '');
  const expires = Number(data.expires ?? 0);
  if (!token || Date.now() > expires) return null;
  storeGscToken(token, Math.max(60, Math.floor((expires - Date.now()) / 1000)));
  return token;
}

/** Local browser token first, then admin-shared Firestore token (works across browsers). */
export async function resolveGscToken(): Promise<string | null> {
  const local = getGscToken();
  if (local) return local;
  return loadGscTokenFromFirestore();
}

export async function clearGscTokenRemote(): Promise<void> {
  clearGscToken();
  await setDoc(
    doc(db, ...GSC_OAUTH_DOC.split('/')),
    { token: null, expires: 0, clearedAt: new Date().toISOString(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function clearGscToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function loadAuditSnapshot(): Promise<AuditSnapshot | null> {
  const snap = await getDoc(doc(db, 'seo_audits', AUDIT_DOC_ID));
  if (!snap.exists()) return null;
  return snap.data() as AuditSnapshot;
}

export async function loadBrokenLinkStatuses(): Promise<Record<string, BrokenLinkResolution>> {
  const snap = await getDocs(collection(db, BROKEN_LINKS_COL));
  const map: Record<string, BrokenLinkResolution> = {};
  snap.forEach((d) => {
    const data = d.data();
    map[String(data.url)] = (data.resolution as BrokenLinkResolution) || 'open';
  });
  return map;
}

export async function saveBrokenLinkResolution(
  url: string,
  hits: number,
  resolution: BrokenLinkResolution,
): Promise<void> {
  const id = encodeURIComponent(url).slice(0, 500);
  await setDoc(
    doc(db, BROKEN_LINKS_COL, id),
    { url, hits, resolution, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadPageSpeedSnapshot(): Promise<PageSpeedRow[] | null> {
  const snap = await getDoc(doc(db, ...PAGESPEED_DOC.split('/')));
  if (!snap.exists()) return null;
  return (snap.data().pages as PageSpeedRow[]) ?? null;
}

export async function savePageSpeedSnapshot(pages: PageSpeedRow[]): Promise<void> {
  await setDoc(
    doc(db, ...PAGESPEED_DOC.split('/')),
    { pages, checkedAt: new Date().toISOString(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadRedirectChains(): Promise<RedirectChainRow[]> {
  const snap = await getDoc(doc(db, ...REDIRECTS_DOC.split('/')));
  if (!snap.exists()) return [];
  return (snap.data().chains as RedirectChainRow[]) ?? [];
}

export async function saveRedirectChains(chains: RedirectChainRow[]): Promise<void> {
  await setDoc(
    doc(db, ...REDIRECTS_DOC.split('/')),
    { chains, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

function pagespeedAlerts(row: Omit<PageSpeedRow, 'alerts' | 'checkedAt'>): string[] {
  const alerts: string[] = [];
  if (row.mobileScore != null && row.mobileScore < 70) alerts.push('Mobile score below 70');
  if (row.lcpSeconds != null && row.lcpSeconds > 2.5) alerts.push('LCP above 2.5s');
  if (row.cls != null && row.cls > 0.1) alerts.push('CLS above 0.1');
  if (row.inpMs != null && row.inpMs > 200) alerts.push('INP above 200ms');
  return alerts;
}

async function runPageSpeedForUrl(url: string, strategy: 'mobile' | 'desktop') {
  if (!PSI_KEY) return null;
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);
  endpoint.searchParams.set('category', 'performance');
  endpoint.searchParams.set('key', PSI_KEY);

  const res = await fetch(endpoint.toString());
  if (!res.ok) throw new Error(`PageSpeed ${strategy} failed for ${url}`);
  const data = await res.json();
  const audits = data.lighthouseResult?.audits ?? {};
  const score = data.lighthouseResult?.categories?.performance?.score;
  return {
    score: score != null ? Math.round(score * 100) : null,
    lcp: audits['largest-contentful-paint']?.numericValue != null
      ? audits['largest-contentful-paint'].numericValue / 1000
      : null,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    inp: audits['interaction-to-next-paint']?.numericValue
      ?? audits['experimental-interaction-to-next-paint']?.numericValue
      ?? null,
  };
}

export async function runPageSpeedChecks(urls: string[] = DEFAULT_PAGESPEED_URLS): Promise<PageSpeedRow[]> {
  if (!PSI_KEY) {
    throw new Error('Set VITE_PAGESPEED_API_KEY in production env to run automated PageSpeed checks.');
  }

  const checkedAt = new Date().toISOString();
  const pages: PageSpeedRow[] = [];

  for (const url of urls) {
    const [mobile, desktop] = await Promise.all([
      runPageSpeedForUrl(url, 'mobile'),
      runPageSpeedForUrl(url, 'desktop'),
    ]);

    const row: PageSpeedRow = {
      url,
      mobileScore: mobile?.score ?? null,
      desktopScore: desktop?.score ?? null,
      lcpSeconds: mobile?.lcp ?? desktop?.lcp ?? null,
      cls: mobile?.cls ?? desktop?.cls ?? null,
      inpMs: mobile?.inp ?? desktop?.inp ?? null,
      alerts: [],
      checkedAt,
    };
    row.alerts = pagespeedAlerts(row);
    pages.push(row);
  }

  await savePageSpeedSnapshot(pages);
  return pages;
}

export async function inspectGscUrls(token: string, urls: string[]): Promise<GscInspectionRow[]> {
  const siteUrl = GSC_PROPERTY;
  const rows: GscInspectionRow[] = [];

  for (const inspectionUrl of urls.slice(0, 6)) {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inspectionUrl, siteUrl }),
    });
    if (!res.ok) continue;
    const data = await res.json();
    const result = data.inspectionResult?.indexStatusResult ?? {};
    rows.push({
      url: inspectionUrl,
      verdict: String(result.verdict ?? 'UNKNOWN'),
      coverageState: String(result.coverageState ?? 'UNKNOWN'),
      indexingState: String(result.indexingState ?? 'UNKNOWN'),
    });
  }

  return rows;
}

export async function fetchGscSitemaps(token: string): Promise<Array<{ path: string; warnings: number; errors: number }>> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/sitemaps`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('Failed to load GSC sitemaps');
  const data = await res.json();
  return (data.sitemap ?? []).map((item: { path?: string; warnings?: number; errors?: number }) => ({
    path: String(item.path ?? ''),
    warnings: Number(item.warnings ?? 0),
    errors: Number(item.errors ?? 0),
  }));
}

export function mergeBrokenLinks(
  audit: AuditSnapshot | null,
  resolutions: Record<string, BrokenLinkResolution>,
): BrokenLinkRow[] {
  const urls = audit?.top_404_urls ?? [];
  if (urls.length === 0 && audit?.findings?.broken_urls) {
    return [{
      id: 'summary',
      url: '(Run seo-audit-upload.mjs on VPS for URL list)',
      hits: audit.findings.broken_urls,
      resolution: 'open',
    }];
  }
  return urls.map((row) => ({
    id: encodeURIComponent(row.url),
    url: row.url,
    hits: row.hits,
    resolution: resolutions[row.url] ?? 'open',
  }));
}

export function computeTechnicalHealthScore(
  audit: AuditSnapshot | null,
  pages: PageSpeedRow[] | null,
): number {
  let score = audit?.health_score ?? 0;
  if (pages?.length) {
    const failing = pages.filter((p) => p.alerts.length > 0).length;
    const cwvPenalty = Math.round((failing / pages.length) * 20);
    score = Math.max(0, score - cwvPenalty);
  }
  return score;
}

export { GSC_SCOPE, TOKEN_KEY, PSI_KEY };
