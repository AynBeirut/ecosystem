import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { getApiBaseUrl } from '@/lib/apiBase';
import { buildFaqSchema } from '@/lib/grabioBrandSchema';

export type ProgPageStatus = 'draft' | 'queued' | 'published' | 'dead';

export type ProgTemplate = {
  id: string;
  name: string;
  titlePattern: string;
  metaPattern: string;
  h1Pattern: string;
  bodyPattern: string;
  faqQuestionPattern: string;
  faqAnswerPattern: string;
  enabled: boolean;
};

export type ProgSeedData = {
  cities: string[];
  areas: string[];
  categories: string[];
  storeTypes: string[];
};

export type ProgSettings = {
  automationMode: boolean;
  monthlyPageTarget: number;
};

export type ProgVariables = {
  city: string;
  area: string;
  category: string;
  storeType: string;
};

export type ProgGeneratedPage = {
  slug: string;
  templateId: string;
  templateName: string;
  status: ProgPageStatus;
  variables: ProgVariables;
  title: string;
  metaDescription: string;
  h1: string;
  bodyHtml: string;
  faqHtml: string;
  faqSchema: Record<string, unknown>;
  canonicalUrl: string;
  publishedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  sessions60d?: number;
};

const TEMPLATES_COL = 'seo_prog_templates';
const SEEDS_DOC = 'seo_prog_seeds/default';
const SETTINGS_DOC = 'seo_prog_settings/default';
const PAGES_COL = 'seo_prog_pages';

export const PROG_PAGE_STATUSES: ProgPageStatus[] = ['draft', 'queued', 'published', 'dead'];

export const DEFAULT_SEEDS: ProgSeedData = {
  cities: ['Beirut', 'Tripoli', 'Sidon', 'Jounieh', 'Zahle'],
  areas: ['Hamra', 'Achrafieh', 'Downtown Beirut', 'Verdun', 'Dbayeh'],
  categories: ['Inventory management', 'POS', 'Accounting', 'Restaurant', 'Retail'],
  storeTypes: ['retail store', 'restaurant', 'wholesale business', 'manufacturing shop'],
};

export const DEFAULT_SETTINGS: ProgSettings = {
  automationMode: false,
  monthlyPageTarget: 20,
};

export const DEFAULT_TEMPLATES: Omit<ProgTemplate, 'id'>[] = [
  {
    name: 'Category stores in City',
    titlePattern: '{category} for {storeType} in {city} | Grabio',
    metaPattern:
      'Grabio {category} software for {storeType} businesses in {city}, Lebanon — inventory, POS, and accounting in one cloud platform.',
    h1Pattern: '{category} software for {storeType} in {city}',
    bodyPattern:
      '<p>{storeType} operators in {city} — including {area} — use Grabio for {category}, real-time stock, and financial reporting without juggling separate tools.</p><p>Start with modular plans from $5/month and scale into full ERP as you grow.</p>',
    faqQuestionPattern: 'What is the best {category} tool for {storeType} in {city}?',
    faqAnswerPattern:
      'Grabio combines {category}, POS, and general ledger accounting for {storeType} in {city} with mobile admin apps and Lebanese PCG-ready finance modules.',
    enabled: true,
  },
  {
    name: 'Product type near Area',
    titlePattern: '{category} near {area}, {city} | Grabio',
    metaPattern:
      'Cloud {category} platform for businesses near {area} in {city}. Grabio syncs web, POS, and mobile admin for {storeType}.',
    h1Pattern: '{category} near {area}',
    bodyPattern:
      '<p>Businesses near {area} in {city} choose Grabio when they need {category} tied to daily operations — not a standalone spreadsheet.</p>',
    faqQuestionPattern: 'Does Grabio support {category} for businesses in {area}?',
    faqAnswerPattern:
      'Yes. Grabio serves {storeType} near {area} with cloud {category}, multi-location stock, and integrated accounting.',
    enabled: true,
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function interpolate(pattern: string, vars: ProgVariables): string {
  return pattern
    .replace(/\{city\}/g, vars.city)
    .replace(/\{area\}/g, vars.area)
    .replace(/\{category\}/g, vars.category)
    .replace(/\{storeType\}/g, vars.storeType);
}

export function buildGeneratedPage(template: ProgTemplate, vars: ProgVariables): Omit<ProgGeneratedPage, 'createdAt' | 'updatedAt' | 'publishedAt' | 'sessions60d'> {
  const title = interpolate(template.titlePattern, vars);
  const slug = slugify(`${vars.category}-${vars.city}-${vars.area}`.replace(/\s+/g, '-'));
  const faqQ = interpolate(template.faqQuestionPattern, vars);
  const faqA = interpolate(template.faqAnswerPattern, vars);
  const faqs = [{ question: faqQ, answer: faqA }];
  const faqSchema = buildFaqSchema(faqs);

  return {
    slug,
    templateId: template.id,
    templateName: template.name,
    status: 'draft',
    variables: vars,
    title,
    metaDescription: interpolate(template.metaPattern, vars),
    h1: interpolate(template.h1Pattern, vars),
    bodyHtml: interpolate(template.bodyPattern, vars),
    faqHtml: `<section><h2>${faqQ}</h2><p>${faqA}</p></section>`,
    faqSchema,
    canonicalUrl: `https://grabio.space/pages/${slug}`,
  };
}

function mapTemplateDoc(d: QueryDocumentSnapshot): ProgTemplate {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name ?? ''),
    titlePattern: String(data.titlePattern ?? ''),
    metaPattern: String(data.metaPattern ?? ''),
    h1Pattern: String(data.h1Pattern ?? ''),
    bodyPattern: String(data.bodyPattern ?? ''),
    faqQuestionPattern: String(data.faqQuestionPattern ?? ''),
    faqAnswerPattern: String(data.faqAnswerPattern ?? ''),
    enabled: data.enabled !== false,
  };
}

