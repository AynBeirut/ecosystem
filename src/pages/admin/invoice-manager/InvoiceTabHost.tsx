import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import {
  getCachedInvoicePage,
  INVOICE_PAGE_LOADERS,
  loadInvoicePage,
  preloadInvoicePages,
} from '@/pages/admin/invoice-manager/invoiceEmbeddedLoaders';
import {
  INVOICE_MANAGER_MODULE_DEFS,
  invoiceManagerModuleFromPath,
} from '@/pages/admin/invoice-manager/invoiceManagerModuleTabs';

function buildInitialPages(): Record<string, React.ComponentType> {
  const initial: Record<string, React.ComponentType> = {};
  for (const def of INVOICE_MANAGER_MODULE_DEFS) {
    const cached = getCachedInvoicePage(def.loader);
    if (cached) initial[def.key] = cached;
  }
  return initial;
}

export default function InvoiceTabHost() {
  const { pathname } = useLocation();
  const activeKey = useMemo(() => invoiceManagerModuleFromPath(pathname), [pathname]);
  const activeDef = useMemo(
    () => INVOICE_MANAGER_MODULE_DEFS.find((d) => d.key === activeKey) ?? INVOICE_MANAGER_MODULE_DEFS[0],
    [activeKey],
  );
  const [pages, setPages] = useState<Record<string, React.ComponentType>>(buildInitialPages);

  useEffect(() => {
    preloadInvoicePages(INVOICE_PAGE_LOADERS);
  }, []);

  useEffect(() => {
    const cached = getCachedInvoicePage(activeDef.loader);
    if (cached) {
      setPages((prev) => (prev[activeKey] ? prev : { ...prev, [activeKey]: cached }));
      return;
    }
    let cancelled = false;
    void loadInvoicePage(activeDef.loader).then((Comp) => {
      if (!cancelled) {
        setPages((prev) => ({ ...prev, [activeKey]: Comp }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeDef.loader, activeKey]);

  const ActivePage = pages[activeKey];

  return (
    <div className="finance-tab-host relative min-h-[80px]">
      {ActivePage ? (
        <div key={activeKey} className="finance-embed-panel block">
          <ActivePage />
        </div>
      ) : (
        <AdminEmbedLoader label="Opening…" compact inline />
      )}
    </div>
  );
}
