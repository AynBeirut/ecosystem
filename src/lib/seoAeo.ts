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
import { auth } from '@/lib/firebase';
import { getApiBaseUrl } from '@/lib/apiBase';
import { buildFaqSchema } from '@/lib/grabioBrandSchema';
import { listSeoContent, type SeoContentRecord } from '@/lib/seoContent';

export type AeoPlatform = 'chatgpt' | 'perplexity' | 'gemini' | 'other';

export type SeoAeoFaqRecord = {
  id: string;
  question: string;
  answer: string;
  assignedPageUrl: string;
  schemaAdded: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SeoAeoCitationRecord = {
  id: string;
  loggedDate: string;
  platform: AeoPlatform;
  queryUsed: string;
  citedUrl: string;
  notes: string;
  createdAt?: Timestamp;
};

export type SeoAeoSnippetRecord = {
  id: string;
  keyword: string;
  snippetHolder: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type AeoContentChecklist = {
  contentId: string;
  title: string;
  answerInFirstSentence: boolean;
  answerUnder50Words: boolean;
  answerWordCount: number;
  questionInH2: boolean;
};

export type SchemaBlockResult = {
  index: number;
  types: string[];
  valid: boolean;
  errors: string[];
  rawPreview: string;
};

export type SchemaValidationResult = {
  url: string;
  blockCount: number;
  blocks: SchemaBlockResult[];
};

const FAQS_COL = 'seo_aeo_faqs';
const CITATIONS_COL = 'seo_aeo_citations';
const SNIPPETS_COL = 'seo_aeo_snippets';

export const AEO_PLATFORMS: AeoPlatform[] = ['chatgpt', 'perplexity', 'gemini', 'other'];

export type SeoAeoFaqInput = Omit<SeoAeoFaqRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type SeoAeoCitationInput = Omit<SeoAeoCitationRecord, 'id' | 'createdAt'>;
export type SeoAeoSnippetInput = Omit<SeoAeoSnippetRecord, 'id' | 'createdAt' | 'updatedAt'>;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstSentence(text: string): string {
  const cleaned = stripHtml(text);
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  return match?.[0]?.trim() ?? cleaned.split(/\s+/).slice(0, 12).join(' ');
}

export function computeAeoChecklistFromHtml(faqHtml: string): Omit<AeoContentChecklist, 'contentId' | 'title'> {
  const h2Match = faqHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const questionInH2 = Boolean(h2Match);

  const answerMatch = faqHtml.match(/<h2[^>]*>[\s\S]*?<\/h2>\s*([\s\S]*?)(?=<h2|$)/i);
  const answerText = answerMatch ? stripHtml(answerMatch[1]) : stripHtml(faqHtml);
  const first = firstSentence(answerText);
  const answerWordCount = countWords(first);

  const answerInFirstSentence = answerText.trim().toLowerCase().startsWith(first.toLowerCase().slice(0, 20))
    || countWords(answerText) <= 55;

  return {
    answerInFirstSentence,
    answerUnder50Words: answerWordCount <= 50,
    answerWordCount,
    questionInH2,
  };
}

export async function loadAeoContentChecklists(): Promise<AeoContentChecklist[]> {
  const rows = await listSeoContent();
  return rows
    .filter((row) => row.draft?.faqHtml)
    .map((row) => {
      const checks = computeAeoChecklistFromHtml(row.draft?.faqHtml ?? '');
      return {
        contentId: row.id,
        title: row.title,
        ...checks,
      };
    });
}

export function buildAeoChecklistFromContent(row: SeoContentRecord): AeoContentChecklist | null {
  if (!row.draft?.faqHtml) return null;
  return {
    contentId: row.id,
    title: row.title,
    ...computeAeoChecklistFromHtml(row.draft.faqHtml),
  };
}

export async function listAeoFaqs(): Promise<SeoAeoFaqRecord[]> {
  const snap = await getDocs(collection(db, FAQS_COL));
  return snap.docs
    .map((d) => ({
      id: d.id,
      question: String(d.data().question ?? ''),
      answer: String(d.data().answer ?? ''),
      assignedPageUrl: String(d.data().assignedPageUrl ?? ''),
      schemaAdded: Boolean(d.data().schemaAdded),
      createdAt: d.data().createdAt as Timestamp | undefined,
      updatedAt: d.data().updatedAt as Timestamp | undefined,
    }))
    .sort((a, b) => a.question.localeCompare(b.question));
}

export async function createAeoFaq(input: SeoAeoFaqInput): Promise<void> {
  await addDoc(collection(db, FAQS_COL), {
    ...input,
    question: input.question.trim(),
    answer: input.answer.trim(),
    assignedPageUrl: input.assignedPageUrl.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAeoFaq(id: string, input: SeoAeoFaqInput): Promise<void> {
  await updateDoc(doc(db, FAQS_COL, id), {
    ...input,
    question: input.question.trim(),
    answer: input.answer.trim(),
    assignedPageUrl: input.assignedPageUrl.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAeoFaq(id: string): Promise<void> {
  await deleteDoc(doc(db, FAQS_COL, id));
}

export function generateFaqPageJsonLd(faqs: SeoAeoFaqRecord[]): string {
  return JSON.stringify(
    buildFaqSchema(faqs.map((f) => ({ question: f.question, answer: f.answer }))),
    null,
    2,
  );
}

export async function listAeoCitations(): Promise<SeoAeoCitationRecord[]> {
  const snap = await getDocs(collection(db, CITATIONS_COL));
  return snap.docs
    .map((d) => ({
      id: d.id,
      loggedDate: String(d.data().loggedDate ?? ''),
      platform: (String(d.data().platform ?? 'other') as AeoPlatform),
      queryUsed: String(d.data().queryUsed ?? ''),
      citedUrl: String(d.data().citedUrl ?? ''),
      notes: String(d.data().notes ?? ''),
      createdAt: d.data().createdAt as Timestamp | undefined,
    }))
    .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
}

export async function createAeoCitation(input: SeoAeoCitationInput): Promise<void> {
  await addDoc(collection(db, CITATIONS_COL), {
    ...input,
    queryUsed: input.queryUsed.trim(),
    citedUrl: input.citedUrl.trim(),
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteAeoCitation(id: string): Promise<void> {
  await deleteDoc(doc(db, CITATIONS_COL, id));
}

export async function listAeoSnippets(): Promise<SeoAeoSnippetRecord[]> {
  const snap = await getDocs(collection(db, SNIPPETS_COL));
  return snap.docs
    .map((d) => ({
      id: d.id,
      keyword: String(d.data().keyword ?? ''),
      snippetHolder: String(d.data().snippetHolder ?? ''),
      notes: String(d.data().notes ?? ''),
      createdAt: d.data().createdAt as Timestamp | undefined,
      updatedAt: d.data().updatedAt as Timestamp | undefined,
    }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
}

export async function createAeoSnippet(input: SeoAeoSnippetInput): Promise<void> {
  await addDoc(collection(db, SNIPPETS_COL), {
    ...input,
    keyword: input.keyword.trim(),
    snippetHolder: input.snippetHolder.trim(),
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAeoSnippet(id: string, input: SeoAeoSnippetInput): Promise<void> {
  await updateDoc(doc(db, SNIPPETS_COL, id), {
    ...input,
    keyword: input.keyword.trim(),
    snippetHolder: input.snippetHolder.trim(),
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAeoSnippet(id: string): Promise<void> {
  await deleteDoc(doc(db, SNIPPETS_COL, id));
}

export function extractJsonLdFromHtml(html: string): SchemaBlockResult[] {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: SchemaBlockResult[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    const errors: string[] = [];
    let types: string[] = [];
    let valid = true;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        types = (parsed['@graph'] as Array<Record<string, unknown>>)
          .map((node) => String(node['@type'] ?? 'Unknown'))
          .filter(Boolean);
      } else if (parsed['@type']) {
        types = [String(parsed['@type'])];
      } else {
        errors.push('Missing @type');
        valid = false;
      }
      if (!parsed['@context']) errors.push('Missing @context (recommended)');
    } catch {
      errors.push('Invalid JSON');
      valid = false;
    }

    blocks.push({
      index,
      types,
      valid: valid && errors.filter((e) => e.startsWith('Invalid')).length === 0,
      errors,
      rawPreview: raw.slice(0, 180) + (raw.length > 180 ? '…' : ''),
    });
    index += 1;
  }

  return blocks;
}

export async function validateStructuredDataUrl(url: string): Promise<SchemaValidationResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in required');

  const res = await fetch(`${getApiBaseUrl()}/seo/validate-schema`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: url.trim() }),
  });

  const data = (await res.json()) as {
    success: boolean;
    url?: string;
    blockCount?: number;
    blocks?: SchemaBlockResult[];
    message?: string;
  };

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Validation failed');
  }

  return {
    url: data.url ?? url,
    blockCount: data.blockCount ?? 0,
    blocks: data.blocks ?? [],
  };
}

export function aeoChecklistScore(row: AeoContentChecklist): number {
  const flags = [row.answerInFirstSentence, row.answerUnder50Words, row.questionInH2];
  return Math.round((flags.filter(Boolean).length / flags.length) * 100);
}
