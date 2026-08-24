import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { listSeoKeywords, type SeoIntentStage, type SeoKeywordRecord } from '@/lib/seoKeywords';
import { listSeoContent, type SeoContentRecord } from '@/lib/seoContent';
import { loadAuditSnapshot, loadPageSpeedSnapshot, type PageSpeedRow } from '@/lib/seoTechnical';
import { loadCanonicalHealthSnapshot } from '@/lib/seoCanonicalHealth';

const SETTINGS_DOC = 'seo_reporting/settings';

export type KeywordRankingSummary = {
  totalTracked: number;
  withRank: number;
  top3: number;
  top10: number;
  top20: number;
  unranked: number;
};

export type IntentBreakdown = Record<SeoIntentStage, number>;

export type ContentPipelineSummary = {
  publishedThisMonth: number;
  inDraft: number;
  inReview: number;
  idea: number;
  total: number;
};

export type TechnicalHealthSummary = {
  healthScore: number;
  healthSource: 'gsc_ga4' | 'vps_stub' | 'none';
  broken404: number;
  sitemapErrors?: number;
  indexingIssues?: number;
  gscClicks?: number;
  gscImpressions?: number;
  gscCtr?: number;
  gscPosition?: number;
  ga4OrganicSessions?: number;
  ga4PageViews?: number;
  cwvAlerts: number;
  pagesChecked: number;
  lastAuditAt: string | null;
  lastPageSpeedAt: string | null;
  pages: PageSpeedRow[];
};

export type MoMPoint = {
  label: string;
  organicSessions: number;
  target: number;
};

export type SeoReportSnapshot = {
  keywordSummary: KeywordRankingSummary;
  intentBreakdown: IntentBreakdown;
  contentPipeline: ContentPipelineSummary;
  technicalHealth: TechnicalHealthSummary;
  momTrend: MoMPoint[];
  topKeywords: SeoKeywordRecord[];
  monthlyOrganicTarget: number;
};

export type ReportingSettings = {
  monthlyOrganicTarget: number;
};

const DEFAULT_SETTINGS: ReportingSettings = {
  monthlyOrganicTarget: 500,
};

export function summarizeKeywordRankings(rows: SeoKeywordRecord[]): KeywordRankingSummary {
  const active = rows.filter((r) => r.status === 'active');
  const withRank = active.filter((r) => r.rankingPosition != null && r.rankingPosition > 0);
  return {
    totalTracked: active.length,
    withRank: withRank.length,
    top3: withRank.filter((r) => (r.rankingPosition ?? 999) <= 3).length,
    top10: withRank.filter((r) => (r.rankingPosition ?? 999) <= 10).length,
    top20: withRank.filter((r) => (r.rankingPosition ?? 999) <= 20).length,
    unranked: active.length - withRank.length,
  };
}

export function summarizeIntentBreakdown(rows: SeoKeywordRecord[]): IntentBreakdown {
  const active = rows.filter((r) => r.status === 'active');
  return {
    awareness: active.filter((r) => r.intentStage === 'awareness').length,
    consideration: active.filter((r) => r.intentStage === 'consideration').length,
    decision: active.filter((r) => r.intentStage === 'decision').length,
  };
}

