import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import {
  CRM_PAGE_LOADERS,
  getCachedCrmPage,
  loadCrmActivities,
  loadCrmCustomers,
  loadCrmMap,
  loadCrmPerformance,
  loadCrmPipeline,
  loadCrmPage,
  loadCrmReps,
  preloadCrmPages,
  type CrmPageLoader,
} from '@/pages/admin/crm/crmEmbeddedLoaders';

const CRM_TABS: { key: string; prefix: string; loader: CrmPageLoader }[] = [
  { key: 'dashboard', prefix: '/admin/crm/dashboard', loader: loadCrmPerformance },
  { key: 'customers', prefix: '/admin/crm/customers', loader: loadCrmCustomers },
  { key: 'activities', prefix: '/admin/crm/activities', loader: loadCrmActivities },
  { key: 'map', prefix: '/admin/crm/map', loader: loadCrmMap },
  { key: 'pipeline', prefix: '/admin/crm/pipeline', loader: loadCrmPipeline },
  { key: 'reps', prefix: '/admin/crm/reps', loader: loadCrmReps },
];

function buildInitialPages(): Record<string, React.ComponentType> {
  const initial: Record<string, React.ComponentType> = {};
  for (const tab of CRM_TABS) {
    const cached = getCachedCrmPage(tab.loader);
    if (cached) initial[tab.key] = cached;
  }
  return initial;
}

export default function CrmTabHost() {
  const { pathname } = useLocation();
  const activeTab = useMemo(
    () => CRM_TABS.find((tab) => pathname.startsWith(tab.prefix)),
    [pathname],
  );
  const [pages, setPages] = useState<Record<string, React.ComponentType>>(buildInitialPages);

  useEffect(() => {
    preloadCrmPages(CRM_PAGE_LOADERS);
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    const cached = getCachedCrmPage(activeTab.loader);
    if (cached) {
      setPages((prev) => (prev[activeTab.key] ? prev : { ...prev, [activeTab.key]: cached }));
      return;
    }
    let cancelled = false;
    void loadCrmPage(activeTab.loader).then((Comp) => {
      if (!cancelled) {
        setPages((prev) => ({ ...prev, [activeTab.key]: Comp }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  if (!activeTab) return null;

  const ActivePage = pages[activeTab.key];

  return (
    <div className="crm-tab-host relative min-h-[120px]">
      {CRM_TABS.map((tab) => {
        const Comp = pages[tab.key];
        if (!Comp) return null;
        const visible = tab.key === activeTab.key;
        return (
          <div key={tab.key} className={visible ? 'block' : 'hidden'} aria-hidden={!visible}>
            <Comp />
          </div>
        );
      })}
      {!ActivePage ? <AdminEmbedLoader label="Opening CRM…" compact /> : null}
    </div>
  );
}
