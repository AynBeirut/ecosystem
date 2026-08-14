import React, { useEffect, useState } from 'react';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import BusinessFinanceStockReportEmbed from '@/pages/admin/finance/BusinessFinanceStockReportEmbed';
import {
  isAccountingReportTab,
  isAccountingSettingsTab,
  isStockReportTab,
  type StockReportTab,
} from '@/pages/admin/finance/businessFinanceTabs';
import type { BusinessFinanceModule } from '@/pages/admin/finance/businessFinanceModuleTabs';
import type { BusinessFinanceModuleDef } from '@/pages/admin/finance/businessFinanceModuleTabs';
import {
  getCachedFinancePage,
  loadAccounting,
  loadFinancePage,
  type FinancePageLoader,
} from '@/pages/admin/finance/financeEmbeddedLoaders';
import { useFinanceShellState } from '../../../../vendor/beirut-finance-flow-main/src/context/FinanceShellStateContext';

const REPORT_MODULES = new Set<BusinessFinanceModule>([
  'payables',
  'receivables',
  'bank',
  'assets',
  'reports',
  'stock',
]);

function needsAccountingEmbed(activeKey: string, embedTab: string | null): boolean {
  if (REPORT_MODULES.has(activeKey as BusinessFinanceModule)) {
    return Boolean(embedTab && (isAccountingReportTab(embedTab) || isStockReportTab(embedTab)));
  }
  if (activeKey === 'tools' || activeKey === 'coa') {
    return Boolean(embedTab && isAccountingSettingsTab(embedTab));
  }
  return false;
}

type FinanceTabHostProps = {
  activeModuleDef: BusinessFinanceModuleDef;
  moduleLoaderByKey: Map<BusinessFinanceModule, FinancePageLoader>;
};

function FinanceTabHostInner({ activeModuleDef, moduleLoaderByKey }: FinanceTabHostProps) {
  const { activeFinanceTab: activeModule, reportsEmbedTab, settingsEmbedTab } = useFinanceShellState();

  const [Page, setPage] = useState<React.ComponentType | null>(null);
  const [AccountingComp, setAccountingComp] = useState<React.ComponentType | null>(() =>
    getCachedFinancePage(loadAccounting) ?? null,
  );

  const isHubModule =
    REPORT_MODULES.has(activeModule as BusinessFinanceModule) ||
    activeModule === 'tools' ||
    activeModule === 'coa';
  const isAccountStatement = activeModule === 'account-statement';

  useEffect(() => {
    if (isHubModule || activeModule === 'accounting') {
      setPage(null);
      return;
    }
    const loader = moduleLoaderByKey.get(activeModule as BusinessFinanceModule) ?? activeModuleDef.loader;
    const cached = getCachedFinancePage(loader);
    if (cached) {
      setPage(() => cached);
      return;
    }
    let cancelled = false;
    void loadFinancePage(loader).then((Comp) => {
      if (!cancelled) setPage(() => Comp);
    });
    return () => {
      cancelled = true;
    };
  }, [activeModule, activeModuleDef.loader, isHubModule, moduleLoaderByKey]);

  const embedTab = REPORT_MODULES.has(activeModule as BusinessFinanceModule)
    ? reportsEmbedTab
    : activeModule === 'tools' || activeModule === 'coa'
      ? settingsEmbedTab
      : null;

  const needsEmbed = needsAccountingEmbed(activeModule, embedTab);

  useEffect(() => {
    if (!needsEmbed && activeModule !== 'accounting') return;
    const cached = getCachedFinancePage(loadAccounting);
    if (cached) {
      setAccountingComp(() => cached);
      return;
    }
    let cancelled = false;
    void loadFinancePage(loadAccounting).then((Comp) => {
      if (!cancelled) setAccountingComp(() => Comp);
    });
    return () => {
      cancelled = true;
    };
  }, [activeModule, needsEmbed]);

  const showAccountingEmbed = needsEmbed && Boolean(AccountingComp);
  const showStockEmbed =
    REPORT_MODULES.has(activeModule as BusinessFinanceModule) && embedTab && isStockReportTab(embedTab);
  const showAccountingMain = activeModule === 'accounting' && Boolean(AccountingComp);
  const showAccountStatement = isAccountStatement && Boolean(Page);
  const hasContent = showAccountingMain || showAccountingEmbed || showStockEmbed || showAccountStatement;

  return (
    <div className="finance-tab-host relative min-h-[80px]">
      {showAccountingMain ? (
        <div className="finance-embed-panel">
          <AccountingComp />
        </div>
      ) : null}

      {showAccountStatement && Page ? (
        <div className="finance-embed-panel -mx-1 px-0 border-0 shadow-none bg-transparent">
          {React.createElement(Page, { embedded: true })}
        </div>
      ) : null}

      {showAccountingEmbed && AccountingComp ? (
        <div className="finance-embed-panel">
          <AccountingComp />
        </div>
      ) : null}

      {showStockEmbed ? (
        <div className="finance-embed-panel">
          <BusinessFinanceStockReportEmbed tab={embedTab as StockReportTab} />
        </div>
      ) : null}

      {!hasContent && (isHubModule || isAccountStatement) ? (
        <p className="text-xs text-slate-500 px-1 py-2">Choose a page from the menu above.</p>
      ) : null}

      {activeModule === 'accounting' && !AccountingComp ? (
        <AdminEmbedLoader label="Opening…" compact inline />
      ) : null}
      {isAccountStatement && !Page ? <AdminEmbedLoader label="Opening…" compact inline /> : null}
      {isHubModule && needsEmbed && !AccountingComp ? (
        <AdminEmbedLoader label="Opening…" compact inline />
      ) : null}
    </div>
  );
}

export default function FinanceTabHost(props: FinanceTabHostProps) {
  return <FinanceTabHostInner {...props} />;
}
