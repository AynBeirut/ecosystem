import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import {
  FINANCE_PAGE_LOADERS,
  getCachedFinancePage,
  loadAccounting,
  loadEstimateManager,
  loadFinanceReports,
  loadFinanceSettings,
  loadFinancePage,
  loadReceiptManager,
  preloadFinancePages,
  type FinancePageLoader,
} from '@/pages/admin/finance/financeEmbeddedLoaders';

const FINANCE_TABS: { key: string; prefix: string; loader: FinancePageLoader }[] = [
  { key: 'quotations', prefix: '/admin/finance/quotations', loader: loadEstimateManager },
  { key: 'estimates', prefix: '/admin/finance/estimates', loader: loadEstimateManager },
  { key: 'accounting', prefix: '/admin/finance/accounting', loader: loadAccounting },
  { key: 'recu', prefix: '/admin/finance/recu', loader: loadReceiptManager },
  { key: 'receipts', prefix: '/admin/finance/receipts', loader: loadReceiptManager },
  { key: 'reports', prefix: '/admin/finance/reports', loader: loadFinanceReports },
  { key: 'settings', prefix: '/admin/finance/settings', loader: loadFinanceSettings },
];

function buildInitialPages(): Record<string, React.ComponentType> {
  const initial: Record<string, React.ComponentType> = {};
  for (const tab of FINANCE_TABS) {
    const cached = getCachedFinancePage(tab.loader);
    if (cached) initial[tab.key] = cached;
  }
  return initial;
}

export default function FinanceTabHost() {
  const { pathname } = useLocation();
  const activeTab = useMemo(
    () => FINANCE_TABS.find((tab) => pathname.startsWith(tab.prefix)),
    [pathname],
  );
  const [pages, setPages] = useState<Record<string, React.ComponentType>>(buildInitialPages);

  useEffect(() => {
    preloadFinancePages(FINANCE_PAGE_LOADERS);
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    const cached = getCachedFinancePage(activeTab.loader);
    if (cached) {
      setPages((prev) => (prev[activeTab.key] ? prev : { ...prev, [activeTab.key]: cached }));
      return;
    }
    let cancelled = false;
    void loadFinancePage(activeTab.loader).then((Comp) => {
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
    <div className="finance-tab-host relative min-h-[120px]">
      {FINANCE_TABS.map((tab) => {
        const Comp = pages[tab.key];
        if (!Comp) return null;
        const visible = tab.key === activeTab.key;
        return (
          <div key={tab.key} className={visible ? 'block' : 'hidden'} aria-hidden={!visible}>
            <Comp />
          </div>
        );
      })}
      {!ActivePage ? <AdminEmbedLoader label="Opening module…" compact /> : null}
    </div>
  );
}
