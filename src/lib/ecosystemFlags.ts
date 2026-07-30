/**
 * Local ecosystem rollout flags. Keep the modular checkout flag aligned with the
 * modular entitlements rollout unless it is explicitly overridden.
 */

function envFlag(name: string, fallback = false): boolean {
  const value = String(import.meta.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

const modularEntitlements = envFlag('VITE_ECOSYSTEM_MODULAR');

export const ECOSYSTEM_FLAGS = {
  modularEntitlements,
  /**
   * If modular billing is live, checkout should be live too unless an explicit
   * env override turns it off for a controlled rollback.
   */
  modularCheckout: envFlag('VITE_ECOSYSTEM_MODULAR_CHECKOUT', modularEntitlements),
  enforceModuleGates: envFlag('VITE_ECOSYSTEM_ENFORCE_MODULES'),
  packageDraft: envFlag('VITE_ECOSYSTEM_PACKAGE_DRAFT'),
  /** Storefront composed stock via Cloud Function (ships with functions deploy). */
  publicProductStockApi: envFlag('VITE_PUBLIC_PRODUCT_STOCK_API'),
} as const;

export function isModularEntitlementsEnabled(): boolean {
  return ECOSYSTEM_FLAGS.modularEntitlements;
}
