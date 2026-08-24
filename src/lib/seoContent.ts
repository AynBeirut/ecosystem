import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GRABIO_SOLUTIONS } from '@/lib/grabioSolutions';
import { auth } from '@/lib/firebase';
import { getApiBaseUrl } from '@/lib/apiBase';
import type { SeoIntentStage } from '@/lib/seoKeywords';

export type SeoContentType = 'blog' | 'guide' | 'landing' | 'faq';
export type SeoContentStatus = 'idea' | 'draft' | 'review' | 'published';

export type SeoContentChecklist = {
  hasH1: boolean;
  hasMetaTitle: boolean;
  hasMetaDescription: boolean;
  wordCount: number;
  internalLinksCount: number;
  schemaType: string;
  intentStageMatch: boolean;
};

export type SeoContentDraft = {
  h1: string;
  metaTitle: string;
  metaDescription: string;
  bodyHtml: string;
  faqHtml: string;
  suggestedInternalLinks: string[];
  schemaType: string;
  rawMarkdown: string;
};

export type SeoContentRecord = {
  id: string;
  title: string;
  targetKeywordId: string | null;
  targetKeyword: string;
  contentType: SeoContentType;
  intentStage: SeoIntentStage;
  status: SeoContentStatus;
  publishDate: string | null;
  assignedUrl: string;
  pillarSlug: string | null;
  checklist: SeoContentChecklist;
  draft: SeoContentDraft | null;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SeoContentInput = Omit<SeoContentRecord, 'id' | 'createdAt' | 'updatedAt'>;

const COLLECTION = 'seo_content';

export const SEO_CONTENT_TYPES: SeoContentType[] = ['blog', 'guide', 'landing', 'faq'];
export const SEO_CONTENT_STATUSES: SeoContentStatus[] = ['idea', 'draft', 'review', 'published'];

const EMPTY_CHECKLIST: SeoContentChecklist = {
  hasH1: false,
  hasMetaTitle: false,
  hasMetaDescription: false,
  wordCount: 0,
  internalLinksCount: 0,
  schemaType: '',
  intentStageMatch: false,
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countInternalLinks(html: string): number {
  const matches = html.match(/href=["']\/[^"']*["']/gi);
  return matches?.length ?? 0;
}

export function computeChecklist(
  draft: SeoContentDraft | null,
  intentStage: SeoIntentStage,
): SeoContentChecklist {
  if (!draft) return { ...EMPTY_CHECKLIST, intentStageMatch: true };

  const bodyText = stripHtml(`${draft.bodyHtml} ${draft.faqHtml}`);
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  return {
    hasH1: Boolean(draft.h1.trim()),
    hasMetaTitle: draft.metaTitle.trim().length >= 30 && draft.metaTitle.trim().length <= 65,
    hasMetaDescription: draft.metaDescription.trim().length >= 120 && draft.metaDescription.trim().length <= 165,
    wordCount,
    internalLinksCount: countInternalLinks(`${draft.bodyHtml} ${draft.faqHtml}`),
    schemaType: draft.schemaType.trim(),
    intentStageMatch: true,
  };
}

function mapDoc(id: string, data: Record<string, unknown>): SeoContentRecord {
  const draft = data.draft as SeoContentDraft | null | undefined;
  const intentStage = String(data.intentStage ?? 'consideration') as SeoIntentStage;
  return {
    id,
    title: String(data.title ?? ''),
    targetKeywordId: data.targetKeywordId ? String(data.targetKeywordId) : null,
    targetKeyword: String(data.targetKeyword ?? ''),
    contentType: (String(data.contentType ?? 'blog') as SeoContentType),
    intentStage,
    status: (String(data.status ?? 'idea') as SeoContentStatus),
    publishDate: data.publishDate ? String(data.publishDate) : null,
    assignedUrl: String(data.assignedUrl ?? ''),
    pillarSlug: data.pillarSlug ? String(data.pillarSlug) : null,
    checklist: draft
      ? computeChecklist(draft, intentStage)
      : ((data.checklist as SeoContentChecklist) ?? EMPTY_CHECKLIST),
    draft: draft ?? null,
    notes: String(data.notes ?? ''),
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

export async function listSeoContent(): Promise<SeoContentRecord[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((d) => mapDoc(d.id, d.data()))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function createSeoContent(input: SeoContentInput): Promise<string> {
  const checklist = computeChecklist(input.draft, input.intentStage);
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    title: input.title.trim(),
    targetKeyword: input.targetKeyword.trim(),
    assignedUrl: input.assignedUrl.trim(),
    checklist,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSeoContent(id: string, input: SeoContentInput): Promise<void> {
  const checklist = computeChecklist(input.draft, input.intentStage);
  await updateDoc(doc(db, COLLECTION, id), {
    ...input,
    title: input.title.trim(),
    targetKeyword: input.targetKeyword.trim(),
    assignedUrl: input.assignedUrl.trim(),
    checklist,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSeoContent(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export type PillarClusterSummary = {
  slug: string;
  title: string;
  pillarUrl: string;
  clusterItems: SeoContentRecord[];
  clusterCount: number;
  needsMore: boolean;
};

export function buildPillarClusterMap(rows: SeoContentRecord[]): PillarClusterSummary[] {
  return GRABIO_SOLUTIONS.map((pillar) => {
    const clusterItems = rows.filter(
      (row) =>
        row.pillarSlug === pillar.slug &&
        ['blog', 'guide', 'faq'].includes(row.contentType),
    );

    return {
      slug: pillar.slug,
      title: pillar.shortTitle,
      pillarUrl: `/solutions/${pillar.slug}`,
      clusterItems,
      clusterCount: clusterItems.length,
      needsMore: clusterItems.length < 5,
    };
  });
}

export function buildSeoDraftPrompt(item: Pick<
  SeoContentInput,
  'title' | 'targetKeyword' | 'contentType' | 'intentStage' | 'assignedUrl' | 'pillarSlug' | 'notes'
>): string {
  const pillar = GRABIO_SOLUTIONS.find((p) => p.slug === item.pillarSlug);
  const ctaBlock =
    item.intentStage === 'decision'
      ? '\nInclude a decision-stage CTA section with lead capture (demo request / contact form mention).'
      : '';

  return `You are an SEO content strategist for Grabio (grabio.space) — cloud software for inventory, accounting, POS, CRM, restaurant, and manufacturing SMBs in Lebanon and MENA.

Write structured SEO content for:
- Title: ${item.title}
- Target keyword: ${item.targetKeyword || '(assign a keyword)'}
- Content type: ${item.contentType}
- Intent stage: ${item.intentStage}
- Assigned URL: ${item.assignedUrl || '(TBD)'}
- Pillar topic: ${pillar?.title ?? item.pillarSlug ?? 'general Grabio software'}
- Notes: ${item.notes || 'none'}
${ctaBlock}

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "h1": "...",
  "metaTitle": "...",
  "metaDescription": "...",
  "bodyHtml": "<section>...</section>",
  "faqHtml": "<section><h2>FAQ</h2>...</section>",
  "suggestedInternalLinks": ["/solutions/accounting", "..."],
  "schemaType": "Article|FAQPage|HowTo",
  "rawMarkdown": "full markdown version"
}

Rules:
- H1 must include the target keyword naturally
- 3-5 H2 sections in bodyHtml with practical Grabio-specific detail (no fluff)
- FAQ: 3 questions minimum
- Suggest 3-6 internal links to /solutions/* pages
- metaTitle 50-60 chars, metaDescription 140-160 chars
- Do not invent fake statistics or client names`;
}

export function parseDraftResponse(raw: string): SeoContentDraft {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<SeoContentDraft>;
      return {
        h1: String(parsed.h1 ?? ''),
        metaTitle: String(parsed.metaTitle ?? ''),
        metaDescription: String(parsed.metaDescription ?? ''),
        bodyHtml: String(parsed.bodyHtml ?? ''),
        faqHtml: String(parsed.faqHtml ?? ''),
        suggestedInternalLinks: Array.isArray(parsed.suggestedInternalLinks)
          ? parsed.suggestedInternalLinks.map(String)
          : [],
        schemaType: String(parsed.schemaType ?? 'Article'),
        rawMarkdown: String(parsed.rawMarkdown ?? trimmed),
      };
    } catch {
      /* fall through */
    }
  }

  return {
    h1: '',
    metaTitle: '',
    metaDescription: '',
    bodyHtml: `<div>${trimmed.replace(/\n/g, '<br/>')}</div>`,
    faqHtml: '',
    suggestedInternalLinks: [],
    schemaType: 'Article',
    rawMarkdown: trimmed,
  };
}

export async function generateSeoContentDraft(
  item: Pick<
    SeoContentInput,
    'title' | 'targetKeyword' | 'contentType' | 'intentStage' | 'assignedUrl' | 'pillarSlug' | 'notes'
  >,
): Promise<SeoContentDraft> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in required');

  const res = await fetch(`${getApiBaseUrl()}/seo/content-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt: buildSeoDraftPrompt(item) }),
  });

  const data = (await res.json()) as { success: boolean; content?: string; message?: string };
  if (!res.ok || !data.success || !data.content) {
    throw new Error(data.message || 'Draft generation failed');
  }

  return parseDraftResponse(data.content);
}

/** Phase 3 — generate drafts for inventory + accounting ideas without a draft yet. */
export async function generateSeoContentPhase3Batch(
  onProgress?: (current: number, total: number, title: string) => void,
): Promise<{ generated: number; failed: string[] }> {
  const rows = await listSeoContent();
  const targets = rows.filter((row) => row.status === 'idea' && !row.draft);

  const failed: string[] = [];
  let generated = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const row = targets[i];
    onProgress?.(i + 1, targets.length, row.title);
    try {
      const draft = await generateSeoContentDraft(row);
      const checklist = computeChecklist(draft, row.intentStage);
      const score = checklistScore(checklist);
      await updateSeoContent(row.id, {
        title: row.title,
        targetKeywordId: row.targetKeywordId,
        targetKeyword: row.targetKeyword,
        contentType: row.contentType,
        intentStage: row.intentStage,
        status: score >= 70 ? 'review' : 'draft',
        publishDate: row.publishDate,
        assignedUrl: row.assignedUrl,
        pillarSlug: row.pillarSlug,
        checklist,
        draft,
        notes: row.notes,
      });
      generated += 1;
    } catch (err) {
      failed.push(row.title);
    }
  }

  return { generated, failed };
}

export function draftToHtml(draft: SeoContentDraft): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${draft.metaTitle}</title>
  <meta name="description" content="${draft.metaDescription}" />
</head>
<body>
  <h1>${draft.h1}</h1>
  ${draft.bodyHtml}
  ${draft.faqHtml}
</body>
</html>`;
}

export function checklistScore(checklist: SeoContentChecklist): number {
  const flags = [
    checklist.hasH1,
    checklist.hasMetaTitle,
    checklist.hasMetaDescription,
    checklist.wordCount >= 800,
    checklist.internalLinksCount >= 3,
    Boolean(checklist.schemaType),
    checklist.intentStageMatch,
  ];
  return Math.round((flags.filter(Boolean).length / flags.length) * 100);
}

export function sortSeoContent(
  rows: SeoContentRecord[],
  sortKey: 'title' | 'status' | 'publishDate' | 'contentType',
  direction: 'asc' | 'desc',
): SeoContentRecord[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === 'title') return a.title.localeCompare(b.title) * factor;
    if (sortKey === 'status') return a.status.localeCompare(b.status) * factor;
    if (sortKey === 'contentType') return a.contentType.localeCompare(b.contentType) * factor;
    const av = a.publishDate ?? '';
    const bv = b.publishDate ?? '';
    return av.localeCompare(bv) * factor;
  });
}
