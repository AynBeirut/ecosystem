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
import { auth } from '@/lib/firebase';
import { getApiBaseUrl } from '@/lib/apiBase';

export type LinkProspectType = 'directory' | 'guest_post' | 'pr' | 'partner';
export type LinkProspectStatus = 'prospecting' | 'contacted' | 'negotiating' | 'acquired' | 'rejected';

export type SeoLinkProspect = {
  id: string;
  domain: string;
  drScore: number | null;
  type: LinkProspectType;
  status: LinkProspectStatus;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SeoLinkAcquired = {
  id: string;
  domain: string;
  linkingUrl: string;
  targetUrl: string;
  anchorText: string;
  drScore: number | null;
  acquiredDate: string;
  lastHttpStatus: number | null;
  lastCheckedAt: string | null;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SeoLinksSettings = {
  monthlyLinkTarget: number;
};

const PROSPECTS_COL = 'seo_link_prospects';
const ACQUIRED_COL = 'seo_links_acquired';
const SETTINGS_DOC = 'seo_links_settings/default';

export const LINK_PROSPECT_TYPES: LinkProspectType[] = ['directory', 'guest_post', 'pr', 'partner'];
export const LINK_PROSPECT_STATUSES: LinkProspectStatus[] = [
  'prospecting',
  'contacted',
  'negotiating',
  'acquired',
  'rejected',
];

export const DEFAULT_LINK_SETTINGS: SeoLinksSettings = {
  monthlyLinkTarget: 5,
};

export type SeoLinkProspectInput = Omit<SeoLinkProspect, 'id' | 'createdAt' | 'updatedAt'>;
export type SeoLinkAcquiredInput = Omit<
  SeoLinkAcquired,
  'id' | 'createdAt' | 'updatedAt' | 'lastHttpStatus' | 'lastCheckedAt'
> & {
  lastHttpStatus?: number | null;
  lastCheckedAt?: string | null;
};

function parseDr(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export async function loadLinkSettings(): Promise<SeoLinksSettings> {
  const snap = await getDoc(doc(db, ...SETTINGS_DOC.split('/')));
  if (!snap.exists()) return DEFAULT_LINK_SETTINGS;
  const target = Number(snap.data().monthlyLinkTarget);
  return {
    monthlyLinkTarget: Number.isFinite(target) && target > 0 ? target : DEFAULT_LINK_SETTINGS.monthlyLinkTarget,
  };
}

export async function saveLinkSettings(settings: SeoLinksSettings): Promise<void> {
  await setDoc(doc(db, ...SETTINGS_DOC.split('/')), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function listLinkProspects(): Promise<SeoLinkProspect[]> {
  const snap = await getDocs(collection(db, PROSPECTS_COL));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        domain: String(data.domain ?? ''),
        drScore: data.drScore == null ? null : parseDr(Number(data.drScore)),
        type: (String(data.type ?? 'directory') as LinkProspectType),
        status: (String(data.status ?? 'prospecting') as LinkProspectStatus),
        notes: String(data.notes ?? ''),
        createdAt: data.createdAt as Timestamp | undefined,
        updatedAt: data.updatedAt as Timestamp | undefined,
      };
    })
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

export async function createLinkProspect(input: SeoLinkProspectInput): Promise<void> {
  await addDoc(collection(db, PROSPECTS_COL), {
    ...input,
    domain: input.domain.trim().toLowerCase(),
    drScore: parseDr(input.drScore),
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateLinkProspect(id: string, input: SeoLinkProspectInput): Promise<void> {
  await updateDoc(doc(db, PROSPECTS_COL, id), {
    ...input,
    domain: input.domain.trim().toLowerCase(),
    drScore: parseDr(input.drScore),
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLinkProspect(id: string): Promise<void> {
  await deleteDoc(doc(db, PROSPECTS_COL, id));
}

export async function listAcquiredLinks(): Promise<SeoLinkAcquired[]> {
  const snap = await getDocs(collection(db, ACQUIRED_COL));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        domain: String(data.domain ?? ''),
        linkingUrl: String(data.linkingUrl ?? ''),
        targetUrl: String(data.targetUrl ?? ''),
        anchorText: String(data.anchorText ?? ''),
        drScore: data.drScore == null ? null : parseDr(Number(data.drScore)),
        acquiredDate: String(data.acquiredDate ?? ''),
        lastHttpStatus: data.lastHttpStatus == null ? null : Number(data.lastHttpStatus),
        lastCheckedAt: data.lastCheckedAt ? String(data.lastCheckedAt) : null,
        notes: String(data.notes ?? ''),
        createdAt: data.createdAt as Timestamp | undefined,
        updatedAt: data.updatedAt as Timestamp | undefined,
      };
    })
    .sort((a, b) => b.acquiredDate.localeCompare(a.acquiredDate));
}

export async function createAcquiredLink(input: SeoLinkAcquiredInput): Promise<void> {
  await addDoc(collection(db, ACQUIRED_COL), {
    ...input,
    domain: input.domain.trim().toLowerCase(),
    linkingUrl: input.linkingUrl.trim(),
    targetUrl: input.targetUrl.trim(),
    anchorText: input.anchorText.trim(),
    drScore: parseDr(input.drScore),
    notes: input.notes.trim(),
    lastHttpStatus: input.lastHttpStatus ?? null,
    lastCheckedAt: input.lastCheckedAt ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAcquiredLink(id: string, input: SeoLinkAcquiredInput): Promise<void> {
  await updateDoc(doc(db, ACQUIRED_COL, id), {
    ...input,
    domain: input.domain.trim().toLowerCase(),
    linkingUrl: input.linkingUrl.trim(),
    targetUrl: input.targetUrl.trim(),
    anchorText: input.anchorText.trim(),
    drScore: parseDr(input.drScore),
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAcquiredLink(id: string): Promise<void> {
  await deleteDoc(doc(db, ACQUIRED_COL, id));
}

export async function recheckAcquiredLink(id: string, linkingUrl: string): Promise<number> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in required');

  const res = await fetch(`${getApiBaseUrl()}/seo/check-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: linkingUrl }),
  });

  const data = (await res.json()) as { success: boolean; status?: number; message?: string };
  if (!res.ok || !data.success || data.status == null) {
    throw new Error(data.message || 'Link check failed');
  }

  const checkedAt = new Date().toISOString().split('T')[0];
  await updateDoc(doc(db, ACQUIRED_COL, id), {
    lastHttpStatus: data.status,
    lastCheckedAt: checkedAt,
    updatedAt: serverTimestamp(),
  });

  return data.status;
}

export function countAcquiredThisMonth(links: SeoLinkAcquired[]): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return links.filter((link) => {
    if (!link.acquiredDate) return false;
    const d = new Date(link.acquiredDate + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;
}

export function exportProspectsCsv(rows: SeoLinkProspect[]): string {
  const header = 'domain,dr_score,type,status,notes';
  const lines = rows.map((r) =>
    [r.domain, r.drScore ?? '', r.type, r.status, `"${r.notes.replace(/"/g, '""')}"`].join(','),
  );
  return [header, ...lines].join('\n');
}

export function exportAcquiredCsv(rows: SeoLinkAcquired[]): string {
  const header = 'domain,linking_url,target_url,anchor_text,dr_score,acquired_date,last_http_status,last_checked_at,notes';
  const lines = rows.map((r) =>
    [
      r.domain,
      r.linkingUrl,
      r.targetUrl,
      `"${r.anchorText.replace(/"/g, '""')}"`,
      r.drScore ?? '',
      r.acquiredDate,
      r.lastHttpStatus ?? '',
      r.lastCheckedAt ?? '',
      `"${r.notes.replace(/"/g, '""')}"`,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function isDeadLinkStatus(status: number | null): boolean {
  if (status == null) return false;
  return status >= 400 || status === 0;
}
