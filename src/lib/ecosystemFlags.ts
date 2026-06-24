/**
 * Local ecosystem rollout flags — all default OFF so production behaviour is unchanged
 * until you explicitly enable them in `.env.local` (never commit secrets).
 */

function envFlag(name: string): boolean {
  const value = String(import.meta.env[name] ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export const ECOSYSTEM_FLAGS = {
  modularEntitlements: envFlag('VITE_ECOSYSTEM_MODULAR'),
  /** When false, modular builder is visible but Subscribe is disabled (billing safety). */
  modularCheckout: envFlag('VITE_ECOSYSTEM_MODULAR_CHECKOUT'),
  enforceModuleGates: envFlag('VITE_ECOSYSTEM_ENFORCE_MODULES'),
  packageDraft: envFlag('VITE_ECOSYSTEM_PACKAGE_DRAFT'),
  /** Storefront composed stock via Cloud Function (ships with functions deploy). */
  publicProductStockApi: envFlag('VITE_PUBLIC_PRODUCT_STOCK_API'),
} as const;

export function isModularEntitlementsEnabled(): boolean {
  return ECOSYSTEM_FLAGS.modularEntitlements;
}
