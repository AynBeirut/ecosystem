/**
 * Phase 7 — legacy tier shim. When LEGACY_TIERS_RETIRED=true, callers should use modular only.
 */
export const LEGACY_TIERS_RETIRED = import.meta.env.VITE_LEGACY_TIERS_RETIRED === 'true';

export function isLegacyTierUiEnabled(): boolean {
  return !LEGACY_TIERS_RETIRED;
}

export function preferredPricingVersion(): 'legacy-v1' | 'modular-v2' {
  return LEGACY_TIERS_RETIRED ? 'modular-v2' : 'legacy-v1';
}
