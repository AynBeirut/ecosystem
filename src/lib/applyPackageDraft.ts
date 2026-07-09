import { ECOSYSTEM_FLAGS } from '@/lib/ecosystemFlags';
import {
  PACKAGE_PRESETS,
  type BusinessWorkflow,
  type StartingPackageKey,
} from '@/lib/moduleManifest';
import {
  clearPackageDraft,
  loadPackageDraft,
  PACKAGE_DRAFT_STORAGE_KEY,
  type PackageDraft,
} from '@/lib/packageDraft';
import type { StoreProfile } from '@/types/storeProfile';

/** Read draft from sessionStorage even when apply flag is off (for inspection). */
export function readPackageDraftRaw(): PackageDraft | null {
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

export function isPackageDraftApplyEnabled(): boolean {
  return ECOSYSTEM_FLAGS.packageDraft;
}

export function shouldApplyPackageDraft(existing: StoreProfile | null | undefined): boolean {
  if (!isPackageDraftApplyEnabled()) return false;
  const draft = readPackageDraftRaw() ?? loadPackageDraft();
  if (!draft) return false;
  if (existing?.enabledModules && Object.keys(existing.enabledModules).length > 0) return false;
  if (existing?.pricingVersion === 'modular-v2') return false;
  return true;
}

function inferWorkflow(modules: Record<string, boolean>, draft: PackageDraft): BusinessWorkflow {
  if (draft.workflow) return draft.workflow;
  if (draft.preset && PACKAGE_PRESETS[draft.preset]) {
    return PACKAGE_PRESETS[draft.preset].workflow;
  }
  const hasKitchen = Boolean(modules.restaurant || modules.pos);
  const hasFactory = Boolean(modules.factory);
  if (hasKitchen && !hasFactory) return 'live_kitchen';
  if (hasFactory && !hasKitchen) return 'factory';
  if (hasKitchen && hasFactory) return 'live_kitchen';
  return 'shop';
}

function normalizeModulesForWorkflow(
  modules: Record<string, boolean>,
  workflow: BusinessWorkflow,
): Record<string, boolean> {
  const next = { ...modules };
  if (workflow === 'live_kitchen') {
    next.restaurant = true;
    if (next.pos === undefined) next.pos = true;
    next.factory = false;
  } else if (workflow === 'factory') {
    next.factory = true;
    next.restaurant = false;
    next.pos = false;
  }
  return next;
}

export function buildStoreProfilePatchFromDraft(
  draft: PackageDraft | null = readPackageDraftRaw(),
): Partial<StoreProfile> | null {
  if (!draft) return null;

  const workflow = inferWorkflow(draft.modules, draft);
  const enabledModules = normalizeModulesForWorkflow(draft.modules, workflow);

  const patch: Partial<StoreProfile> = {
    pricingVersion: 'modular-v2',
    businessWorkflow: workflow,
    enabledModules,
    seatCount: 1,
    posLocationCount: enabledModules.pos ? 1 : 0,
    composedProductSource: 'platform',
    packageDraftAppliedAt: new Date().toISOString(),
  };

  if (draft.preset) {
    patch.startingPackage = draft.preset;
  }

  return patch;
}

export function consumePackageDraftForStore(
  existing: StoreProfile | null | undefined,
): Partial<StoreProfile> {
  if (!shouldApplyPackageDraft(existing)) return {};
  const patch = buildStoreProfilePatchFromDraft();
  if (!patch) return {};
  clearPackageDraft();
  try {
    sessionStorage.removeItem(PACKAGE_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
  return patch;
}
