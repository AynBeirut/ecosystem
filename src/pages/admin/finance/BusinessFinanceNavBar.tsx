import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FINANCE_MODULE_OPTIONS,
  defaultFinanceSubNavValue,
  financeSubNavLabel,
  financeSubNavOptions,
} from '@/pages/admin/finance/businessFinanceNavConfig';
import type { BusinessFinanceModule } from '@/pages/admin/finance/businessFinanceModuleTabs';
import { useFinanceShellState } from '../../../../vendor/beirut-finance-flow-main/src/context/FinanceShellStateContext';

type Props = {
  activeModule: BusinessFinanceModule;
  accountingTab: string | null;
  storeName?: string;
  onQuickStatement?: () => void;
};

export default function BusinessFinanceNavBar({
  activeModule,
  accountingTab,
  storeName,
  onQuickStatement,
}: Props) {
  const {
    reportsEmbedTab,
    settingsEmbedTab,
    financeReturnUrl,
    setFinanceReturnUrl,
    selectFinanceModule,
    openReport,
    openSetting,
    openAccountingTab,
  } = useFinanceShellState();
  const navigate = useNavigate();

  const subOptions = useMemo(() => financeSubNavOptions(activeModule), [activeModule]);
  const showSubNav = subOptions.length > 0 && activeModule !== 'coa';

  const activeModuleLabel = useMemo(
    () => FINANCE_MODULE_OPTIONS.find((item) => item.value === activeModule)?.label ?? 'Module',
    [activeModule],
  );

  const activeSubValue = useMemo(() => {
    let value = '';
    if (activeModule === 'coa') value = settingsEmbedTab || 'coa';
    else if (activeModule === 'tools') value = settingsEmbedTab || '';
    else if (activeModule === 'accounting') value = accountingTab || 'vouchers';
    else if (['payables', 'receivables', 'bank', 'assets', 'reports', 'stock'].includes(activeModule)) {
      value = reportsEmbedTab || '';
    }
    return value || defaultFinanceSubNavValue(activeModule) || '';
  }, [activeModule, accountingTab, reportsEmbedTab, settingsEmbedTab]);

  const activeSubLabel = financeSubNavLabel(activeModule, activeSubValue || null);

  const handleSubChange = (value: string) => {
    if (activeModule === 'tools' || activeModule === 'coa') {
      openSetting(value);
      return;
    }
    if (activeModule === 'accounting') {
      openAccountingTab(value);
      return;
    }
    openReport(value);
  };

  const handleBack = () => {
    if (reportsEmbedTab === 'general-ledger' && financeReturnUrl) {
      navigate(financeReturnUrl);
      setFinanceReturnUrl(null);
      return;
    }
    navigate('/admin/finance');
  };

  return (
    <div className="finance-compact-nav finance-compact-nav--single-row" aria-label="Business Finance navigation">
      <button
        type="button"
        title="Back"
        aria-label="Back"
        className="finance-compact-nav__back"
        onClick={handleBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      </button>

      <div className="finance-compact-nav__trail">
        {storeName ? (
          <>
            <span className="finance-compact-nav__store" title={storeName}>
              {storeName}
            </span>
            <span className="finance-compact-nav__dot" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <span className="finance-compact-nav__title" title="Business Finance">
          B.F.
        </span>
        <span className="finance-compact-nav__dot" aria-hidden>
          ·
        </span>
        <Select value={activeModule} onValueChange={(value) => selectFinanceModule(value)}>
          <SelectTrigger className="finance-compact-nav__select finance-compact-nav__select--module finance-compact-nav__select--inline">
            <SelectValue>{activeModuleLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent className="finance-compact-nav__menu">
            {FINANCE_MODULE_OPTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value} className="finance-compact-nav__menu-item">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showSubNav ? (
          <>
            <span className="finance-compact-nav__dot" aria-hidden>
              ·
            </span>
            <Select value={activeSubValue || undefined} onValueChange={handleSubChange}>
              <SelectTrigger className="finance-compact-nav__select finance-compact-nav__select--page finance-compact-nav__select--inline">
                <SelectValue>{activeSubLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="finance-compact-nav__menu max-h-[min(24rem,70vh)]">
                {(() => {
                  const grouped = new Map<string, typeof subOptions>();
                  for (const item of subOptions) {
                    const key = item.group ?? '';
                    const list = grouped.get(key) ?? [];
                    list.push(item);
                    grouped.set(key, list);
                  }
                  const entries = [...grouped.entries()];
                  if (entries.length === 1 && !entries[0][0]) {
                    return subOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value} className="finance-compact-nav__menu-item">
                        {item.label}
                      </SelectItem>
                    ));
                  }
                  return entries.map(([group, items]) => (
                    <SelectGroup key={group || 'default'}>
                      {group ? <SelectLabel className="finance-compact-nav__menu-label">{group}</SelectLabel> : null}
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value} className="finance-compact-nav__menu-item">
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ));
                })()}
              </SelectContent>
            </Select>
          </>
        ) : null}
      </div>

      {onQuickStatement ? (
        <button
          type="button"
          className="finance-compact-nav__quick-soa shrink-0"
          onClick={onQuickStatement}
          title="Quick statement of account"
        >
          Quick statement
        </button>
      ) : null}
    </div>
  );
}
