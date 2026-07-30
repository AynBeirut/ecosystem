import type { ComponentType } from 'react';

export const loadCrmPerformance = () => import('./CrmPerformance');
export const loadCrmCustomers = () => import('./CrmCustomers');
export const loadCrmActivities = () => import('./CrmActivities');
export const loadCrmMap = () => import('./CrmMap');
export const loadCrmPipeline = () => import('./CrmPipeline');
export const loadCrmReps = () => import('../AdminCrmReps');
export const loadCrmClientProfile = () => import('./CrmClientProfile');

export type CrmPageLoader = () => Promise<{ default: ComponentType }>;

export const CRM_PAGE_LOADERS: CrmPageLoader[] = [
  loadCrmPerformance,
  loadCrmCustomers,
  loadCrmActivities,
  loadCrmMap,
  loadCrmPipeline,
  loadCrmReps,
];

const pageCache = new Map<CrmPageLoader, ComponentType>();

export function getCachedCrmPage(loader: CrmPageLoader): ComponentType | undefined {
  return pageCache.get(loader);
}

export async function loadCrmPage(loader: CrmPageLoader): Promise<ComponentType> {
  const cached = pageCache.get(loader);
  if (cached) return cached;
  const mod = await loader();
  pageCache.set(loader, mod.default);
  return mod.default;
}

export function preloadCrmPages(loaders: CrmPageLoader[] = CRM_PAGE_LOADERS) {
  void Promise.all(loaders.map((loader) => loadCrmPage(loader).catch(() => undefined)));
}
