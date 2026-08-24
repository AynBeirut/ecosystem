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
import {
  createCompetitorSuggestedKeyword,
  listSeoKeywords,
} from '@/lib/seoKeywords';

export type GapStatus = 'new' | 'added' | 'rejected';

export type SeoCompetitorRecord = {
  id: string;
  domain: string;
  label: string;
  createdAt?: Timestamp;
};

export type SeoCompetitorGapRecord = {
  id: string;
  keyword: string;
  competitorId: string;
  competitorLabel: string;
  competitorDomain: string;
  status: GapStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const COMPETITORS_COL = 'seo_competitors';
const GAPS_COL = 'seo_competitor_gaps';

export const GAP_STATUSES: GapStatus[] = ['new', 'added', 'rejected'];

function normalizeKeyword(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseKeywordList(text: string): string[] {
  return text
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function listCompetitors(): Promise<SeoCompetitorRecord[]> {
  const snap = await getDocs(collection(db, COMPETITORS_COL));
  return snap.docs
    .map((d) => ({
      id: d.id,
      domain: String(d.data().domain ?? ''),
      label: String(d.data().label ?? ''),
      createdAt: d.data().createdAt as Timestamp | undefined,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function createCompetitor(domain: string, label: string): Promise<void> {
  await addDoc(collection(db, COMPETITORS_COL), {
    domain: domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    label: label.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteCompetitor(id: string): Promise<void> {
  await deleteDoc(doc(db, COMPETITORS_COL, id));
}

export async function listCompetitorGaps(): Promise<SeoCompetitorGapRecord[]> {
  const snap = await getDocs(collection(db, GAPS_COL));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        keyword: String(data.keyword ?? ''),
        competitorId: String(data.competitorId ?? ''),
        competitorLabel: String(data.competitorLabel ?? ''),
        competitorDomain: String(data.competitorDomain ?? ''),
        status: (String(data.status ?? 'new') as GapStatus),
        createdAt: data.createdAt as Timestamp | undefined,
        updatedAt: data.updatedAt as Timestamp | undefined,
      };
    })
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
}

export async function importCompetitorKeywordGaps(
  competitor: SeoCompetitorRecord,
  keywordText: string,
): Promise<{ imported: number; skippedExisting: number; skippedDuplicate: number }> {
  const keywords = parseKeywordList(keywordText);
  const [existingKeywords, existingGaps] = await Promise.all([listSeoKeywords(), listCompetitorGaps()]);

  const keywordSet = new Set(existingKeywords.map((k) => normalizeKeyword(k.keyword)));
  const gapSet = new Set(
    existingGaps
      .filter((g) => g.competitorId === competitor.id)
      .map((g) => normalizeKeyword(g.keyword)),
  );

  let imported = 0;
  let skippedExisting = 0;
  let skippedDuplicate = 0;

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) continue;

    if (keywordSet.has(normalized)) {
      skippedExisting += 1;
      continue;
    }
    if (gapSet.has(normalized)) {
      skippedDuplicate += 1;
      continue;
    }

    await addDoc(collection(db, GAPS_COL), {
      keyword: keyword.trim(),
      competitorId: competitor.id,
      competitorLabel: competitor.label,
      competitorDomain: competitor.domain,
      status: 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    gapSet.add(normalized);
    imported += 1;
  }

  return { imported, skippedExisting, skippedDuplicate };
}

export async function updateGapStatus(id: string, status: GapStatus): Promise<void> {
  await updateDoc(doc(db, GAPS_COL, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function addGapToKeywordEngine(
  gap: SeoCompetitorGapRecord,
  assignedPageUrl = '',
): Promise<void> {
  await createCompetitorSuggestedKeyword(gap.keyword, assignedPageUrl);
  await updateGapStatus(gap.id, 'added');
}

export async function deleteGap(id: string): Promise<void> {
  await deleteDoc(doc(db, GAPS_COL, id));
}

/** Future SerpAPI hook — stub for Phase 5 extension point */
export type SerpApiGapFetchInput = {
  competitorDomain: string;
  seedKeyword?: string;
};

export function serpApiGapFetchPlaceholder(_input: SerpApiGapFetchInput): Promise<string[]> {
  return Promise.reject(new Error('SerpAPI integration not configured. Paste competitor keywords manually for now.'));
}
