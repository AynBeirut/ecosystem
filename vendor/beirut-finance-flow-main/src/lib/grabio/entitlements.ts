import type { GrabioStoreProfile } from './types';
import { isPlayStoreV1Shell } from '@/lib/playStoreNavScope';

const PAID_TIERS = new Set(['starter', 'pro', 'business', 'premium']);

/** Dev / owner bypass — same idea as main Grabio admin overrides. */
const PREMIUM_OVERRIDE_EMAILS = new Set(['anwar@aynbeirut.com', 'anwar.abouhassan@gmail.com']);

export function enforceModuleGates(): boolean {
  return import.meta.env.VITE_ECOSYSTEM_ENFORCE_MODULES === 'true';
}

/**
 * Invoice app uses free | pro for limits and UI badge.
 * Sync from Firestore storeProfiles — same source as main Grabio subscription.
 */
export function resolveInvoiceAppPlan(
  profile: GrabioStoreProfile | null | undefined,
  email?: string | null,
): 'free' | 'pro' {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && PREMIUM_OVERRIDE_EMAILS.has(normalizedEmail)) return 'pro';
  if (!profile) return 'free';
  if (profile.isDemo) return 'pro';

  const tier = String(profile.subscriptionTier || 'trial').toLowerCase();
  const status = String(profile.subscriptionStatus || '').toLowerCase();

  if (status === 'expired' || status === 'blocked') return 'free';

  if (PAID_TIERS.has(tier)) return 'pro';

  // Modular Shop / Factory packages: often tier=trial but status=active
  if (status === 'active' || status === 'grace') return 'pro';

  if (profile.pricingVersion === 'modular-v2' && profile.startingPackage) {
    const pkg = profile.startingPackage.toLowerCase();
    if (pkg && pkg !== 'trial' && pkg !== 'free') return 'pro';
  }

  return 'free';
}

/** Invoice Manager — included with Invoicing & Billing (core) or Invoice Manager add-on. */
export function canUseInvoiceModule(profile: GrabioStoreProfile | null | undefined): boolean {
  if (typeof window !== 'undefined' && isPlayStoreV1Shell()) return true;
  if (!profile) return false;
  if (!enforceModuleGates()) return true;

  const modules = profile.enabledModules;
  if (profile.pricingVersion === 'modular-v2' && modules && Object.keys(modules).length > 0) {
    if (modules.invoice_manager === true || modules.invoicing === true) return true;
    // Invoicing is a core module on Shop packages — enabled unless explicitly false.
    if (modules.invoicing !== false) return true;
    return false;
  }

  const tier = profile.subscriptionTier || 'trial';
  if (tier === 'trial') return true;
  if (PAID_TIERS.has(tier)) return true;
  if (profile.subscriptionStatus === 'active') return true;
  return false;
}
