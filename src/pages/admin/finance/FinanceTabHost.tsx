import React, { useEffect, useState } from 'react';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import BusinessFinanceStockReportEmbed from '@/pages/admin/finance/BusinessFinanceStockReportEmbed';
import OwnerClientPortfolioReport from '@/pages/admin/finance/OwnerClientPortfolioReport';
import OwnerPersonalWalletReport from '@/pages/admin/finance/OwnerPersonalWalletReport';
import OwnerServiceIncomeReport from '@/pages/admin/finance/OwnerServiceIncomeReport';
import OwnerReceivablesReport from '@/pages/admin/finance/OwnerReceivablesReport';
import OwnerStayhaLoansReport from '@/pages/admin/finance/OwnerStayhaLoansReport';
import {
  isAccountingReportTab,
  isAccountingSettingsTab,
  isClientPortfolioTab,
  isOwnerReceivablesTab,
  isPersonalWalletTab,
  isServiceIncomeTab,
  isStayhaLoansTab,
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
  // Stock module uses BusinessFinanceStockReportEmbed — never the accounting ERP bundle.
  if (activeKey === 'stock') return false;
  if (REPORT_MODULES.has(activeKey as BusinessFinanceModule)) {
    return Boolean(
      embedTab &&
        isAccountingReportTab(embedTab) &&
        !isStockReportTab(embedTab) &&
        !isClientPortfolioTab(embedTab) &&
        !isServiceIncomeTab(embedTab) &&
        !isOwnerReceivablesTab(embedTab) &&
        !isPersonalWalletTab(embedTab) &&
        !isStayhaLoansTab(embedTab),
    );
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
  const [AccountingComp, setAccountingComp] = useState<React.ComponentType | null>(null);

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
  const showClientPortfolioEmbed =
    activeModule === 'receivables' && embedTab && isClientPortfolioTab(embedTab);
  const showServiceIncomeEmbed =
    activeModule === 'receivables' && embedTab && isServiceIncomeTab(embedTab);
  const showOwnerReceivablesEmbed =
    activeModule === 'receivables' && embedTab && isOwnerReceivablesTab(embedTab);
  const showPersonalWalletEmbed = activeModule === 'bank' && embedTab && isPersonalWalletTab(embedTab);
  const showStayhaLoansEmbed = activeModule === 'payables' && embedTab && isStayhaLoansTab(embedTab);
  const showAccountingMain = activeModule === 'accounting' && Boolean(AccountingComp);
  const showAccountStatement = isAccountStatement && Boolean(Page);
  const hasContent =
    showAccountingMain ||
    showAccountingEmbed ||
    showStockEmbed ||
    showClientPortfolioEmbed ||
    showServiceIncomeEmbed ||
    showOwnerReceivablesEmbed ||
    showPersonalWalletEmbed ||
    showStayhaLoansEmbed ||
    showAccountStatement;

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

      {showClientPortfolioEmbed ? (
        <div className="finance-embed-panel">
          <OwnerClientPortfolioReport />
        </div>
      ) : null}

      {showServiceIncomeEmbed ? (
        <div className="finance-embed-panel">
          <OwnerServiceIncomeReport />
        </div>
      ) : null}

      {showOwnerReceivablesEmbed ? (
        <div className="finance-embed-panel">
          <OwnerReceivablesReport />
        </div>
      ) : null}

      {showPersonalWalletEmbed ? (
        <div className="finance-embed-panel">
          <OwnerPersonalWalletReport />
        </div>
      ) : null}

      {showStayhaLoansEmbed ? (
        <div className="finance-embed-panel">
          <OwnerStayhaLoansReport />
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

function FinanceTabHost(props: FinanceTabHostProps) {
  return <FinanceTabHostInner {...props} />;
}

export default React.memo(FinanceTabHost);