function mapPageDoc(d: QueryDocumentSnapshot): ProgGeneratedPage {
  const data = d.data();
  return {
    slug: d.id,
    templateId: String(data.templateId ?? ''),
    templateName: String(data.templateName ?? ''),
    status: (String(data.status ?? 'draft') as ProgPageStatus),
    variables: (data.variables as ProgVariables) ?? { city: '', area: '', category: '', storeType: '' },
    title: String(data.title ?? ''),
    metaDescription: String(data.metaDescription ?? ''),
    h1: String(data.h1 ?? ''),
    bodyHtml: String(data.bodyHtml ?? ''),
    faqHtml: String(data.faqHtml ?? ''),
    faqSchema: (data.faqSchema as Record<string, unknown>) ?? {},
    canonicalUrl: String(data.canonicalUrl ?? ''),
    publishedAt: data.publishedAt as Timestamp | undefined,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
    sessions60d: data.sessions60d != null ? Number(data.sessions60d) : undefined,
  };
}

export async function listProgTemplates(): Promise<ProgTemplate[]> {
  const snap = await getDocs(collection(db, TEMPLATES_COL));
  return snap.docs.map(mapTemplateDoc).sort((a, b) => a.name.localeCompare(b.name));
}

export async function seedDefaultTemplatesIfEmpty(): Promise<void> {
  const existing = await listProgTemplates();
  if (existing.length > 0) return;
  for (const tpl of DEFAULT_TEMPLATES) {
    await addDoc(collection(db, TEMPLATES_COL), { ...tpl, createdAt: serverTimestamp() });
  }
}

export async function saveProgTemplate(id: string | null, input: Omit<ProgTemplate, 'id'>): Promise<void> {
  if (id) {
    await setDoc(doc(db, TEMPLATES_COL, id), { ...input, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await addDoc(collection(db, TEMPLATES_COL), { ...input, createdAt: serverTimestamp() });
  }
}

export async function deleteProgTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, TEMPLATES_COL, id));
}

export async function loadProgSeeds(): Promise<ProgSeedData> {
  const snap = await getDoc(doc(db, ...SEEDS_DOC.split('/')));
  if (!snap.exists()) return DEFAULT_SEEDS;
  const data = snap.data();
  return {
    cities: Array.isArray(data.cities) ? data.cities.map(String) : DEFAULT_SEEDS.cities,
    areas: Array.isArray(data.areas) ? data.areas.map(String) : DEFAULT_SEEDS.areas,
    categories: Array.isArray(data.categories) ? data.categories.map(String) : DEFAULT_SEEDS.categories,
    storeTypes: Array.isArray(data.storeTypes) ? data.storeTypes.map(String) : DEFAULT_SEEDS.storeTypes,
  };
}

