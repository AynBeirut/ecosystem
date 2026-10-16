import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '@/embed/wireFinanceOnLoad';
import FinanceAppBridge from '@/embed/FinanceAppBridge';
import { wireFinanceFirebaseFromGrabio } from '@/embed/financeFirebaseBridge';
import FinanceInvoiceModuleGate from '@/components/finance/FinanceInvoiceModuleGate';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import InvoiceManagerNavBar from '@/pages/admin/invoice-manager/InvoiceManagerNavBar';
import InvoiceTabHost from '@/pages/admin/invoice-manager/InvoiceTabHost';
import { InvoiceManagerDateFilterProvider } from '../../../../vendor/beirut-finance-flow-main/src/context/InvoiceManagerDateFilterContext';
import { INVOICE_PAGE_LOADERS, preloadInvoicePages } from '@/pages/admin/invoice-manager/invoiceEmbeddedLoaders';
import {
  type InvoiceManagerModule,
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

  useEffect(() => {
    wireFinanceFirebaseFromGrabio();
    preloadInvoicePages(INVOICE_PAGE_LOADERS);
  }, []);

  useEffect(() => {
    setActiveModule(invoiceManagerModuleFromPath(location.pathname));
  }, [location.pathname]);

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
        <FinanceAppBridge>
          <InvoiceManagerDateFilterProvider>
            <InvoiceManagerNavBar activeModule={activeModule} onModuleChange={selectModule} />
            <InvoiceTabHost />
          </InvoiceManagerDateFilterProvider>
        </FinanceAppBridge>
      </div>
    </FinanceInvoiceModuleGate>
  );
};

export default InvoiceManagerModuleShell;
