import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import type { BusinessWorkflow, StartingPackageKey } from '@/lib/moduleManifest';

export const PACKAGE_DRAFT_STORAGE_KEY = 'grabio_package_draft_v1';

export type PackageDraft = {
  version: 1;
  savedAt: string;
  path: 'custom' | 'preset';
  preset?: StartingPackageKey;
  workflow?: BusinessWorkflow;
  modules: Record<string, boolean>;
};

export function isPackageDraftEnabled(): boolean {
  return ECOSYSTEM_FLAGS.packageDraft;
}

export function savePackageDraft(draft: Omit<PackageDraft, 'version' | 'savedAt'>): void {
  try {
    const payload: PackageDraft = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...draft,
    };
    sessionStorage.setItem(PACKAGE_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadPackageDraft(): PackageDraft | null {
  if (!isPackageDraftEnabled()) return null;
  try {
    const raw = sessionStorage.getItem(PACKAGE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PackageDraft;
    if (parsed?.version !== 1 || !parsed.modules) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPackageDraft(): void {
  try {
    sessionStorage.removeItem(PACKAGE_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
