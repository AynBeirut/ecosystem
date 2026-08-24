import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GRABIO_SOLUTIONS } from '@/lib/grabioSolutions';
import {
  fetchGscSitemaps,
  getGscToken,
  resolveGscToken,
  type GscInspectionRow,
} from '@/lib/seoTechnical';
import { listProgPages, pingPlatformSitemap, type PlatformSitemapPingResult } from '@/lib/seoProgrammatic';
import { refreshCanonicalHealth } from '@/lib/seoCanonicalHealth';

const PHASE2_DOC = 'seo_technical/gsc_phase2';
const GSC_PROPERTY = import.meta.env.VITE_GSC_PROPERTY as string || 'https://www.grabio.space/';
const SITEMAP_URL = 'https://grabio.space/sitemap.xml';

export type GscPhase2Snapshot = {
  ranAt: string;
  sitemapUrl: string;
  sitemapSubmitted: boolean;
  sitemapSubmitDetail?: string;
  sitemapPing?: PlatformSitemapPingResult;
  sitemaps: Array<{ path: string; warnings: number; errors: number }>;
  inspectUrls: string[];
  inspections: GscInspectionRow[];
  passCount: number;
  failCount: number;
};

export function getStaticPhase2Urls(): string[] {
  return [
    'https://grabio.space/',
    'https://grabio.space/solutions',
    ...GRABIO_SOLUTIONS.map((s) => `https://grabio.space/solutions/${s.slug}`),
  ];
}

export async function getPhase2InspectUrls(): Promise<string[]> {
  const pages = await listProgPages();
  const programmatic = pages
    .filter((p) => p.status === 'published')
    .map((p) => `https://grabio.space/pages/${p.slug}`);
  return [...getStaticPhase2Urls(), ...programmatic];
}

export async function submitGscSitemap(
  token: string,
  sitemapUrl = SITEMAP_URL,
): Promise<{ ok: boolean; detail: string }> {
  const siteEnc = encodeURIComponent(GSC_PROPERTY);
  const feedEnc = encodeURIComponent(sitemapUrl);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${siteEnc}/sitemaps/${feedEnc}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const body = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      detail: body.slice(0, 200) || `GSC sitemap submit HTTP ${res.status}`,
    };
  }
  return { ok: true, detail: 'Submitted to Search Console' };
}

async function inspectUrlsBatch(token: string, urls: string[]): Promise<GscInspectionRow[]> {
  const rows: GscInspectionRow[] = [];
  for (const inspectionUrl of urls) {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inspectionUrl, siteUrl: GSC_PROPERTY }),
    });
    if (res.ok) {
      const data = await res.json();
      const result = data.inspectionResult?.indexStatusResult ?? {};
      rows.push({
        url: inspectionUrl,
        verdict: String(result.verdict ?? 'UNKNOWN'),
        coverageState: String(result.coverageState ?? 'UNKNOWN'),
        indexingState: String(result.indexingState ?? 'UNKNOWN'),
      });
    } else {
      rows.push({
        url: inspectionUrl,
        verdict: 'ERROR',
        coverageState: `HTTP ${res.status}`,
        indexingState: '—',
      });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return rows;
}

export async function runGscPhase2(token?: string | null): Promise<GscPhase2Snapshot> {
  const authToken = token ?? (await resolveGscToken());
  if (!authToken) throw new Error('Connect Google Search Console on SEO Audit first.');

  const inspectUrls = await getPhase2InspectUrls();

  const [submit, sitemaps, inspections, ping] = await Promise.all([
    submitGscSitemap(authToken),
    fetchGscSitemaps(authToken),
    inspectUrlsBatch(authToken, inspectUrls),
    pingPlatformSitemap().catch(() => ({ success: false, message: 'Ping failed' } as PlatformSitemapPingResult)),
  ]);

  const passCount = inspections.filter((r) => r.verdict === 'PASS').length;
  const failCount = inspections.length - passCount;

  const snapshot: GscPhase2Snapshot = {
    ranAt: new Date().toISOString(),
    sitemapUrl: SITEMAP_URL,
    sitemapSubmitted: submit.ok,
    sitemapSubmitDetail: submit.detail,
    sitemapPing: ping,
    sitemaps,
    inspectUrls,
    inspections,
    passCount,
    failCount,
  };

  await setDoc(
    doc(db, ...PHASE2_DOC.split('/')),
    { ...snapshot, updatedAt: serverTimestamp() },
    { merge: false },
  );

  await refreshCanonicalHealth(authToken, 28);

  return snapshot;
}

export function getGscPhase2Token(): Promise<string | null> {
  return resolveGscToken();
}

export async function loadGscPhase2Snapshot(): Promise<GscPhase2Snapshot | null> {
  const snap = await getDoc(doc(db, ...PHASE2_DOC.split('/')));
  if (!snap.exists()) return null;
  return snap.data() as GscPhase2Snapshot;
}
