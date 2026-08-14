import React, { createContext, useContext, useMemo } from "react";

export type FinanceShellStateContextValue = {
  activeFinanceTab: string;
  reportsEmbedTab: string | null;
  setReportsEmbedTab: (tab: string | null) => void;
  settingsEmbedTab: string | null;
  setSettingsEmbedTab: (tab: string | null) => void;
  documentEmbedTab: string | null;
  setDocumentEmbedTab: (tab: string | null) => void;
  financeReturnUrl: string | null;
  setFinanceReturnUrl: (url: string | null) => void;
  selectFinanceModule: (module: string) => void;
  openReport: (reportTab: string) => void;
  openSetting: (settingTab: string) => void;
  openDocument: (documentTab: string) => void;
  openAccountingTab: (tab: string) => void;
  accountingEmbedTab: string | null;
  openQuickStatement: () => void;
};

const noop = () => undefined;

const FinanceShellStateContext = createContext<FinanceShellStateContextValue>({
  activeFinanceTab: "",
  reportsEmbedTab: null,
  setReportsEmbedTab: noop,
  settingsEmbedTab: null,
  setSettingsEmbedTab: noop,
  documentEmbedTab: null,
  setDocumentEmbedTab: noop,
  financeReturnUrl: null,
  setFinanceReturnUrl: noop,
  selectFinanceModule: noop,
  openReport: noop,
  openSetting: noop,
  openDocument: noop,
  openAccountingTab: noop,
  accountingEmbedTab: null,
  openQuickStatement: noop,
});

export function FinanceShellStateProvider({
  activeFinanceTab,
  reportsEmbedTab,
  setReportsEmbedTab,
  settingsEmbedTab,
  setSettingsEmbedTab,
  documentEmbedTab,
  setDocumentEmbedTab,
  financeReturnUrl,
  setFinanceReturnUrl,
  selectFinanceModule,
  openReport,
  openSetting,
  openDocument,
  openAccountingTab,
  accountingEmbedTab,
  openQuickStatement,
  children,
}: {
  activeFinanceTab: string;
  reportsEmbedTab: string | null;
  setReportsEmbedTab: (tab: string | null) => void;
  settingsEmbedTab: string | null;
  setSettingsEmbedTab: (tab: string | null) => void;
  documentEmbedTab: string | null;
  setDocumentEmbedTab: (tab: string | null) => void;
  financeReturnUrl: string | null;
  setFinanceReturnUrl: (url: string | null) => void;
  selectFinanceModule: (module: string) => void;
  openReport: (reportTab: string) => void;
  openSetting: (settingTab: string) => void;
  openDocument: (documentTab: string) => void;
  openAccountingTab: (tab: string) => void;
  accountingEmbedTab: string | null;
  openQuickStatement: () => void;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      activeFinanceTab,
      reportsEmbedTab,
      setReportsEmbedTab,
      settingsEmbedTab,
      setSettingsEmbedTab,
      documentEmbedTab,
      setDocumentEmbedTab,
      financeReturnUrl,
      setFinanceReturnUrl,
      selectFinanceModule,
      openReport,
      openSetting,
      openDocument,
      openAccountingTab,
      accountingEmbedTab,
      openQuickStatement,
    }),
    [
      activeFinanceTab,
      reportsEmbedTab,
      setReportsEmbedTab,
      settingsEmbedTab,
      setSettingsEmbedTab,
      documentEmbedTab,
      setDocumentEmbedTab,
      financeReturnUrl,
      setFinanceReturnUrl,
      selectFinanceModule,
      openReport,
      openSetting,
      openDocument,
      openAccountingTab,
      accountingEmbedTab,
      openQuickStatement,
    ],
  );
  return (
    <FinanceShellStateContext.Provider value={value}>{children}</FinanceShellStateContext.Provider>
  );
}

export function useFinanceShellState() {
  return useContext(FinanceShellStateContext);
}
