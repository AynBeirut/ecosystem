import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '@/embed/wireFinanceOnLoad';
import FinanceAppBridge from '@/embed/FinanceAppBridge';
import { wireFinanceFirebaseFromGrabio } from '@/embed/financeFirebaseBridge';
import FinanceInvoiceModuleGate from '@/components/finance/FinanceInvoiceModuleGate';
import { useStoreEntitlements } from '@/hooks/useStoreEntitlements';
import FinanceTabHost from '@/pages/admin/finance/FinanceTabHost';
import BusinessFinanceNavBar from '@/pages/admin/finance/BusinessFinanceNavBar';
import { useFinanceStoreLabel } from '@/pages/admin/finance/useFinanceStoreLabel';
import {
  FINANCE_PAGE_LOADERS,
  loadAccounting,
  loadFinancePage,
  preloadFinancePages,
} from '@/pages/admin/finance/financeEmbeddedLoaders';
import {
  isAccountingPrimaryTab,
  isAccountingReportTab,
  isAccountingSettingsTab,
  isStockReportTab,
} from '@/pages/admin/finance/businessFinanceTabs';
import {
  type BusinessFinanceModule,
  BUSINESS_FINANCE_MODULE_DEFS,
  businessFinanceModuleForReport,
  businessFinanceModuleFromPath,
  businessFinanceModulePath,
} from '@/pages/admin/finance/businessFinanceModuleTabs';
import {
  defaultFinanceSubNavValue,
  isFinanceReportSubNavValue,
  isFinanceSettingSubNavValue,
} from '@/pages/admin/finance/businessFinanceNavConfig';
import { FinanceShellStateProvider } from '../../../../vendor/beirut-finance-flow-main/src/context/FinanceShellStateContext';
import QuickStatementDialog from '../../../../vendor/beirut-finance-flow-main/src/components/QuickStatementDialog';

const REPORT_HUB_MODULES = new Set<BusinessFinanceModule>([
  'payables',
  'receivables',
  'bank',
  'assets',
  'reports',
  'stock',
]);

function readEmbedTabs(search: string): {
  report: string | null;
  setting: string | null;
} {
  const params = new URLSearchParams(search);
  const legacyTab = params.get('tab');
  const reportParam = params.get('report');
  let report: string | null = reportParam;
  if (!report && legacyTab && (isAccountingReportTab(legacyTab) || isStockReportTab(legacyTab))) {
    report = legacyTab;
  }
  const settingParam = params.get('setting');
  let setting: string | null = settingParam;
  if (!setting && legacyTab && isAccountingSettingsTab(legacyTab)) {
    setting = legacyTab;
  }
  return { report, setting };
}

const FinanceModuleShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useStoreEntitlements();
  const accent = profile?.templateColors?.primary ?? '#38B2AC';
  const storeName = useFinanceStoreLabel();

  const [activeModule, setActiveModule] = useState<BusinessFinanceModule>(() =>
    businessFinanceModuleFromPath(location.pathname),
  );
  const [reportsEmbedTab, setReportsEmbedTab] = useState<string | null>(() => {
    const { report } = readEmbedTabs(location.search);
    return report;
  });
  const [settingsEmbedTab, setSettingsEmbedTab] = useState<string | null>(() => {
    const { setting } = readEmbedTabs(location.search);
    return setting && isAccountingSettingsTab(setting) ? setting : null;
  });
  const [accountingEmbedTab, setAccountingEmbedTab] = useState<string | null>(() => {
    if (!location.pathname.startsWith('/admin/finance/accounting')) return null;
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && isAccountingPrimaryTab(tab)) return tab;
    return 'vouchers';
  });
  const [quickStatementOpen, setQuickStatementOpen] = useState(false);
  const [financeReturnUrl, setFinanceReturnUrl] = useState<string | null>(null);

  const openQuickStatement = useCallback(() => setQuickStatementOpen(true), []);

  useEffect(() => {
    wireFinanceFirebaseFromGrabio();
    void loadFinancePage(loadAccounting);
    preloadFinancePages(FINANCE_PAGE_LOADERS);
  }, []);

  const navigateModule = useCallback(
    (module: BusinessFinanceModule, search = '', options?: { replace?: boolean }) => {
      const path = `${businessFinanceModulePath(module)}${search}`;
      const current = `${location.pathname}${location.search}`;
      if (current !== path) {
        const sameModule = businessFinanceModuleFromPath(location.pathname) === module;
        const replace = options?.replace ?? !sameModule;
        navigate(path, { replace, preventScrollReset: true });
      }
    },
    [location.pathname, location.search, navigate],
  );

  const openAccountingTab = useCallback(
    (tab: string) => {
      setAccountingEmbedTab(tab);
      setActiveModule('accounting');
      navigateModule('accounting', `?tab=${encodeURIComponent(tab)}`);
    },
    [navigateModule],
  );

  const openReport = useCallback(
    (reportTab: string) => {
      const module = businessFinanceModuleForReport(reportTab);
      setReportsEmbedTab(reportTab);
      setActiveModule(module);
      if (reportTab !== 'general-ledger') {
        setFinanceReturnUrl(null);
      }
      const params = new URLSearchParams();
      params.set('report', reportTab);
      if (reportTab === 'general-ledger') {
        const current = new URLSearchParams(location.search);
        const partyName = current.get('partyName');
        const partyType = current.get('partyType');
        if (partyName) params.set('partyName', partyName);
        if (partyType) params.set('partyType', partyType);
      }
      navigateModule(module, `?${params.toString()}`);
    },
    [location.search, navigateModule],
  );

  const openSetting = useCallback(
    (settingTab: string) => {
      setSettingsEmbedTab(settingTab);
      const module = settingTab === 'coa' ? 'coa' : 'tools';
      setActiveModule(module);
      const params = new URLSearchParams();
      params.set('setting', settingTab);
      navigateModule(module, `?${params.toString()}`);
    },
    [navigateModule],
  );

  const selectFinanceModule = useCallback(
    (key: string) => {
      const queryIndex = key.indexOf('?');
      const moduleKey = (queryIndex >= 0 ? key.slice(0, queryIndex) : key) as BusinessFinanceModule;
      const query = queryIndex >= 0 ? key.slice(queryIndex) : '';

      if (moduleKey === 'account-statement') {
        setActiveModule(moduleKey);
        navigateModule(moduleKey, query);
        return;
      }
      if (moduleKey === 'coa') {
        openSetting('coa');
        return;
      }
      if (moduleKey === 'accounting') {
        openAccountingTab('vouchers');
        return;
      }

      const defaultSub = defaultFinanceSubNavValue(moduleKey);
      if (defaultSub && isFinanceSettingSubNavValue(defaultSub)) {
        openSetting(defaultSub);
        return;
      }
      if (defaultSub && isFinanceReportSubNavValue(defaultSub)) {
        openReport(defaultSub);
        return;
      }
      if (defaultSub && isAccountingPrimaryTab(defaultSub)) {
        openAccountingTab(defaultSub);
        return;
      }

      setActiveModule(moduleKey);
      navigateModule(moduleKey, query);
    },
    [navigateModule, openAccountingTab, openReport, openSetting],
  );

  const openDocument = useCallback(() => {
    /* Documents moved to Invoice Manager */
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const legacyTab = params.get('tab');

    if (location.pathname.startsWith('/admin/finance/accounting') && legacyTab) {
      if (isAccountingReportTab(legacyTab) || isStockReportTab(legacyTab)) {
        openReport(legacyTab);
        return;
      }
      if (isAccountingSettingsTab(legacyTab)) {
        if (legacyTab === 'coa') {
          setActiveModule('coa');
          setSettingsEmbedTab('coa');
          navigateModule('coa', '?setting=coa');
          return;
        }
        openSetting(legacyTab);
        return;
      }
    }

    const module = businessFinanceModuleFromPath(location.pathname);
    setActiveModule(module);

    const report = params.get('report');
    if (report && (isAccountingReportTab(report) || isStockReportTab(report))) {
      setReportsEmbedTab(report);
    } else if (REPORT_HUB_MODULES.has(module)) {
      const defaultReport = defaultFinanceSubNavValue(module);
      if (defaultReport && isFinanceReportSubNavValue(defaultReport)) {
        setReportsEmbedTab(defaultReport);
        navigateModule(module, `?report=${encodeURIComponent(defaultReport)}`);
        return;
      }
      setReportsEmbedTab(null);
    }

    const setting = params.get('setting');
    if (setting && isAccountingSettingsTab(setting)) {
      setSettingsEmbedTab(setting);
      if (setting === 'coa' && location.pathname.startsWith('/admin/finance/coa')) {
        setActiveModule('coa');
      }
    } else if (location.pathname.startsWith('/admin/finance/coa')) {
      setSettingsEmbedTab('coa');
      setActiveModule('coa');
    } else if (
      location.pathname.startsWith('/admin/finance/tools') &&
      params.get('setting') === 'coa'
    ) {
      navigate('/admin/finance/coa?setting=coa', { replace: true });
      return;
    } else if (module === 'tools') {
      const defaultSetting = defaultFinanceSubNavValue('tools');
      if (defaultSetting && isFinanceSettingSubNavValue(defaultSetting)) {
        setSettingsEmbedTab(defaultSetting);
        navigateModule('tools', `?setting=${encodeURIComponent(defaultSetting)}`);
        return;
      }
    }

    if (location.pathname.startsWith('/admin/finance/accounting')) {
      const tab = params.get('tab');
      if (tab && isAccountingPrimaryTab(tab)) {
        setAccountingEmbedTab(tab);
      } else if (!tab) {
        setAccountingEmbedTab('vouchers');
        navigateModule('accounting', '?tab=vouchers');
        return;
      }
    }
  }, [location.pathname, location.search, navigate, navigateModule, openReport, openSetting]);

  const activeModuleDef = useMemo(
    () =>
      BUSINESS_FINANCE_MODULE_DEFS.find((item) => item.key === activeModule) ??
      BUSINESS_FINANCE_MODULE_DEFS[0],
    [activeModule],
  );

  const moduleLoaderByKey = useMemo(
    () => new Map(BUSINESS_FINANCE_MODULE_DEFS.map((item) => [item.key, item.loader])),
    [],
  );

  return (
    <FinanceInvoiceModuleGate variant="finance">
      <FinanceShellStateProvider
        activeFinanceTab={activeModule}
        reportsEmbedTab={reportsEmbedTab}
        setReportsEmbedTab={setReportsEmbedTab}
        settingsEmbedTab={settingsEmbedTab}
        setSettingsEmbedTab={setSettingsEmbedTab}
        documentEmbedTab={null}
        setDocumentEmbedTab={() => undefined}
        financeReturnUrl={financeReturnUrl}
        setFinanceReturnUrl={setFinanceReturnUrl}
        selectFinanceModule={selectFinanceModule}
        openReport={openReport}
        openSetting={openSetting}
        openDocument={openDocument}
        openAccountingTab={openAccountingTab}
        accountingEmbedTab={accountingEmbedTab}
        openQuickStatement={openQuickStatement}
      >
        <div
          className="finance-embed-theme finance-module-shell space-y-2"
          style={{ '--finance-accent': accent } as React.CSSProperties}
        >
          <BusinessFinanceNavBar
            activeModule={activeModule}
            accountingTab={accountingEmbedTab}
            storeName={storeName}
            onQuickStatement={openQuickStatement}
          />
          <FinanceAppBridge>
            <QuickStatementDialog open={quickStatementOpen} onOpenChange={setQuickStatementOpen} />
            <FinanceTabHost activeModuleDef={activeModuleDef} moduleLoaderByKey={moduleLoaderByKey} />
          </FinanceAppBridge>
        </div>
      </FinanceShellStateProvider>
    </FinanceInvoiceModuleGate>
  );
};

export default FinanceModuleShell;
