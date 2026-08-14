import { buildProfileFromPreset, type StartingPackageKey } from '@/lib/packagePresets';
import type { BuildMethod } from '@/lib/buildMethod';
import { isGrabioEditorMethod } from '@/lib/buildMethod';
import type { StoreProfile } from '@/types/storeProfile';

export type SiteIntent = 'display' | 'blog' | 'ecommerce';

export type BusinessIntent = 'store' | 'restaurant' | 'manufacturer';

export type BuilderWizardStepId =
  | 'site-type'
  | 'business-type'
  | 'method'
  | 'wordpress-request';

export const BUILDER_WIZARD_STEPS: { id: BuilderWizardStepId; label: string }[] = [
  { id: 'site-type', label: 'Site type' },
  { id: 'business-type', label: 'Business' },
  { id: 'method', label: 'Method' },
  { id: 'wordpress-request', label: 'Domain' },
];

export const EDITOR_SETUP_VERSION = 2;

export type BuilderWizardState = {
  step: BuilderWizardStepId;
  siteIntent?: SiteIntent;
  businessIntent?: BusinessIntent;
  buildMethod?: BuildMethod;
  wordpressRequestId?: string;
  editorSetupVersion?: number;
  setupCompletedMethods?: Partial<Record<'classic' | 'theme_editor', number>>;
  updatedAt?: string;
};

/** Firestore rejects `undefined` — omit those keys before setDoc/updateDoc. */
export function stripUndefinedForFirestore<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedForFirestore(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested === undefined) continue;
    out[key] = stripUndefinedForFirestore(nested);
  }
  return out as T;
}

export function buildBuilderWizardPatch(
  patch: Partial<BuilderWizardState> & Pick<BuilderWizardState, 'step'>,
): BuilderWizardState {
  return stripUndefinedForFirestore({
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  }) as BuilderWizardState;
}

const BUSINESS_TO_PRESET: Record<BusinessIntent, StartingPackageKey> = {
  store: 'pkg_shop',
  restaurant: 'pkg_live_kitchen',
  manufacturer: 'pkg_factory_flow',
};

export function stepsForSiteIntent(siteIntent?: SiteIntent): BuilderWizardStepId[] {
  if (siteIntent === 'ecommerce') {
    return ['site-type', 'business-type'];
  }
  return ['site-type'];
}

/** Setup steps shown before opening an editor or WordPress domain form. */
export function setupStepsForBuildMethod(
  targetMethod: BuildMethod,
  siteIntent?: SiteIntent,
): BuilderWizardStepId[] {
  if (isGrabioEditorMethod(targetMethod)) {
    return ['site-type', 'business-type'];
  }
  const base = stepsForSiteIntent(siteIntent);
  if (targetMethod === 'wordpress') {
    return [...base, 'wordpress-request'];
  }
  return base;
}

export function isEditorSetupCompleteForMethod(
  wiz: BuilderWizardState | undefined,
  targetMethod: 'classic' | 'theme_editor',
): boolean {
  if (!wiz?.siteIntent || !wiz?.businessIntent) return false;
  if (wiz.setupCompletedMethods?.[targetMethod] === EDITOR_SETUP_VERSION) return true;
  if (wiz.editorSetupVersion === EDITOR_SETUP_VERSION && wiz.buildMethod === targetMethod) return true;
  // Legacy shared completion (before per-method tracking) — classic only.
  if (
    wiz.editorSetupVersion === EDITOR_SETUP_VERSION &&
    !wiz.setupCompletedMethods &&
    targetMethod === 'classic'
  ) {
    return true;
  }
  return false;
}

export function isBuilderSetupComplete(
  profile: Pick<StoreProfile, 'builderWizard'> | null | undefined,
  targetMethod: BuildMethod,
): boolean {
  const wiz = profile?.builderWizard;
  if (!wiz?.siteIntent) return false;
  if (targetMethod === 'classic' || targetMethod === 'theme_editor') {
    return isEditorSetupCompleteForMethod(wiz, targetMethod);
  }
  if (wiz.siteIntent === 'ecommerce' && !wiz.businessIntent) return false;
  if (targetMethod === 'wordpress') {
    return Boolean(wiz.wordpressRequestId);
  }
  return false;
}

export function resolveSetupStep(
  profile: Pick<StoreProfile, 'builderWizard'> | null | undefined,
  targetMethod: BuildMethod,
): BuilderWizardStepId {
  const wiz = profile?.builderWizard;
  const siteIntent = wiz?.siteIntent;
  if (!siteIntent) return 'site-type';
  if (targetMethod === 'classic' || targetMethod === 'theme_editor') {
    if (!isEditorSetupCompleteForMethod(wiz, targetMethod)) {
      if (!siteIntent) return 'site-type';
      if (!wiz?.businessIntent) return 'business-type';
      if (wiz.step === 'business-type' && wiz.buildMethod === targetMethod) return 'business-type';
      return 'site-type';
    }
  }
  if (isGrabioEditorMethod(targetMethod) && !wiz?.businessIntent) return 'business-type';
  if (siteIntent === 'ecommerce' && !wiz?.businessIntent) return 'business-type';
  if (targetMethod === 'wordpress' && !wiz?.wordpressRequestId) return 'wordpress-request';
  if (targetMethod === 'wordpress') return 'wordpress-request';
  return isGrabioEditorMethod(targetMethod) ? 'business-type' : 'site-type';
}

const LEGACY_WIZARD_STEPS = new Set([
  'theme',
  'page-design',
  'products',
  'customize',
  'preview',
  'publish',
]);