export function summarizeContentPipeline(rows: SeoContentRecord[]): ContentPipelineSummary {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const publishedThisMonth = rows.filter((row) => {
    if (row.status !== 'published' || !row.publishDate) return false;
    const d = new Date(row.publishDate + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  return {
    publishedThisMonth,
    inDraft: rows.filter((r) => r.status === 'draft').length,
    inReview: rows.filter((r) => r.status === 'review').length,
    idea: rows.filter((r) => r.status === 'idea').length,
    total: rows.length,
  };
}

export async function summarizeTechnicalHealth(): Promise<TechnicalHealthSummary> {
  const [canonical, audit, pages] = await Promise.all([
    loadCanonicalHealthSnapshot(),
    loadAuditSnapshot(),
    loadPageSpeedSnapshot(),
  ]);
  const cwvAlerts = (pages ?? []).filter((p) => p.alerts.length > 0).length;

  if (canonical) {
    return {
      healthScore: canonical.healthScore,
      healthSource: 'gsc_ga4',
      broken404: canonical.gsc.sitemapErrors,
      sitemapErrors: canonical.gsc.sitemapErrors,
      indexingIssues: canonical.gsc.indexingIssues,
      gscClicks: canonical.gsc.clicks,
      gscImpressions: canonical.gsc.impressions,
      gscCtr: canonical.gsc.ctr,
      gscPosition: canonical.gsc.position,
      ga4OrganicSessions: canonical.ga4.organicSessions,
      ga4PageViews: canonical.ga4.pageViews,
      cwvAlerts,
      pagesChecked: pages?.length ?? 0,
      lastAuditAt: canonical.refreshedAt,
      lastPageSpeedAt: pages?.[0]?.checkedAt ?? null,
      pages: pages ?? [],
    };
  }

  const vhostStub = audit?.vhost_mode === 'redirect_stub';
  return {
    healthScore: audit?.health_score ?? 0,
    healthSource: audit ? (vhostStub ? 'vps_stub' : 'none') : 'none',
    broken404: audit?.findings?.broken_urls ?? 0,
    cwvAlerts,
    pagesChecked: pages?.length ?? 0,
    lastAuditAt: audit?.generated_at ?? null,
    lastPageSpeedAt: pages?.[0]?.checkedAt ?? null,
    pages: pages ?? [],
  };
}

export async function loadReportingSettings(): Promise<ReportingSettings> {
  const snap = await getDoc(doc(db, ...SETTINGS_DOC.split('/')));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const data = snap.data();
  const target = Number(data.monthlyOrganicTarget);
  return {
    monthlyOrganicTarget: Number.isFinite(target) && target > 0 ? target : DEFAULT_SETTINGS.monthlyOrganicTarget,
  };
}

export async function saveReportingSettings(settings: ReportingSettings): Promise<void> {
  await setDoc(
    doc(db, ...SETTINGS_DOC.split('/')),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function buildMoMTrend(
  organicByMonth: Record<string, number>,
  monthlyTarget: number,
  months = 6,
): MoMPoint[] {
  const points: MoMPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
    points.push({
      label,
      organicSessions: organicByMonth[key] ?? 0,
      target: monthlyTarget,
    });
  }

  return points;
}

export async function loadSeoReportSnapshot(
  organicByMonth: Record<string, number>,
): Promise<SeoReportSnapshot> {
  const [keywords, content, technical, settings] = await Promise.all([
    listSeoKeywords(),
    listSeoContent(),
    summarizeTechnicalHealth(),
    loadReportingSettings(),
  ]);

  const activeKeywords = keywords.filter((k) => k.status === 'active');
  const rankedKeywords = [...activeKeywords]
    .filter((k) => k.rankingPosition != null && k.rankingPosition > 0)
    .sort((a, b) => (a.rankingPosition ?? 999) - (b.rankingPosition ?? 999))
    .slice(0, 10);

  return {
    keywordSummary: summarizeKeywordRankings(keywords),
    intentBreakdown: summarizeIntentBreakdown(keywords),
    contentPipeline: summarizeContentPipeline(content),
    technicalHealth: technical,
    momTrend: buildMoMTrend(organicByMonth, settings.monthlyOrganicTarget),
    topKeywords: rankedKeywords,
    monthlyOrganicTarget: settings.monthlyOrganicTarget,
  };
}

export function buildPrintableReportHtml(input: {
  generatedAt: string;
  timeRangeLabel: string;
  totalViews: number;
  uniqueVisitors: number;
  totalLeads: number;
  topPages: Array<{ page: string; views: number }>;
  snapshot: SeoReportSnapshot;
}): string {
  const { snapshot: s } = input;
  const topKw = s.topKeywords
    .map((k) => `<tr><td>${k.keyword}</td><td>#${k.rankingPosition}</td><td>${k.intentStage}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Grabio SEO Report</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
  .card .label { font-size: 11px; color: #666; }
  .card .value { font-size: 20px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>Grabio SEO Monthly Summary</h1>
  <p class="meta">Generated ${input.generatedAt} · Period: ${input.timeRangeLabel}</p>

  <h2>Traffic summary</h2>
  <div class="grid">
    <div class="card"><div class="label">Page views</div><div class="value">${input.totalViews.toLocaleString()}</div></div>
    <div class="card"><div class="label">Unique visitors</div><div class="value">${input.uniqueVisitors.toLocaleString()}</div></div>
    <div class="card"><div class="label">Leads</div><div class="value">${input.totalLeads.toLocaleString()}</div></div>
    <div class="card"><div class="label">Health score</div><div class="value">${s.technicalHealth.healthScore}%</div></div>
  </div>

  <h2>Keyword rankings</h2>
  <div class="grid">
    <div class="card"><div class="label">Tracked</div><div class="value">${s.keywordSummary.totalTracked}</div></div>
    <div class="card"><div class="label">Top 3</div><div class="value">${s.keywordSummary.top3}</div></div>
    <div class="card"><div class="label">Top 10</div><div class="value">${s.keywordSummary.top10}</div></div>
    <div class="card"><div class="label">Top 20</div><div class="value">${s.keywordSummary.top20}</div></div>
  </div>
  <table><thead><tr><th>Keyword</th><th>Rank</th><th>Intent</th></tr></thead><tbody>${topKw || '<tr><td colspan="3">No ranked keywords yet</td></tr>'}</tbody></table>

  <h2>Content published</h2>
  <div class="grid">
    <div class="card"><div class="label">This month</div><div class="value">${s.contentPipeline.publishedThisMonth}</div></div>
    <div class="card"><div class="label">In draft</div><div class="value">${s.contentPipeline.inDraft}</div></div>
    <div class="card"><div class="label">In review</div><div class="value">${s.contentPipeline.inReview}</div></div>
    <div class="card"><div class="label">Broken 404s</div><div class="value">${s.technicalHealth.broken404.toLocaleString()}</div></div>
  </div>

  <h2>Top pages</h2>
  <table><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>
    ${input.topPages.slice(0, 8).map((p) => `<tr><td>${p.page}</td><td>${p.views.toLocaleString()}</td></tr>`).join('')}
  </tbody></table>
</body></html>`;
}

export function openPrintableReport(html: string): void {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export function aggregateOrganicByMonth(
  events: Array<{ source?: string; event_name?: string; created_at?: { toDate: () => Date } }>,
): Record<string, number> {
  const map: Record<string, number> = {};
  const sessionsByMonth: Record<string, Set<string>> = {};

  events.forEach((ev) => {
    if (ev.event_name !== 'page_view') return;
    if ((ev.source || 'direct') !== 'organic') return;
    if (!ev.created_at) return;
    const d = ev.created_at.toDate();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!sessionsByMonth[key]) sessionsByMonth[key] = new Set();
    const sessionId = (ev as { session_id?: string }).session_id;
    if (sessionId) sessionsByMonth[key].add(sessionId);
  });

  Object.entries(sessionsByMonth).forEach(([key, set]) => {
    map[key] = set.size;
  });

  return map;
}
