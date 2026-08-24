import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DEFAULT_PAGESPEED_URLS,
  fetchGscSitemaps,
  getGscToken,
  resolveGscToken,
  inspectGscUrls,
  loadPageSpeedSnapshot,
  type PageSpeedRow,
} from '@/lib/seoTechnical';

const CANONICAL_DOC = 'seo_technical/canonical_health';
const GSC_PROPERTY = import.meta.env.VITE_GSC_PROPERTY as string || 'https://www.grabio.space/';
const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined) || 'G-YSSWDNYTSW';

export type CanonicalHealthSnapshot = {
  refreshedAt: string;
  source: 'gsc_ga4';
  healthScore: number;
  gsc: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    periodDays: number;
    startDate: string;
    endDate: string;
    sitemapErrors: number;
    sitemapWarnings: number;
    indexingIssues: number;
  };
  ga4: {
    measurementId: string | null;
    organicSessions: number;
    pageViews: number;
    periodDays: number;
  };
  pagespeed: {
    cwvAlerts: number;
    pagesChecked: number;
  };
};

type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function dateRange(daysBack: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 86400_000);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

async function queryGscSearchAnalytics(
  token: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = [],
  rowLimit = 1,
): Promise<GscRow[]> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit,
        startRow: 0,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message || `GSC API error ${res.status}`,
    );
  }
  const data = (await res.json()) as { rows?: GscRow[] };
  return data.rows ?? [];
}

async function fetchGa4MarketingStats(daysBack: number): Promise<{ organicSessions: number; pageViews: number }> {
  const { startDate, endDate } = dateRange(daysBack);
  const startTs = Timestamp.fromDate(new Date(`${startDate}T00:00:00Z`));
  const endTs = Timestamp.fromDate(new Date(`${endDate}T23:59:59Z`));

  const snap = await getDocs(
    query(
      collection(db, 'seo_events'),
      where('created_at', '>=', startTs),
      where('created_at', '<=', endTs),
      limit(10000),
    ),
  );

  const organicSessions = new Set<string>();
  let pageViews = 0;

  snap.forEach((row) => {
    const data = row.data();
    if (data.event_name !== 'page_view') return;
    pageViews += 1;
    if (String(data.source ?? '') === 'organic' && data.session_id) {
      organicSessions.add(String(data.session_id));
    }
  });

  return { organicSessions: organicSessions.size, pageViews };
}

export function computeCanonicalHealthScore(input: {
  gscClicks: number;
  gscImpressions: number;
  gscCtr: number;
  gscPosition: number;
  sitemapErrors: number;
  indexingIssues: number;
  cwvAlerts: number;
  pagesChecked: number;
}): number {
  let score = 100;
  score -= Math.min(35, input.sitemapErrors * 12);
  score -= Math.min(25, input.indexingIssues * 8);
  if (input.pagesChecked > 0) {
    score -= Math.round((input.cwvAlerts / input.pagesChecked) * 25);
  }
  if (input.gscImpressions > 100 && input.gscCtr < 0.01) score -= 5;
  if (input.gscPosition > 50) score -= 12;
  else if (input.gscPosition > 30) score -= 6;
  if (input.gscClicks === 0 && input.gscImpressions === 0) score = Math.min(score, 55);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function loadCanonicalHealthSnapshot(): Promise<CanonicalHealthSnapshot | null> {
  const snap = await getDoc(doc(db, ...CANONICAL_DOC.split('/')));
  if (!snap.exists()) return null;
  return snap.data() as CanonicalHealthSnapshot;
}

export async function refreshCanonicalHealth(
  token: string,
  periodDays = 28,
  pages: PageSpeedRow[] | null = null,
): Promise<CanonicalHealthSnapshot> {
  const { startDate, endDate } = dateRange(periodDays);
  const psiPages = pages ?? (await loadPageSpeedSnapshot());
  const cwvAlerts = (psiPages ?? []).filter((p) => p.alerts.length > 0).length;

  const [gscTotals, sitemaps, inspections, ga4] = await Promise.all([
    queryGscSearchAnalytics(token, startDate, endDate, [], 1),
    fetchGscSitemaps(token),
    inspectGscUrls(token, DEFAULT_PAGESPEED_URLS),
    fetchGa4MarketingStats(periodDays),
  ]);

  const total = gscTotals[0] ?? {};
  const clicks = Number(total.clicks ?? 0);
  const impressions = Number(total.impressions ?? 0);
  const ctr = Number(total.ctr ?? 0);
  const position = Number(total.position ?? 0);
  const sitemapErrors = sitemaps.reduce((sum, row) => sum + row.errors, 0);
  const sitemapWarnings = sitemaps.reduce((sum, row) => sum + row.warnings, 0);
  const indexingIssues = inspections.filter((row) => row.verdict !== 'PASS').length;

  const healthScore = computeCanonicalHealthScore({
    gscClicks: clicks,
    gscImpressions: impressions,
    gscCtr: ctr,
    gscPosition: position,
    sitemapErrors,
    indexingIssues,
    cwvAlerts,
    pagesChecked: psiPages?.length ?? 0,
  });

  const snapshot: CanonicalHealthSnapshot = {
    refreshedAt: new Date().toISOString(),
    source: 'gsc_ga4',
    healthScore,
    gsc: {
      clicks,
      impressions,
      ctr,
      position,
      periodDays,
      startDate,
      endDate,
      sitemapErrors,
      sitemapWarnings,
      indexingIssues,
    },
    ga4: {
      measurementId: GA4_ID || null,
      organicSessions: ga4.organicSessions,
      pageViews: ga4.pageViews,
      periodDays,
    },
    pagespeed: {
      cwvAlerts,
      pagesChecked: psiPages?.length ?? 0,
    },
  };

  await setDoc(
    doc(db, ...CANONICAL_DOC.split('/')),
    { ...snapshot, updatedAt: serverTimestamp() },
    { merge: false },
  );

  return snapshot;
}

export function getCanonicalHealthToken(): Promise<string | null> {
  return resolveGscToken();
}

export { GSC_PROPERTY, GA4_ID };
