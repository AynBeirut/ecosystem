import { mergeSectionOrderFromProfile } from '@/lib/storeSectionDefaults';
import type { StoreSectionOrder } from '@/types/storeProfile';

/** Pull only drag-and-drop layout from a builder / design JSON export. */
export function extractSectionOrderFromDesignImport(data: unknown): StoreSectionOrder[] | null {
  if (!data || typeof data !== 'object') return null;
  const raw = (data as { sectionOrder?: unknown }).sectionOrder;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return mergeSectionOrderFromProfile(raw as StoreSectionOrder[]);
}

/** Firestore merge patch when importing layout into the Custom template. */
export function layoutImportFirestorePatch(sectionOrder: StoreSectionOrder[]) {
  return {
    template: 'custom' as const,
    sectionOrder,
    hasImportedDesign: true,
  };
}
