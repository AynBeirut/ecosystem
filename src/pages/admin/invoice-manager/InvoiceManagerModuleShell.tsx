import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '@/embed/wireFinanceOnLoad';
import FinanceAppBridge from '@/embed/FinanceAppBridge';
import { wireFinanceFirebaseFromGrabio } from '@/embed/financeFirebaseBridge';
import FinanceInvoiceModuleGate from '@/components/finance/FinanceInvoiceModuleGate';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import InvoiceManagerNavBar from '@/pages/admin/invoice-manager/InvoiceManagerNavBar';
import {
  getCachedInvoicePage,
  INVOICE_PAGE_LOADERS,
  loadInvoicePage,
  preloadInvoicePages,
} from '@/pages/admin/invoice-manager/invoiceEmbeddedLoaders';
import {
  type InvoiceManagerModule,
  INVOICE_MANAGER_MODULE_DEFS,
  invoiceManagerModuleFromPath,
  invoiceManagerModulePath,
} from '@/pages/admin/invoice-manager/invoiceManagerModuleTabs';

const InvoiceManagerModuleShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useStoreEntitlements();
  const accent = profile?.templateColors?.primary ?? '#38B2AC';

  const [activeModule, setActiveModule] = useState<InvoiceManagerModule>(() =>
    invoiceManagerModuleFromPath(location.pathname),
  );
  const [Page, setPage] = useState<React.ComponentType | null>(null);

  const activeDef = useMemo(
    () => INVOICE_MANAGER_MODULE_DEFS.find((item) => item.key === activeModule) ?? INVOICE_MANAGER_MODULE_DEFS[0],
    [activeModule],
  );

  useEffect(() => {
    wireFinanceFirebaseFromGrabio();
    preloadInvoicePages(INVOICE_PAGE_LOADERS);
  }, []);

  useEffect(() => {
    setActiveModule(invoiceManagerModuleFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const cached = getCachedInvoicePage(activeDef.loader);
    if (cached) {
      setPage(() => cached);
      return;
    }
    let cancelled = false;
    void loadInvoicePage(activeDef.loader).then((Comp) => {
      if (!cancelled) setPage(() => Comp);
    });
    return () => {
      cancelled = true;
    };
  }, [activeDef.loader]);

  const selectModule = useCallback(
    (module: InvoiceManagerModule) => {
      setActiveModule(module);
      const path = invoiceManagerModulePath(module);
      if (location.pathname !== path) {
        navigate(path, { replace: true, preventScrollReset: true });
      }
    },
    [location.pathname, navigate],
  );

  return (
    <FinanceInvoiceModuleGate variant="invoice">
      <div
        className="finance-embed-theme finance-module-shell space-y-2"
        style={{ '--finance-accent': accent } as React.CSSProperties}
      >
        <InvoiceManagerNavBar activeModule={activeModule} onModuleChange={selectModule} />
        <FinanceAppBridge>
          <div className="finance-tab-host relative min-h-[80px]">
            {Page ? (
              <div className="finance-embed-panel">
                <Page />
              </div>
            ) : (
              <AdminEmbedLoader label="Opening…" compact inline />
            )}
          </div>
        </FinanceAppBridge>
      </div>
    </FinanceInvoiceModuleGate>
  );
};

export default InvoiceManagerModuleShell;
