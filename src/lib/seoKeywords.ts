import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GRABIO_SOLUTIONS } from '@/lib/grabioSolutions';

const GSC_PROPERTY = (import.meta.env.VITE_GSC_PROPERTY as string | undefined) || 'https://www.grabio.space/';
const GSC_RANKINGS_DOC = 'seo_technical/gsc_keyword_rankings';

export type SeoIntentStage = 'awareness' | 'consideration' | 'decision';
export type SeoKeywordStatus = 'active' | 'paused';
export type SeoKeywordOrigin = 'manual' | 'competitor' | 'seed' | 'gsc';

export type SeoKeywordRecord = {
  id: string;
  keyword: string;
  monthlyVolume: number;
  keywordDifficulty: number;
  assignedPageUrl: string;
  intentStage: SeoIntentStage;
  status: SeoKeywordStatus;
  keywordOrigin: SeoKeywordOrigin;
  rankingPosition: number | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SeoKeywordInput = Omit<SeoKeywordRecord, 'id' | 'createdAt' | 'updatedAt'>;

const COLLECTION = 'seo_keywords';

export const SEO_INTENT_STAGES: SeoIntentStage[] = ['awareness', 'consideration', 'decision'];
export const SEO_KEYWORD_STATUSES: SeoKeywordStatus[] = ['active', 'paused'];

export function isPriorityKeyword(row: Pick<SeoKeywordRecord, 'monthlyVolume' | 'keywordDifficulty'>): boolean {
  return row.keywordDifficulty < 40 && row.monthlyVolume >= 1000 && row.monthlyVolume <= 10000;
}

export function normalizeIntentStage(raw: string): SeoIntentStage {
  const value = raw.trim().toLowerCase();
  if (value.startsWith('dec')) return 'decision';
  if (value.startsWith('con')) return 'consideration';
  return 'awareness';
}

export function normalizeStatus(raw: string): SeoKeywordStatus {
  return raw.trim().toLowerCase() === 'paused' ? 'paused' : 'active';
}

export function normalizeKeywordOrigin(raw: string): SeoKeywordOrigin {
  const value = raw.trim().toLowerCase();
  if (value === 'competitor' || value === 'seed' || value === 'gsc') return value;
  return 'manual';
}

function parseNumber(raw: string | undefined, fallback = 0): number {
  const n = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseOptionalNumber(raw: string | undefined): number | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function mapDoc(id: string, data: Record<string, unknown>): SeoKeywordRecord {
  return {
    id,
    keyword: String(data.keyword ?? ''),
    monthlyVolume: parseNumber(String(data.monthlyVolume ?? 0)),
    keywordDifficulty: parseNumber(String(data.keywordDifficulty ?? 0)),
    assignedPageUrl: String(data.assignedPageUrl ?? ''),
    intentStage: normalizeIntentStage(String(data.intentStage ?? 'consideration')),
    status: normalizeStatus(String(data.status ?? 'active')),
    keywordOrigin: normalizeKeywordOrigin(String(data.keywordOrigin ?? 'manual')),
    rankingPosition:
      data.rankingPosition === null || data.rankingPosition === undefined
        ? null
        : parseNumber(String(data.rankingPosition)),
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

export async function listSeoKeywords(): Promise<SeoKeywordRecord[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => mapDoc(d.id, d.data())).sort((a, b) => a.keyword.localeCompare(b.keyword));
}

export async function createSeoKeyword(input: SeoKeywordInput): Promise<void> {
  await addDoc(collection(db, COLLECTION), {
    ...input,
    keywordOrigin: input.keywordOrigin ?? 'manual',
    keyword: input.keyword.trim(),
    assignedPageUrl: input.assignedPageUrl.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSeoKeyword(id: string, input: SeoKeywordInput): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...input,
    keyword: input.keyword.trim(),
    assignedPageUrl: input.assignedPageUrl.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSeoKeyword(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export type CsvImportResult = { imported: number; skipped: number; errors: string[] };

export function parseSeoKeywordCsv(text: string): { rows: SeoKeywordInput[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: ['CSV is empty'] };

  const header = lines[0].split(',').map((cell) => cell.trim().toLowerCase());
  const hasHeader = header.some((cell) => cell.includes('keyword') || cell.includes('volume'));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const idx = (names: string[]) => names.map((name) => header.indexOf(name)).find((i) => i >= 0) ?? -1;

  const keywordIdx = hasHeader ? idx(['keyword', 'keywords']) : 0;
  const volumeIdx = hasHeader ? idx(['volume', 'monthly_volume', 'monthly volume', 'search_volume']) : 1;
  const kdIdx = hasHeader ? idx(['kd', 'keyword_difficulty', 'difficulty']) : 2;
  const urlIdx = hasHeader ? idx(['page_url', 'url', 'assigned_page_url', 'page']) : 3;
  const intentIdx = hasHeader ? idx(['intent', 'intent_stage', 'stage']) : 4;
  const statusIdx = hasHeader ? idx(['status']) : 5;
  const rankIdx = hasHeader ? idx(['ranking', 'ranking_position', 'position']) : 6;

  const rows: SeoKeywordInput[] = [];
  const errors: string[] = [];

  dataLines.forEach((line, lineNo) => {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const keyword = hasHeader ? cells[keywordIdx] ?? '' : cells[0] ?? '';
    if (!keyword) {
      errors.push(`Line ${lineNo + (hasHeader ? 2 : 1)}: missing keyword`);
      return;
    }

    rows.push({
      keyword,
      monthlyVolume: parseNumber(hasHeader ? cells[volumeIdx] : cells[1], 0),
      keywordDifficulty: parseNumber(hasHeader ? cells[kdIdx] : cells[2], 0),
      assignedPageUrl: hasHeader ? cells[urlIdx] ?? '' : cells[3] ?? '',
      intentStage: normalizeIntentStage(hasHeader ? cells[intentIdx] ?? 'consideration' : cells[4] ?? 'consideration'),
      status: normalizeStatus(hasHeader ? cells[statusIdx] ?? 'active' : cells[5] ?? 'active'),
      keywordOrigin: 'manual',
      rankingPosition: parseOptionalNumber(hasHeader ? cells[rankIdx] : cells[6]),
    });
  });

  return { rows, errors };
}

export async function importSeoKeywords(rows: SeoKeywordInput[]): Promise<CsvImportResult> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.keyword.trim()) {
      skipped += 1;
      continue;
    }
    try {
      await createSeoKeyword(row);
      imported += 1;
    } catch (err) {
      errors.push(`${row.keyword}: ${err instanceof Error ? err.message : 'import failed'}`);
    }
  }

  return { imported, skipped, errors };
}

export function buildSolutionKeywordSeeds(): SeoKeywordInput[] {
  const seeds: SeoKeywordInput[] = [];

  for (const solution of GRABIO_SOLUTIONS) {
    const pageUrl = `/solutions/${solution.slug}`;
    for (const keyword of solution.keywords) {
      seeds.push({
        keyword,
        monthlyVolume: 0,
        keywordDifficulty: 0,
        assignedPageUrl: pageUrl,
        intentStage: keyword.toLowerCase().includes('grabio') ? 'awareness' : 'consideration',
        status: 'active',
        keywordOrigin: 'seed',
        rankingPosition: null,
      });
    }
  }

  const extras: SeoKeywordInput[] = [
    {
      keyword: 'inventory management software Lebanon',
      monthlyVolume: 320,
      keywordDifficulty: 28,
      assignedPageUrl: '/solutions/inventory',
      intentStage: 'decision',
      status: 'active',
      keywordOrigin: 'seed',
      rankingPosition: null,
    },
    {
      keyword: 'general ledger software SMB',
      monthlyVolume: 880,
      keywordDifficulty: 35,
      assignedPageUrl: '/solutions/accounting',
      intentStage: 'decision',
      status: 'active',
      keywordOrigin: 'seed',
      rankingPosition: null,
    },
    {
      keyword: 'Windows POS inventory sync',
      monthlyVolume: 540,
      keywordDifficulty: 31,
      assignedPageUrl: '/solutions/pos',
      intentStage: 'consideration',
      status: 'active',
      keywordOrigin: 'seed',
      rankingPosition: null,
    },
  ];

  return [...seeds, ...extras];
}

export async function seedSolutionKeywords(skipExisting = true): Promise<CsvImportResult> {
  const existing = skipExisting ? await listSeoKeywords() : [];
  const existingSet = new Set(existing.map((row) => row.keyword.toLowerCase()));
  const toImport = buildSolutionKeywordSeeds().filter((row) => !existingSet.has(row.keyword.toLowerCase()));
  return importSeoKeywords(toImport);
}

export async function createCompetitorSuggestedKeyword(
  keyword: string,
  assignedPageUrl = '',
): Promise<void> {
  await createSeoKeyword({
    keyword,
    monthlyVolume: 0,
    keywordDifficulty: 0,
    assignedPageUrl,
    intentStage: 'consideration',
    status: 'active',
    keywordOrigin: 'competitor',
    rankingPosition: null,
  });
}

export function sortSeoKeywords(
  rows: SeoKeywordRecord[],
  sortKey: 'keyword' | 'monthlyVolume' | 'keywordDifficulty' | 'rankingPosition',
  direction: 'asc' | 'desc',
): SeoKeywordRecord[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === 'keyword') return a.keyword.localeCompare(b.keyword) * factor;
    const av = a[sortKey] ?? (sortKey === 'rankingPosition' ? 999 : 0);
    const bv = b[sortKey] ?? (sortKey === 'rankingPosition' ? 999 : 0);
    return (Number(av) - Number(bv)) * factor;
  });
}

function normalizeKeywordKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

type GscQueryRow = {
  keys?: string[];
  position?: number;
  clicks?: number;
  impressions?: number;
};

export type GscKeywordSyncResult = {
  synced: number;
  addedFromGsc: number;
  pagesFixed: number;
  unmatched: number;
  totalGscRows: number;
  periodDays: number;
  refreshedAt: string;
  startDate: string;
  endDate: string;
  topRanked: Array<{ keyword: string; position: number; clicks: number; impressions: number }>;
};

function suggestPageUrlForQuery(keyword: string): string {
  const k = keyword.toLowerCase();
  if (k.includes('grabio')) return '/';
  if (/\bpos\b|\bpo system|point of sale|pos machine|pos register|eftpos|pos business/.test(k)) {
    return '/solutions/pos';
  }
  if (k.includes('inventory') || k.includes('warehouse') || k.includes('stock')) {
    return '/solutions/inventory';
  }
  if (
    k.includes('accounting') ||
    k.includes('ledger') ||
    k.includes('vat') ||
    k.includes('billing') ||
    k.includes('invoic')
  ) {
    return '/solutions/accounting';
  }
  if (k.includes('manufacturing') || k.includes('erp') || k.includes('bom')) {
    return '/solutions/manufacturing';
  }
  if (k.includes('restaurant') || k.includes('kitchen') || k.includes('recipe')) {
    return '/solutions/restaurant';
  }
  if (k.includes('crm') || k.includes('sales team')) return '/solutions/crm-psa';
  return '/solutions/platform';
}

export { suggestPageUrlForQuery };

export type GscKeywordRankingsSnapshot = GscKeywordSyncResult & {
  rankings: Array<{ keyword: string; position: number; clicks: number; impressions: number }>;
};

async function queryGscByKeyword(
  token: string,
  startDate: string,
  endDate: string,
  rowLimit = 500,
): Promise<GscQueryRow[]> {
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
        dimensions: ['query'],
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
  const data = (await res.json()) as { rows?: GscQueryRow[] };
  return data.rows ?? [];
}

/** Pull GSC query positions and update matching rows in seo_keywords. */
export async function syncGscRankingsToKeywords(
  token: string,
  periodDays = 28,
): Promise<GscKeywordSyncResult> {
  const end = new Date();
  const start = new Date(end.getTime() - periodDays * 86400_000);
  const startDate = isoDate(start);
  const endDate = isoDate(end);

  const [gscRows, keywords] = await Promise.all([
    queryGscByKeyword(token, startDate, endDate),
    listSeoKeywords(),
  ]);

  const rankByQuery = new Map<string, { position: number; clicks: number; impressions: number }>();
  for (const row of gscRows) {
    const query = normalizeKeywordKey(row.keys?.[0] ?? '');
    if (!query) continue;
    rankByQuery.set(query, {
      position: Math.round(Number(row.position ?? 0) * 10) / 10,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
    });
  }

  let synced = 0;
  let addedFromGsc = 0;
  let pagesFixed = 0;
  const rankings: GscKeywordRankingsSnapshot['rankings'] = [];
  const existingKeys = new Set(keywords.map((row) => normalizeKeywordKey(row.keyword)));

  for (const row of keywords) {
    const match = rankByQuery.get(normalizeKeywordKey(row.keyword));
    const suggestedUrl = suggestPageUrlForQuery(row.keyword);
    const needsPageFix =
      row.rankingPosition != null || match != null
        ? row.assignedPageUrl !== suggestedUrl &&
          (row.keywordOrigin === 'gsc' || row.assignedPageUrl === '/solutions/platform' || !row.assignedPageUrl)
        : false;

    if (match) {
      await updateDoc(doc(db, COLLECTION, row.id), {
        rankingPosition: match.position,
        ...(needsPageFix ? { assignedPageUrl: suggestedUrl } : {}),
        updatedAt: serverTimestamp(),
      });
      if (needsPageFix) pagesFixed += 1;
      synced += 1;
      rankings.push({
        keyword: row.keyword,
        position: match.position,
        clicks: match.clicks,
        impressions: match.impressions,
      });
      continue;
    }

    if (needsPageFix && row.rankingPosition != null) {
      await updateDoc(doc(db, COLLECTION, row.id), {
        assignedPageUrl: suggestedUrl,
        updatedAt: serverTimestamp(),
      });
      pagesFixed += 1;
    }
  }

  const topGscRows = [...gscRows]
    .filter((row) => row.keys?.[0])
    .sort((a, b) => Number(b.impressions ?? 0) - Number(a.impressions ?? 0))
    .slice(0, 40);

  for (const row of topGscRows) {
    const keyword = String(row.keys?.[0] ?? '').trim();
    const key = normalizeKeywordKey(keyword);
    if (!key || existingKeys.has(key)) continue;

    const position = Math.round(Number(row.position ?? 0) * 10) / 10;
    const docId = key.replace(/[^a-z0-9]+/g, '-').slice(0, 120);
    await setDoc(doc(db, COLLECTION, docId), {
      keyword,
      monthlyVolume: 0,
      keywordDifficulty: 0,
      assignedPageUrl: suggestPageUrlForQuery(keyword),
      intentStage: keyword.toLowerCase().includes('grabio') ? 'awareness' : 'consideration',
      status: 'active',
      keywordOrigin: 'gsc',
      rankingPosition: position,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    existingKeys.add(key);
    addedFromGsc += 1;
    rankings.push({
      keyword,
      position,
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
    });
  }

  const topRanked = rankings
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const result: GscKeywordSyncResult = {
    synced,
    addedFromGsc,
    pagesFixed,
    unmatched: keywords.length - synced,
    totalGscRows: gscRows.length,
    periodDays,
    refreshedAt: new Date().toISOString(),
    startDate,
    endDate,
    topRanked,
  };

  await setDoc(
    doc(db, ...GSC_RANKINGS_DOC.split('/')),
    { ...result, rankings, updatedAt: serverTimestamp() },
    { merge: false },
  );

  return result;
}

export async function loadGscKeywordRankingsSnapshot(): Promise<GscKeywordRankingsSnapshot | null> {
  const snap = await getDoc(doc(db, ...GSC_RANKINGS_DOC.split('/')));
  if (!snap.exists()) return null;
  return snap.data() as GscKeywordRankingsSnapshot;
}

export function buildBlogClusterKeywordSeeds(): SeoKeywordInput[] {
  const blogSeeds: Array<{ keyword: string; pageUrl: string }> = [
    { keyword: 'inventory management software Lebanon', pageUrl: '/blog/multi-location-inventory-lebanon' },
    { keyword: 'multi-location stock', pageUrl: '/blog/multi-location-inventory-lebanon' },
    { keyword: 'weighted average inventory costing', pageUrl: '/blog/weighted-average-inventory-costing' },
    { keyword: 'purchase order workflow software', pageUrl: '/blog/purchase-order-workflow-software' },
    { keyword: 'low stock alert system', pageUrl: '/blog/low-stock-alert-system' },
    { keyword: 'pos inventory sync', pageUrl: '/blog/pos-inventory-sync-windows' },
    { keyword: 'Lebanese PCG chart of accounts', pageUrl: '/blog/lebanese-pcg-chart-of-accounts' },
    { keyword: 'general ledger software small business', pageUrl: '/blog/general-ledger-software-small-business' },
    { keyword: 'accounts payable aging report', pageUrl: '/blog/accounts-payable-aging-report' },
    { keyword: 'bank reconciliation software', pageUrl: '/blog/bank-reconciliation-software-lebanon' },
    { keyword: 'VAT filing Lebanon small business', pageUrl: '/blog/vat-filing-lebanon-small-business' },
    { keyword: 'restaurant inventory software', pageUrl: '/blog/restaurant-recipe-costing-lebanon' },
    { keyword: 'recipe costing POS', pageUrl: '/blog/restaurant-recipe-costing-lebanon' },
    { keyword: 'cloud kitchen software', pageUrl: '/blog/restaurant-recipe-costing-lebanon' },
    { keyword: 'manufacturing software SMB', pageUrl: '/blog/manufacturing-bom-tracking-lebanon' },
    { keyword: 'BOM production tracking', pageUrl: '/blog/manufacturing-bom-tracking-lebanon' },
    { keyword: 'factory inventory software', pageUrl: '/blog/manufacturing-bom-tracking-lebanon' },
  ];

  return blogSeeds.map((row) => ({
    keyword: row.keyword,
    monthlyVolume: 0,
    keywordDifficulty: 0,
    assignedPageUrl: row.pageUrl,
    intentStage: 'consideration' as SeoIntentStage,
    status: 'active' as SeoKeywordStatus,
    keywordOrigin: 'seed' as SeoKeywordOrigin,
    rankingPosition: null,
  }));
}

export async function seedBlogClusterKeywords(skipExisting = true): Promise<CsvImportResult> {
  const existing = skipExisting ? await listSeoKeywords() : [];
  const existingSet = new Set(existing.map((row) => normalizeKeywordKey(row.keyword)));
  const toImport = buildBlogClusterKeywordSeeds().filter(
    (row) => !existingSet.has(normalizeKeywordKey(row.keyword)),
  );
  return importSeoKeywords(toImport);
}
