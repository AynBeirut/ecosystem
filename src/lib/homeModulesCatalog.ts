import { MODULE_CATALOG } from './pricingDisplay';
import { PACKAGE_PRESETS, CORE_MODULE_IDS } from './moduleManifest';

/** JSON catalog for public/home.html — generated from single source */
export function buildHomeModulesJson() {
  const presets = Object.entries(PACKAGE_PRESETS).map(([key, p]) => ({
    key,
    label: p.label,
    monthlyUsd: p.monthlyUsd,
    workflow: p.workflow,
    modules: p.defaultModules,
  }));

  const modules = MODULE_CATALOG.map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    summary: m.summary,
    status: m.status,
    isCore: CORE_MODULE_IDS.includes(m.id as (typeof CORE_MODULE_IDS)[number]),
  }));

  return { version: 1, presets, modules };
}