export async function saveProgSeeds(seeds: ProgSeedData): Promise<void> {
  await setDoc(doc(db, ...SEEDS_DOC.split('/')), { ...seeds, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadProgSettings(): Promise<ProgSettings> {
  const snap = await getDoc(doc(db, ...SETTINGS_DOC.split('/')));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const data = snap.data();
  return {
    automationMode: Boolean(data.automationMode),
    monthlyPageTarget: Number(data.monthlyPageTarget) || DEFAULT_SETTINGS.monthlyPageTarget,
  };
}

export async function saveProgSettings(settings: ProgSettings): Promise<void> {
  await setDoc(doc(db, ...SETTINGS_DOC.split('/')), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function listProgPages(): Promise<ProgGeneratedPage[]> {
  const snap = await getDocs(collection(db, PAGES_COL));
  return snap.docs.map(mapPageDoc).sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPublishedProgPage(slug: string): Promise<ProgGeneratedPage | null> {
  const snap = await getDoc(doc(db, PAGES_COL, slug));
  if (!snap.exists()) return null;
  const page = mapPageDoc(snap as QueryDocumentSnapshot);
  if (page.status !== 'published') return null;
  return page;
}

export async function saveGeneratedPage(
  page: Omit<ProgGeneratedPage, 'createdAt' | 'updatedAt' | 'publishedAt' | 'sessions60d'>,
  statusOverride?: ProgPageStatus,
): Promise<{ slug: string; created: boolean }> {
  let slug = page.slug;
  let created = false;
  const existing = await getDoc(doc(db, PAGES_COL, slug));
  if (existing.exists() && existing.data()?.variables && JSON.stringify(existing.data()?.variables) !== JSON.stringify(page.variables)) {
    slug = `${slug}-${Date.now().toString(36)}`;
    created = true;
  } else if (!existing.exists()) {
    created = true;
  }

  const status = statusOverride ?? page.status;
  await setDoc(
    doc(db, PAGES_COL, slug),
    {
      ...page,
      slug,
      status,
      updatedAt: serverTimestamp(),
      ...(created ? { createdAt: serverTimestamp() } : {}),
      ...(status === 'published' ? { publishedAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );

  return { slug, created };
}

export type GenerateBatchOptions = {
  templateId: string;
  city: string;
  areas: string[];
  categories: string[];
  storeTypes: string[];
  maxPages?: number;
};

export async function generatePageBatch(options: GenerateBatchOptions): Promise<number> {
  const templates = await listProgTemplates();
  const template = templates.find((t) => t.id === options.templateId);
  if (!template) throw new Error('Template not found');

  const settings = await loadProgSettings();
  const max = options.maxPages ?? 24;
  let count = 0;

  for (const category of options.categories) {
    for (const storeType of options.storeTypes) {
      for (const area of options.areas) {
        if (count >= max) return count;
        const vars: ProgVariables = {
          city: options.city,
          area,
          category,
          storeType,
        };
        const built = buildGeneratedPage(template, vars);
        const status: ProgPageStatus = settings.automationMode ? 'published' : 'queued';
        await saveGeneratedPage(built, status);
        count += 1;
      }
    }
  }

  return count;
}

export async function updatePageStatus(slug: string, status: ProgPageStatus): Promise<void> {
  await setDoc(
    doc(db, PAGES_COL, slug),
    {
      status,
      updatedAt: serverTimestamp(),
      ...(status === 'published' ? { publishedAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );
}

export async function deleteProgPage(slug: string): Promise<void> {
  await deleteDoc(doc(db, PAGES_COL, slug));
}

export async function scanDeadProgPages(
  events: Array<{ page_path?: string; event_name?: string; created_at?: { toDate: () => Date } }>,
): Promise<ProgGeneratedPage[]> {
  const pages = (await listProgPages()).filter((p) => p.status === 'published');
  const cutoff = Date.now() - 60 * 86400 * 1000;
  const pathCounts: Record<string, number> = {};

  events.forEach((ev) => {
    if (ev.event_name !== 'page_view' || !ev.created_at || !ev.page_path?.startsWith('/pages/')) return;
    if (ev.created_at.toDate().getTime() < cutoff) return;
    pathCounts[ev.page_path] = (pathCounts[ev.page_path] ?? 0) + 1;
  });

  const dead: ProgGeneratedPage[] = [];
  for (const page of pages) {
    const path = `/pages/${page.slug}`;
    const sessions = pathCounts[path] ?? 0;
    await setDoc(doc(db, PAGES_COL, page.slug), { sessions60d: sessions }, { merge: true });
    if (sessions === 0) {
      await updatePageStatus(page.slug, 'dead');
      dead.push({ ...page, status: 'dead', sessions60d: 0 });
    }
  }

  return dead;
}

export function buildSitemapUrlList(pages: ProgGeneratedPage[]): string[] {
  return pages
    .filter((p) => p.status === 'published')
    .map((p) => p.canonicalUrl || `https://grabio.space/pages/${p.slug}`);
}

export function buildSitemapXmlSnippet(urls: string[]): string {
  const today = new Date().toISOString().split('T')[0];
  return urls
    .map(
      (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    )
    .join('\n');
}

export function countPublishedThisMonth(pages: ProgGeneratedPage[]): number {
  const now = new Date();
  return pages.filter((p) => {
    if (p.status !== 'published' || !p.publishedAt) return false;
    const d = p.publishedAt.toDate();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}

export async function loadSeoEventsForDeadScan(): Promise<Array<{ page_path?: string; event_name?: string; created_at?: { toDate: () => Date } }>> {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - 60 * 86400 * 1000));
  const snap = await getDocs(query(collection(db, 'seo_events'), where('created_at', '>=', cutoff)));
  return snap.docs.map((d) => d.data() as { page_path?: string; event_name?: string; created_at?: { toDate: () => Date } });
}

export type PlatformSitemapPingResult = {
  success: boolean;
  sitemapUrl?: string;
  submittedAt?: string;
  results?: Array<{ target: string; ok: boolean; status?: number; detail?: string }>;
  message?: string;
};

/** Ping Google + Bing with live https://grabio.space/sitemap.xml (platform admin). */
export async function pingPlatformSitemap(): Promise<PlatformSitemapPingResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return { success: false, message: 'Not signed in' };

  const res = await fetch(`${getApiBaseUrl()}/seo/platform/sitemap-ping`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const data = (await res.json()) as PlatformSitemapPingResult;
  if (!res.ok) {
    return { success: false, message: data.message || `HTTP ${res.status}` };
  }
  return data;
}