/** Map persisted wizard steps from pre–Method-step releases. */
export function normalizeWizardStep(
  raw: string | undefined,
  siteIntent?: SiteIntent,
  buildMethod?: BuildMethod,
): BuilderWizardStepId {
  if (raw === 'wordpress-request') return 'wordpress-request';
  if (raw === 'method') {
    if (buildMethod === 'wordpress') return 'wordpress-request';
    if (siteIntent === 'ecommerce') return 'business-type';
    return 'site-type';
  }
  if (raw && LEGACY_WIZARD_STEPS.has(raw)) {
    if (buildMethod === 'wordpress') return 'wordpress-request';
    if (siteIntent === 'ecommerce') return 'business-type';
    return 'site-type';
  }
  const allowed = stepsForSiteIntent(siteIntent);
  if (raw && allowed.includes(raw as BuilderWizardStepId)) {
    return raw as BuilderWizardStepId;
  }
  if (buildMethod === 'wordpress') return 'wordpress-request';
  return 'site-type';
}

export function isLegacyWizardStep(step?: string): boolean {
  return Boolean(step && LEGACY_WIZARD_STEPS.has(step));
}

export function nextStep(
  current: BuilderWizardStepId,
  siteIntent?: SiteIntent,
): BuilderWizardStepId | null {
  const order = stepsForSiteIntent(siteIntent);
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

export function prevStep(
  current: BuilderWizardStepId,
  siteIntent?: SiteIntent,
): BuilderWizardStepId | null {
  const order = stepsForSiteIntent(siteIntent);
  const idx = order.indexOf(current);
  if (idx <= 0) return null;
  return order[idx - 1];
}

export function profilePatchForSiteIntent(
  siteIntent: SiteIntent,
  businessIntent?: BusinessIntent,
): Partial<StoreProfile> {
  const timestamp = new Date().toISOString();
  const wizardBase = { step: 'site-type' as const, siteIntent, updatedAt: timestamp };

  if (siteIntent === 'display') {
    return {
      storefrontMode: 'display',
      builderWizard: wizardBase,
      enabledModules: {
        invoicing: true,
        marketplace: false,
        analytics: true,
        payments: true,
        delivery: false,
        stock: true,
      },
      pricingVersion: 'modular-v2',
      businessWorkflow: 'custom',
    };
  }

  if (siteIntent === 'blog') {
    return {
      storefrontMode: 'display',
      builderWizard: wizardBase,
      enabledModules: {
        invoicing: true,
        marketplace: false,
        analytics: true,
        payments: true,
        delivery: false,
        stock: true,
        blog_publisher: true,
      },
      pricingVersion: 'modular-v2',
      businessWorkflow: 'custom',
    };
  }

  const preset = BUSINESS_TO_PRESET[businessIntent || 'store'];
  const presetPatch = buildProfileFromPreset(preset);
  return {
    ...presetPatch,
    storefrontMode: 'commerce',
    builderWizard: {
      ...wizardBase,
      businessIntent: businessIntent || 'store',
    },
  };
}

export const SITE_INTENT_OPTIONS: {
  id: SiteIntent;
  title: string;
  description: string;
}[] = [
  {
    id: 'display',
    title: 'Basic / Display site',
    description:
      'A simple website with your story and product showcase. Visitors can contact you — no online cart or checkout.',
  },
  {
    id: 'blog',
    title: 'Blog',
    description:
      'Publish articles and updates for your audience. Optional reader subscriptions later — no e-commerce checkout required.',
  },
  {
    id: 'ecommerce',
    title: 'E-commerce',
    description:
      'Sell online with a real store backend: products, orders, inventory, and payments tied to the rest of Grabio.',
  },
];

export const BUILD_METHOD_OPTIONS: {
  id: BuildMethod;
  title: string;
  description: string;
  disabled?: boolean;
  badge?: string;
}[] = [
  {
    id: 'classic',
    title: 'Classic Templates',
    description:
      'Full drag-and-drop control — templates, colors, layout, sections, and forms. Best if you want every knob.',
  },
  {
    id: 'theme_editor',
    title: 'Theme Editor',
    description:
      'Shopify-style editor with live preview — themes, sections, content, and publish in one screen.',
  },
  {
    id: 'wordpress',
    title: 'WordPress',
    description:
      'We provision WordPress on your domain. You manage content in wp-admin after our team hands off credentials.',
  },
  {
    id: 'import',
    title: 'Import from another platform',
    description: 'Migrate from WordPress, Magento, or Shopify — automated import pipeline.',
    disabled: true,
    badge: 'Coming soon',
  },
];

export const BUSINESS_INTENT_OPTIONS: {
  id: BusinessIntent;
  title: string;
  description: string;
  preset: StartingPackageKey;
}[] = [
  {
    id: 'store',
    title: 'Store (retail / general)',
    description:
      'Best for shops selling finished products — catalog, orders, stock, and invoicing in one place.',
    preset: 'pkg_shop',
  },
  {
    id: 'restaurant',
    title: 'Restaurant / live kitchen',
    description:
      'Best if you cook to order and want stock to update the moment you sell — recipes and kitchen workflow included.',
    preset: 'pkg_live_kitchen',
  },
  {
    id: 'manufacturer',
    title: 'Manufacturer',
    description:
      'Best if you produce goods in batches from raw materials — BOM, production runs, and finished goods tracking.',
    preset: 'pkg_factory_flow',
  },
];
