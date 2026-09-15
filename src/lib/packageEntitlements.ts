import type { StartingPackageKey } from '@/lib/moduleManifest';
import type { StoreProfile } from '@/types/storeProfile';

/** Backend-only presets — no public website, no custom domain. */
export const PACKAGES_WITHOUT_WEBSITE: StartingPackageKey[] = [
  'pkg_invoice',
  'pkg_business_backend',
  'pkg_ngo',
  'pkg_freelancer',
];

export function packageIncludesWebsite(preset?: StartingPackageKey | null): boolean {
  if (!preset) return true;
  return !PACKAGES_WITHOUT_WEBSITE.includes(preset);
}

export function packageIncludesCustomDomain(preset?: StartingPackageKey | null): boolean {
  return packageIncludesWebsite(preset);
}

export function profileIncludesCustomDomain(profile: StoreProfile | null | undefined): boolean {
  if (!profile) return false;
  const addOns = profile.addOns;
  const addOnsMeta = profile.addOnsMeta;
  if (Array.isArray(addOns) && addOns.includes('domainPackage')) return true;
  if (addOns && typeof addOns === 'object' && Boolean((addOns as Record<string, unknown>).domainPackage)) return true;
  if (addOnsMeta?.domainPackage) return true;
  if (profile.startingPackage) {
    return packageIncludesCustomDomain(profile.startingPackage);
  }
  const tier = profile.subscriptionTier;
  if (tier === 'trial') return false;
  return tier === 'starter' || tier === 'pro' || tier === 'business' || tier === 'premium' || !tier;
}
