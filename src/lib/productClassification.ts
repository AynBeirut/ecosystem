import type { BusinessWorkflow, ModuleId, StartingPackageKey } from '@/lib/moduleManifest';

/**
 * Platform product stratum — restaurant-first pivot (2026-09-15).
 * Does not remove modules or change entitlements; guides roadmap, nav prep, and agent docs.
 */
export type ProductStratum =
  | 'active_core'
  | 'optional_maturity'
  | 'connected_high_end'
  | 'maintenance'
  | 'deferred';

export const PRODUCT_STRATUM_LABELS: Record<ProductStratum, string> = {
  active_core: 'Active core (venue ops + CRM)',
  optional_maturity: 'Optional maturity (finance, inventory, production depth)',
  connected_high_end: 'Connected high-end (builder, template, SEO)',
  maintenance: 'Maintained (existing tenants, no broad GTM)',
  deferred: 'Deferred growth (support only)',
};

export const WORKFLOW_PRODUCT_STRATUM: Record<BusinessWorkflow, ProductStratum> = {
  live_kitchen: 'active_core',
  shop: 'maintenance',
  factory: 'maintenance',
  ngo: 'deferred',
  freelancer: 'deferred',
  custom: 'maintenance',
};

export const PACKAGE_PRODUCT_STRATUM: Record<StartingPackageKey, ProductStratum> = {
  pkg_live_kitchen: 'active_core',
  pkg_shop: 'maintenance',
  pkg_factory_flow: 'maintenance',
  pkg_business_backend: 'maintenance',
  pkg_invoice: 'maintenance',
  pkg_web_presence: 'connected_high_end',
  pkg_mini_shop: 'deferred',
  pkg_ngo: 'deferred',
  pkg_freelancer: 'deferred',
};

/** Module-level stratum for roadmap and future nav gating (entitlements unchanged). */
export const MODULE_PRODUCT_STRATUM: Partial<Record<ModuleId, ProductStratum>> = {
  // Venue operations
  pos: 'active_core',
  restaurant: 'active_core',
  crm: 'active_core',
  delivery: 'active_core',
  admin_mobile: 'active_core',
  invoice_manager: 'active_core',
  invoicing: 'active_core',
  marketplace: 'active_core',
  analytics: 'active_core',
  payments: 'optional_maturity',
  stock: 'optional_maturity',
  factory: 'maintenance',
  team: 'optional_maturity',
  dropship: 'maintenance',
  services: 'maintenance',
  projects: 'deferred',
  proposal_writer: 'deferred',
  builder: 'connected_high_end',
  ai_builder: 'connected_high_end',
  blog_publisher: 'connected_high_end',
  seo_assistant: 'connected_high_end',
  content_creator: 'connected_high_end',
  market_strategy: 'connected_high_end',
  email_marketing: 'connected_high_end',
  campaign_writer: 'connected_high_end',
  analytics_insights: 'connected_high_end',
  whitelabel: 'connected_high_end',
  ai_agent: 'connected_high_end',
};

export function getWorkflowProductStratum(workflow: BusinessWorkflow): ProductStratum {
  return WORKFLOW_PRODUCT_STRATUM[workflow];
}

export function getPackageProductStratum(preset: StartingPackageKey): ProductStratum {
  return PACKAGE_PRODUCT_STRATUM[preset];
}

export function getModuleProductStratum(moduleId: string): ProductStratum {
  return MODULE_PRODUCT_STRATUM[moduleId as ModuleId] ?? 'maintenance';
}

export function isActiveCoreWorkflow(workflow: BusinessWorkflow | undefined | null): boolean {
  return workflow === 'live_kitchen';
}

export function isDeferredPackage(preset: StartingPackageKey | undefined | null): boolean {
  if (!preset) return false;
  return PACKAGE_PRODUCT_STRATUM[preset] === 'deferred';
}

/** Future venue UI: finance/inventory groups off unless module + tenant flag (Slice C). */
export function isOptionalMaturityModule(moduleId: string): boolean {
  return getModuleProductStratum(moduleId) === 'optional_maturity';
}

export function isConnectedHighEndModule(moduleId: string): boolean {
  return getModuleProductStratum(moduleId) === 'connected_high_end';
}
