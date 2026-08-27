import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import FinancePageShell from "@/components/FinancePageShell";
import { useAppContext } from "@/context/AppContext";
import { useAccounting } from "@/context/AccountingContext";
import { useLedger } from "@/context/LedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Scale, Plus, RefreshCw, CheckCircle2, AlertTriangle, Lock, Unlock, FileSpreadsheet, Layers, FileText, Receipt, TrendingUp, TrendingDown, Wallet, Calculator, Landmark, GitCompare, CalendarRange, PieChart, Repeat, Building2, ChevronDown, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";
import type { JournalEntry, JournalLine, JournalLineInput, LedgerPeriodClosure, PeriodLockType, VoucherMeta, VoucherType } from "@/types/generalLedger";
import { lebaneseGlLookupCodes, tbBalanceForCodes } from "@/lib/ledger/reconciliation";
import { buildVatFilingSummary, vatFilingSummaryToCsv } from "@/lib/ledger/vatFilingSummary";
import { buildLebanonVatReturnForm } from "@/lib/ledger/lebanonVatReturnForm";
import { buildLebanonR10FormFromGl } from "@/lib/ledger/lebanonR10Form";
import { buildLebanonCnss190AFormFromGl } from "@/lib/ledger/lebanonCnss190AForm";
import { vatFilingMofWorksheet } from "@/lib/ledger/vatFilingMofExport";
import { normalizeDateRange } from "@/lib/reportPeriodPresets";
import { currentVatQuarter, quarterBounds } from "@/lib/ledger/lebanonVatQuarterPeriod";
import LebanonVatReturnFormPanel from "@/components/LebanonVatReturnFormPanel";
import LebanonR10FormPanel from "@/components/LebanonR10FormPanel";
import LebanonCnss190AFormPanel from "@/components/LebanonCnss190AFormPanel";
import CustomDateRangeToolbar from "@/components/CustomDateRangeToolbar";
import { buildIncomeStatement, incomeStatementToCsv } from "@/lib/ledger/incomeStatement";
import { lebanesePlHasActivity } from "@/lib/ledger/lebaneseProfitLoss";
import LebaneseProfitLossDocument from "@/components/LebaneseProfitLossDocument";
import {
  AGED_RECEIVABLES_BUCKET_LABELS,
  agedReceivablesToCsv,
  buildAgedReceivablesReport,
} from "@/lib/ledger/agedReceivables";
import {
  AGED_PAYABLES_BUCKET_LABELS,
  agedPayablesToCsv,
  buildAgedPayablesReport,
} from "@/lib/ledger/agedPayables";
import {
  buildCashFlowStatement,
  cashFlowStatementToCsv,
} from "@/lib/ledger/cashFlowStatement";
import { buildDepreciationRunPreview } from "@/lib/ledger/depreciationSchedule";
import { postMonthlyDepreciation } from "@/lib/ledger/depreciationPosting";
import {
  createFixedAsset,
  loadFixedAssets,
} from "@/lib/firestore/fixedAssetsFirestore";
import type { FixedAsset } from "@/types/generalLedger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSystemGuide } from "@/hooks/useSystemGuide";
import SystemGuideInfo from "@/components/SystemGuideInfo";
import SystemGuideBanner from "@/components/SystemGuideBanner";
import VoucherEntryPanel from "@/components/VoucherEntryPanel";
import AddLedgerAccountDialog from "@/components/AddLedgerAccountDialog";
import BankReconciliationPanel from "@/components/BankReconciliationPanel";
import ReconciliationPanel from "@/components/ReconciliationPanel";
import { getFinanceAuth } from "@/integrations/firebase/client";
import { useGrabioStore } from "@/hooks/useGrabioStore";
import {
  normalizeAccountingLanguage,
  supportsArabicEntry,
} from "@/lib/grabio/accountingMode";
import { updateLedgerAccountNames } from "@/lib/firestore/ledgerFirestore";
import LebanesePcgCoaPanel from "@/components/LebanesePcgCoaPanel";
import PcgClientAccountsPanel from "@/components/PcgClientAccountsPanel";
import { PcgMappedCodeBadge } from "@/components/PcgMappedAccountCell";
import { buildClientByGrabioMap, buildClientByParentPcgMap, resolvePcgDisplay, formatPcgAccountLabel, formatGlAccountReference, remapCashFlowLineLabel, displayPcgCode, displayPcgCodeForLedgerRow, displayGrabioCodeForLedgerRow } from "@/lib/ledger/grabioToPcgMap";
import { loadPcgClientAccounts } from "@/lib/firestore/pcgClientAccountsFirestore";
import { LEDGER_CHANGED_EVENT } from "@/lib/ledger/ledgerChanged";
import type { PcgClientAccount } from "@/types/generalLedger";
import type { LebanesePcgAccount } from "@/lib/ledger/lebanesePcgChart.generated";
import AccountantWorkspacePanel from "@/components/AccountantWorkspacePanel";
import LedgerActivityDialog from "@/components/LedgerActivityDialog";
import { LedgerAccountCombobox } from "@/components/LedgerAccountCombobox";
import VoucherDetailDialog from "@/components/VoucherDetailDialog";
import AccountingQuickBar from "@/components/AccountingQuickBar";
import AccountingCommandPalette from "@/components/AccountingCommandPalette";
import FxRevaluationPanel from "@/components/FxRevaluationPanel";
import YearEndClosePanel from "@/components/YearEndClosePanel";
import CostCentersPanel from "@/components/CostCentersPanel";
import RecurringVouchersPanel from "@/components/RecurringVouchersPanel";
import CheckRegisterPanel from "@/components/CheckRegisterPanel";
import PartyStatementPanel from "@/components/PartyStatementPanel";
import GeneralLedgerPanel from "@/components/GeneralLedgerPanel";
import BulkVoucherImportPanel from "@/components/BulkVoucherImportPanel";
import { loadSettlements, saveSettlementsForEntry } from "@/lib/firestore/settlementFirestore";
import TrialBalancePanel from "@/components/TrialBalancePanel";
import { buildExtendedTrialBalance, extendedTrialBalanceToCsv } from "@/lib/ledger/trialBalanceExtended";
import {
  buildR10SalaryWithholdingReport,
  buildCnssSummaryReport,
  r10ReportToCsv,
  cnssReportToCsv,
} from "@/lib/ledger/lebaneseTaxReports";
import { downloadCsvText } from "@/lib/csvExport";
import { downloadXlsxFromCsv } from "@/lib/xlsxExport";
import type { SettlementAllocationInput, VoucherLineSettlement } from "@/types/generalLedger";
import type { LedgerActivityFocus } from "@/lib/ledger/ledgerActivity";
import { consumeLedgerFocus } from "@/lib/ledger/ledgerActivity";
import { parseJournalDateInput, resolveFiscalQuarterForDate } from "@/lib/ledger/periodLockCore";
import { useFinanceEmbed } from "@/context/FinanceEmbedContext";
import { useFinanceShellState } from "@/context/FinanceShellStateContext";

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

type AccountingTabDef = {
  value: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  tone: string;
};

const ACCOUNTING_PRIMARY_TABS = new Set(["vouchers", "workspace", "party-soa"]);

const ACCOUNTING_REPORT_TABS = new Set([
  "trial-balance",
  "balance-sheet",
  "profit-loss",
  "depreciation",
  "reconciliation",
  "general-ledger",
  "party-soa",
  "vat-filing",
  "ar-aging",
  "ap-aging",
  "cash-flow",
  "bank-rec",
  "tax-reports",
]);

const ACCOUNTING_SETTINGS_TABS = new Set([
  "coa",
  "opening",
  "fx-revaluation",
  "cost-centers",
  "bulk-import",
  "recurring",
  "checks",
  "year-end-close",
]);

const STOCK_REPORT_TABS = new Set(["sales", "purchases", "inventory", "products"]);

function tabBackLink(tab: string): { to: string; label: string } {
  if (ACCOUNTING_REPORT_TABS.has(tab)) {
    const module =
      tab === "ap-aging" || tab === "purchases"
        ? "payables"
        : tab === "ar-aging" || tab === "sales"
          ? "receivables"
          : tab === "bank-rec" || tab === "cash-flow"
            ? "bank"
            : tab === "depreciation"
              ? "assets"
              : "reports";
    return { to: `/admin/finance/${module}?report=${encodeURIComponent(tab)}`, label: "Back" };
  }
  if (STOCK_REPORT_TABS.has(tab)) {
    return { to: `/admin/finance/stock?report=${encodeURIComponent(tab)}`, label: "Back" };
  }
  if (ACCOUNTING_SETTINGS_TABS.has(tab)) {
    if (tab === "coa") {
      return { to: "/admin/finance/coa?setting=coa", label: "Back" };
    }
    return { to: `/admin/finance/tools?setting=${encodeURIComponent(tab)}`, label: "Back" };
  }
  return { to: "/admin/finance/accounting", label: "Back to Accounting" };
}

/** All tabs (for command palette labels only — not shown as tab bar). */
const ACCOUNTING_TAB_ROWS: AccountingTabDef[][] = [
  [
    { value: "vouchers", label: "Vouchers (JV/PV/RV/CV)", shortLabel: "Vouchers", icon: FileText, tone: "violet" },
    { value: "workspace", label: "Workspace", icon: BookOpen, tone: "emerald" },
    { value: "coa", label: "Chart of Accounts", shortLabel: "COA", icon: Layers, tone: "blue" },
    { value: "party-soa", label: "Party SOA", icon: FileText, tone: "blue" },
    { value: "general-ledger", label: "GL Report", icon: Layers, tone: "indigo" },
    { value: "trial-balance", label: "Trial Balance", icon: Scale, tone: "indigo" },
    { value: "balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet, tone: "teal" },
  ],
  [
    { value: "profit-loss", label: "P&L", icon: PieChart, tone: "green" },
    { value: "vat-filing", label: "VAT Filing", icon: Receipt, tone: "amber" },
    { value: "ar-aging", label: "AR Aging", icon: TrendingUp, tone: "emerald" },
    { value: "ap-aging", label: "AP Aging", icon: TrendingDown, tone: "orange" },
    { value: "cash-flow", label: "Cash Flow", icon: Wallet, tone: "cyan" },
    { value: "depreciation", label: "Depreciation", icon: Calculator, tone: "rose" },
    { value: "reconciliation", label: "Reconciliation", icon: GitCompare, tone: "purple" },
  ],
  [
    { value: "bank-rec", label: "Bank Rec", icon: Landmark, tone: "slate" },
    { value: "opening", label: "Opening Balances", shortLabel: "Opening", icon: CalendarRange, tone: "sky" },
    { value: "fx-revaluation", label: "FX Reval", icon: RefreshCw, tone: "amber" },
    { value: "tax-reports", label: "Tax (R10/CNSS)", icon: Receipt, tone: "rose" },
    { value: "recurring", label: "Recurring", icon: Repeat, tone: "violet" },
    { value: "checks", label: "Checks", icon: FileText, tone: "orange" },
    { value: "cost-centers", label: "Cost Centers", icon: Building2, tone: "slate" },
    { value: "bulk-import", label: "Bulk Import", icon: FileSpreadsheet, tone: "cyan" },
    { value: "year-end-close", label: "Year-end Close", shortLabel: "Close", icon: CalendarRange, tone: "rose" },
  ],
];

const Accounting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, invoices, purchaseOrders, paymentOrders, expenses, activeOrganizationId, recordInvoicePayment } = useAppContext();
  const { embedded } = useFinanceEmbed();
  const { activeFinanceTab, reportsEmbedTab, settingsEmbedTab, openReport, openSetting, openQuickStatement, setFinanceReturnUrl } =
    useFinanceShellState();
  const isReportsEmbed =
    embedded &&
    ['reports', 'payables', 'receivables', 'bank', 'assets', 'stock'].includes(activeFinanceTab) &&
    Boolean(reportsEmbedTab) &&
    (ACCOUNTING_REPORT_TABS.has(reportsEmbedTab) || STOCK_REPORT_TABS.has(reportsEmbedTab));
  const isSettingsEmbed =
    embedded &&
    Boolean(settingsEmbedTab) &&
    (activeFinanceTab === 'tools' || activeFinanceTab === 'coa');
  const isHubEmbed = isReportsEmbed || isSettingsEmbed;
  const { profile, storeId: grabioStoreId } = useGrabioStore();
  const financeStoreId = grabioStoreId || activeOrganizationId || "";
  const accountingLanguage = normalizeAccountingLanguage(
    profile?.accountingLanguage,
    profile?.accountingMode,
  );
  const arabicEntry = supportsArabicEntry(accountingLanguage);
  const isLebaneseCoa = profile?.accountingMode === "lebanese";
  const { cashBalance } = useAccounting();
  const { enabled: systemGuideEnabled } = useSystemGuide();
  const {
    loading,
    accounts,
    entries,
    lines,
    asOfDate,
    setAsOfDate,
    trialBalance,
    balanceSheet,
    ensureCoa,
    refreshLedger,
    postVoucherEntry,
    postAdjustmentEntry,
    postDraftVoucher,
    reverseEntry,
    setOpeningBalance,
    accountsById,
    periodClosures,
    asOfPeriod,
    asOfPeriodLocked,
    isDateLocked,
    closePeriod,
    reopenPeriod,
  } = useLedger();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodLockType>("quarter");
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1);
  const [periodQuarter, setPeriodQuarter] = useState(() => {
    try {
      return resolveFiscalQuarterForDate(new Date().toISOString().slice(0, 10)).quarter;
    } catch {
      return Math.floor(new Date().getMonth() / 3) + 1;
    }
  });
  const [closeNote, setCloseNote] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenTargetId, setReopenTargetId] = useState("");
  const [periodActionLoading, setPeriodActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("vouchers");
  const [searchParams] = useSearchParams();

  const isDeepLinkView =
    !embedded &&
    !isHubEmbed &&
    (ACCOUNTING_REPORT_TABS.has(activeTab) || ACCOUNTING_SETTINGS_TABS.has(activeTab));
  const isPrimaryView = !isDeepLinkView && !isHubEmbed;

  const selectPrimaryTab = useCallback((tab: "vouchers" | "workspace" | "party-soa") => {
    setActiveTab(tab);
  }, []);

  const goToTab = useCallback(
    (tab: string) => {
      if (ACCOUNTING_PRIMARY_TABS.has(tab)) {
        selectPrimaryTab(tab as "vouchers" | "workspace" | "party-soa");
        return;
      }
      if (embedded && ACCOUNTING_REPORT_TABS.has(tab)) {
        openReport(tab);
        return;
      }
      if (embedded && ACCOUNTING_SETTINGS_TABS.has(tab)) {
        openSetting(tab);
        return;
      }
      if (isReportsEmbed && ACCOUNTING_REPORT_TABS.has(tab)) {
        openReport(tab);
        return;
      }
      if (isSettingsEmbed && ACCOUNTING_SETTINGS_TABS.has(tab)) {
        openSetting(tab);
        return;
      }
      navigate(`/admin/finance/accounting?tab=${encodeURIComponent(tab)}`);
      setActiveTab(tab);
    },
    [embedded, isReportsEmbed, isSettingsEmbed, navigate, openReport, openSetting, selectPrimaryTab],
  );

  const navigateFromQuickBar = useCallback(
    (tab: string) => {
      if (embedded && ACCOUNTING_REPORT_TABS.has(tab)) {
        openReport(tab);
        return;
      }
      if (embedded && ACCOUNTING_SETTINGS_TABS.has(tab)) {
        openSetting(tab);
        return;
      }
      const reportOrSettings =
        ACCOUNTING_REPORT_TABS.has(tab) || ACCOUNTING_SETTINGS_TABS.has(tab);
      if (isReportsEmbed && ACCOUNTING_REPORT_TABS.has(tab)) {
        openReport(tab);
        return;
      }
      if (isSettingsEmbed && ACCOUNTING_SETTINGS_TABS.has(tab)) {
        openSetting(tab);
        return;
      }
      if (reportOrSettings) {
        navigate(`/admin/finance/accounting?tab=${encodeURIComponent(tab)}`);
        setActiveTab(tab);
        return;
      }
      goToTab(tab);
    },
    [embedded, goToTab, isReportsEmbed, isSettingsEmbed, navigate, openReport, openSetting],
  );
  const [posting, setPosting] = useState(false);
  const [openingAccountId, setOpeningAccountId] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [coaEditAccountId, setCoaEditAccountId] = useState("");
  const [coaEditNameAr, setCoaEditNameAr] = useState("");
  const [coaEditSaving, setCoaEditSaving] = useState(false);
  const [pcgClientAccounts, setPcgClientAccounts] = useState<PcgClientAccount[]>([]);
  const [pcgPrefillAccount, setPcgPrefillAccount] = useState<LebanesePcgAccount | null>(null);
  const [pcgPrefillKey, setPcgPrefillKey] = useState(0);
  const [coaWorkingOpen, setCoaWorkingOpen] = useState(false);
  const [coaAddOpen, setCoaAddOpen] = useState(false);
  const [voucherEditPrefill, setVoucherEditPrefill] = useState<{ entry: JournalEntry; lines: JournalLine[] } | null>(null);
  const [glPresetAccountId, setGlPresetAccountId] = useState("");
  const [ledgerFocus, setLedgerFocus] = useState<LedgerActivityFocus | null>(null);
  const [quickVoucherEntryId, setQuickVoucherEntryId] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settlements, setSettlements] = useState<VoucherLineSettlement[]>([]);
  const [tbStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [postingDraft, setPostingDraft] = useState(false);
  const [reversing, setReversing] = useState(false);

  const accountingPaletteTabs = useMemo(
    () => ACCOUNTING_TAB_ROWS.flat().map(({ value, label, icon }) => ({ value, label, icon })),
    [],
  );

  const openAccountActivity = useCallback((accountId: string, label: string) => {
    setLedgerFocus({ kind: "account", accountId, label });
  }, []);

  const openAccountDrill = useCallback(
    (accountId: string) => {
      setGlPresetAccountId(accountId);
      if (isReportsEmbed && reportsEmbedTab && reportsEmbedTab !== 'general-ledger') {
        setFinanceReturnUrl(`${location.pathname}${location.search}`);
      }
      navigateFromQuickBar("general-ledger");
    },
    [isReportsEmbed, location.pathname, location.search, navigateFromQuickBar, reportsEmbedTab, setFinanceReturnUrl],
  );

  const openClientVouchers = useCallback((clientId: string | undefined, clientName: string) => {
    setLedgerFocus({
      kind: "client",
      clientId,
      clientName,
      label: `Client · ${clientName}`,
    });
  }, []);

  const openSupplierVouchers = useCallback((supplierId: string | undefined, supplierName: string) => {
    setLedgerFocus({
      kind: "supplier",
      supplierId,
      supplierName,
      label: `Supplier · ${supplierName}`,
    });
  }, []);

  const quickVoucherEntry = useMemo(
    () => entries.find((entry) => entry.id === quickVoucherEntryId) || null,
    [entries, quickVoucherEntryId],
  );

  const clientByGrabio = useMemo(
    () => buildClientByGrabioMap(pcgClientAccounts),
    [pcgClientAccounts],
  );
  const clientByParentPcg = useMemo(
    () => buildClientByParentPcgMap(pcgClientAccounts),
    [pcgClientAccounts],
  );

  useEffect(() => {
    if (!isLebaneseCoa || !financeStoreId) {
      setPcgClientAccounts([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void loadPcgClientAccounts(financeStoreId).then((rows) => {
        if (!cancelled) setPcgClientAccounts(rows);
      });
    };
    load();
    window.addEventListener(LEDGER_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(LEDGER_CHANGED_EVENT, load);
    };
  }, [isLebaneseCoa, financeStoreId]);

  useEffect(() => {
    if (!financeStoreId) {
      setSettlements([]);
      return;
    }
    let cancelled = false;
    void loadSettlements(financeStoreId).then((rows) => {
      if (!cancelled) setSettlements(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [financeStoreId, entries.length]);

  const extendedTrialBalance = useMemo(
    () =>
      buildExtendedTrialBalance(accounts, entries, lines, {
        startDate: tbStartDate,
        endDate: asOfDate,
        viewMode: '6col',
      }),
    [accounts, entries, lines, tbStartDate, asOfDate],
  );

  const cnssReport = useMemo(
    () => buildCnssSummaryReport(accounts, entries, lines, asOfDate),
    [accounts, entries, lines, asOfDate],
  );

  useEffect(() => {
    if (isReportsEmbed && reportsEmbedTab) {
      setActiveTab(reportsEmbedTab);
      return;
    }
    if (isSettingsEmbed && settingsEmbedTab) {
      setActiveTab(settingsEmbedTab);
      return;
    }
    if (embedded && activeFinanceTab === "accounting") {
      const tab = searchParams.get("tab");
      if (tab && ACCOUNTING_PRIMARY_TABS.has(tab)) {
        setActiveTab(tab);
        return;
      }
      setActiveTab("vouchers");
      return;
    }
    const tab = searchParams.get("tab");
    if (!tab) {
      setActiveTab("vouchers");
      return;
    }
    setActiveTab(tab);
  }, [
    activeFinanceTab,
    embedded,
    isReportsEmbed,
    reportsEmbedTab,
    isSettingsEmbed,
    settingsEmbedTab,
    searchParams,
  ]);

  useEffect(() => {
    const parsed = consumeLedgerFocus();
    if (parsed) setLedgerFocus(parsed);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openClientAccountFromPcg = useCallback(
    (account: LebanesePcgAccount) => {
      setPcgPrefillAccount(account);
      setPcgPrefillKey((key) => key + 1);
      setCoaWorkingOpen(true);
      navigateFromQuickBar("coa");
    },
    [navigateFromQuickBar],
  );

  const [periodStartDate, setPeriodStartDate] = useState(() => {
    const y = new Date().getFullYear();
    return quarterBounds(y, currentVatQuarter()).startDate;
  });
  const [periodEndDate, setPeriodEndDate] = useState(() => {
    const y = new Date().getFullYear();
    return quarterBounds(y, currentVatQuarter()).endDate;
  });
  const reportPeriod = useMemo(
    () => normalizeDateRange(periodStartDate, periodEndDate),
    [periodStartDate, periodEndDate],
  );

  const [depMonth, setDepMonth] = useState(() => new Date().getMonth() + 1);
  const [depYear, setDepYear] = useState(() => new Date().getFullYear());
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [postingDep, setPostingDep] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetCost, setNewAssetCost] = useState("");
  const [newAssetLifeMonths, setNewAssetLifeMonths] = useState("60");
  const [newAssetInService, setNewAssetInService] = useState(() => new Date().toISOString().slice(0, 10));

  const reloadFixedAssets = useCallback(async () => {
    if (!activeOrganizationId) return;
    setAssetsLoading(true);
    try {
      setFixedAssets(await loadFixedAssets(activeOrganizationId));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load fixed assets");
    } finally {
      setAssetsLoading(false);
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    void reloadFixedAssets();
  }, [reloadFixedAssets]);

  useEffect(() => {
    const y = new Date().getFullYear();
    const bounds = quarterBounds(y, currentVatQuarter());
    setPeriodStartDate(bounds.startDate);
    setPeriodEndDate(bounds.endDate);
  }, [financeStoreId]);

  const periodShortcuts = useMemo(() => {
    const end = asOfDate.slice(0, 10);
    const y = end.slice(0, 4);
    return [
      { label: "YTD", startDate: `${y}-01-01`, endDate: end },
      { label: "This month", startDate: `${end.slice(0, 7)}-01`, endDate: end },
    ];
  }, [asOfDate]);

  const vatFiling = useMemo(
    () =>
      buildVatFilingSummary(accounts, entries, lines, {
        startDate: reportPeriod.startDate,
        endDate: reportPeriod.endDate,
        currency: entries[0]?.currency || "USD",
      }),
    [accounts, entries, lines, reportPeriod.startDate, reportPeriod.endDate],
  );

  const vatIncomeStatement = useMemo(
    () => buildIncomeStatement(accounts, entries, lines, reportPeriod.startDate, reportPeriod.endDate),
    [accounts, entries, lines, reportPeriod.startDate, reportPeriod.endDate],
  );

  const lebanonVatForm = useMemo(
    () => buildLebanonVatReturnForm(vatFiling, vatIncomeStatement),
    [vatFiling, vatIncomeStatement],
  );

  const lebanonR10Form = useMemo(
    () =>
      buildLebanonR10FormFromGl(
        accounts,
        entries,
        lines,
        reportPeriod.startDate,
        reportPeriod.endDate,
        profile?.mainCurrency || 'LBP',
      ),
    [accounts, entries, lines, reportPeriod.startDate, reportPeriod.endDate, profile?.mainCurrency],
  );

  const lebanonCnss190AForm = useMemo(
    () =>
      buildLebanonCnss190AFormFromGl(
        accounts,
        entries,
        lines,
        reportPeriod.startDate,
        reportPeriod.endDate,
        profile?.mainCurrency || 'LBP',
      ),
    [accounts, entries, lines, reportPeriod.startDate, reportPeriod.endDate, profile?.mainCurrency],
  );

  const r10Report = useMemo(
    () =>
      buildR10SalaryWithholdingReport(
        accounts,
        entries,
        lines,
        reportPeriod.endDate || asOfDate,
      ),
    [accounts, entries, lines, asOfDate, reportPeriod.endDate],
  );

  const incomeStatement = useMemo(
    () => {
      if (!reportPeriod.startDate || !reportPeriod.endDate) {
        return buildIncomeStatement(accounts, entries, lines, asOfDate.slice(0, 10), asOfDate.slice(0, 10));
      }
      return buildIncomeStatement(accounts, entries, lines, reportPeriod.startDate, reportPeriod.endDate);
    },
    [accounts, asOfDate, entries, lines, reportPeriod.endDate, reportPeriod.startDate],
  );

  const plHasActivity = useMemo(
    () =>
      lebanesePlHasActivity(incomeStatement.lebaneseForm) ||
      incomeStatement.revenue.rows.length +
        incomeStatement.otherIncome.rows.length +
        incomeStatement.cogs.rows.length +
        incomeStatement.operatingExpenses.rows.length +
        incomeStatement.financialExpenses.rows.length >
        0,
    [incomeStatement],
  );

  const arAging = useMemo(
    () => buildAgedReceivablesReport(invoices, accounts, entries, lines, asOfDate),
    [invoices, accounts, entries, lines, asOfDate],
  );

  const apAging = useMemo(
    () => buildAgedPayablesReport(purchaseOrders, paymentOrders, accounts, entries, lines, asOfDate),
    [purchaseOrders, paymentOrders, accounts, entries, lines, asOfDate],
  );

  const cashFlow = useMemo(
    () =>
      buildCashFlowStatement(accounts, entries, lines, {
        startDate: reportPeriod.startDate,
        endDate: reportPeriod.endDate,
        currency: entries[0]?.currency || "USD",
      }),
    [accounts, entries, lines, reportPeriod.startDate, reportPeriod.endDate],
  );

  const depPreview = useMemo(() => {
    const end = monthBounds(depYear, depMonth).end;
    const locked = isDateLocked(new Date(`${end}T12:00:00.000Z`).toISOString());
    return buildDepreciationRunPreview(fixedAssets, depYear, depMonth, { periodLocked: locked });
  }, [fixedAssets, depYear, depMonth, isDateLocked]);

  const downloadArCsv = () => {
    const blob = new Blob([agedReceivablesToCsv(arAging)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ar-aging-${arAging.asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadApCsv = () => {
    const blob = new Blob([agedPayablesToCsv(apAging)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ap-aging-${apAging.asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCashFlowCsv = () => {
    const blob = new Blob([cashFlowStatementToCsv(cashFlow)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-flow-${cashFlow.startDate}-${cashFlow.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadVatCsv = () => {
    let csv = vatFilingSummaryToCsv(vatFiling);
    if (isLebaneseCoa) {
      csv = csv
        .replace(`"${vatFiling.outputVat.accountCode}"`, `"${displayPcgCode(vatFiling.outputVat.accountCode, clientByGrabio)}"`)
        .replace(`"${vatFiling.inputVat.accountCode}"`, `"${displayPcgCode(vatFiling.inputVat.accountCode, clientByGrabio)}"`);
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat-filing-${vatFiling.startDate}-${vatFiling.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadVatMof = () => {
    const blob = new Blob([
      vatFilingMofWorksheet(vatFiling, {
        name: profile?.name || profile?.storeName,
        taxId: (profile as { taxId?: string } | null)?.taxId,
      }),
    ], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mof-vat-worksheet-${vatFiling.startDate}-${vatFiling.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPlCsv = () => {
    const blob = new Blob([incomeStatementToCsv(incomeStatement)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income-statement-${incomeStatement.startDate}-${incomeStatement.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdjustmentPost = useCallback(
    async (payload: { date: string; memo: string; lines: JournalLineInput[]; sourceId: string; event: string }) => {
      if (isDateLocked(parseJournalDateInput(payload.date))) {
        toast.error("That period is closed.");
        return;
      }
      setPosting(true);
      try {
        const result = await postAdjustmentEntry(payload);
        toast.success(result.idempotentReplay ? "Already posted (idempotent)." : "Posted successfully.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Post failed");
      } finally {
        setPosting(false);
      }
    },
    [isDateLocked, postAdjustmentEntry],
  );

  const subledgerTotals = useMemo(() => {
    const clientMap = new Map<string, number>();
    for (const row of arAging.rows) {
      clientMap.set(row.clientName, (clientMap.get(row.clientName) || 0) + row.outstanding);
    }
    const supplierMap = new Map<string, number>();
    for (const row of apAging.rows) {
      supplierMap.set(row.supplierName, (supplierMap.get(row.supplierName) || 0) + row.outstanding);
    }
    const clientBalances = Array.from(clientMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
    const supplierBalances = Array.from(supplierMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    if (isLebaneseCoa) {
      return {
        cashOnHand: cashBalance.cashOnHand || tbBalanceForCodes(trialBalance, lebaneseGlLookupCodes("cash", true)),
        bankBalance: cashBalance.bankBalance || tbBalanceForCodes(trialBalance, lebaneseGlLookupCodes("bank", true)),
        deliveryHeldCash: cashBalance.deliveryHeldCash || tbBalanceForCodes(trialBalance, lebaneseGlLookupCodes("online", true)),
        accountsReceivable: arAging.subledgerTotal,
        accountsPayable: apAging.subledgerTotal,
        arGlBalance: arAging.glBalance,
        apGlBalance: apAging.glBalance,
        clientBalances,
        supplierBalances,
      };
    }
    return {
      cashOnHand: cashBalance.cashOnHand || cashBalance.cash || 0,
      bankBalance: cashBalance.bankBalance || cashBalance.bank || 0,
      deliveryHeldCash: cashBalance.deliveryHeldCash || 0,
      accountsReceivable: arAging.subledgerTotal,
      accountsPayable: apAging.subledgerTotal,
      arGlBalance: arAging.glBalance,
      apGlBalance: apAging.glBalance,
      clientBalances,
      supplierBalances,
    };
  }, [isLebaneseCoa, trialBalance, cashBalance, arAging, apAging]);

  const handleCreateFixedAsset = async () => {
    if (!activeOrganizationId) return;
    const cost = Number(newAssetCost);
    const life = Number(newAssetLifeMonths);
    if (!newAssetName.trim() || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(life) || life < 1) {
      toast.error("Name, cost, and useful life (months) are required.");
      return;
    }
    try {
      await createFixedAsset(activeOrganizationId, {
        name: newAssetName.trim(),
        cost,
        usefulLifeMonths: life,
        inServiceDate: newAssetInService,
      });
      toast.success("Fixed asset added");
      setAssetDialogOpen(false);
      setNewAssetName("");
      setNewAssetCost("");
      await reloadFixedAssets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add asset");
    }
  };

  const handlePostDepreciation = async () => {
    if (!activeOrganizationId || !depPreview.canPost) return;
    if (isDateLocked(new Date(`${depPreview.postDate}T12:00:00.000Z`).toISOString())) {
      toast.error("That period is closed.");
      return;
    }
    setPostingDep(true);
    try {
      let accts = accounts;
      if (!accts.length) accts = await ensureCoa();
      const user = getFinanceAuth().currentUser;
      const result = await postMonthlyDepreciation({
        storeId: activeOrganizationId,
        year: depYear,
        month: depMonth,
        assets: fixedAssets,
        accounts: accts,
        createdBy: user?.uid,
        periodLocked: false,
      });
      toast.success(
        result.idempotentReplay
          ? "Depreciation already posted for this month (idempotent)."
          : `Posted depreciation ${depPreview.periodLabel} · ${formatCurrency(result.totalPosted)} · ${result.entryId}`,
      );
      await refreshLedger();
      await reloadFixedAssets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post depreciation");
    } finally {
      setPostingDep(false);
    }
  };

  const handlePostVoucher = async (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  }) => {
    if (isDateLocked(parseJournalDateInput(payload.date))) {
      const message = "That period is closed — cannot post journal entries for that date.";
      toast.error(message);
      throw new Error(message);
    }
    if (payload.lines.length < 2) {
      const message = "Add at least two lines with amounts.";
      toast.error(message);
      throw new Error(message);
    }
    setPosting(true);
    try {
      const result = await postVoucherEntry({
        date: parseJournalDateInput(payload.date),
        memo: payload.memo,
        lines: payload.lines,
        voucherType: payload.voucherType,
        voucherMeta: (payload.voucherMeta || {}) as VoucherMeta,
      });
      const meta = payload.voucherMeta || {};
      const allocations = (meta.allocations as SettlementAllocationInput[] | undefined) || [];
      if (!result.idempotentReplay && allocations.length > 0 && financeStoreId) {
        const user = getFinanceAuth().currentUser;
        await saveSettlementsForEntry(financeStoreId, result.entryId, allocations, user?.uid);
        for (const alloc of allocations) {
          if (alloc.documentType === "invoice") {
            recordInvoicePayment(alloc.documentId, alloc.allocatedAmountBase, "voucher");
          }
        }
        const rows = await loadSettlements(financeStoreId);
        setSettlements(rows);
      }
      toast.success(
        result.idempotentReplay
          ? "Entry already posted (idempotent)."
          : `Posted ${result.voucherNumber || result.entryId}`,
      );
      await refreshLedger();
      goToTab("vouchers");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post entry";
      toast.error(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setPosting(false);
    }
  };

  const handlePostDraft = async (entryId: string) => {
    setPostingDraft(true);
    try {
      const result = await postDraftVoucher(entryId);
      toast.success(`Posted ${result.voucherNumber || result.entryId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post draft");
    } finally {
      setPostingDraft(false);
    }
  };

  const handleReverseEntry = async (entryId: string) => {
    setReversing(true);
    try {
      const result = await reverseEntry(entryId);
      toast.success(`Reversed · ${result.entryId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reverse entry");
    } finally {
      setReversing(false);
    }
  };

  const beginEditPostedVoucher = (entry: JournalEntry) => {
    if (entry.status !== "posted") {
      toast.error("Only posted vouchers can be edited.");
      return;
    }
    if (isDateLocked(entry.date)) {
      toast.error("That period is closed — cannot reverse and repost this voucher.");
      return;
    }
    setVoucherEditPrefill({
      entry,
      lines: lines.filter((line) => line.entryId === entry.id),
    });
    setQuickVoucherEntryId("");
    goToTab("vouchers");
  };

  const handleOpeningBalance = async () => {
    if (!openingAccountId || !openingAmount) {
      toast.error("Select account and amount.");
      return;
    }
    if (isDateLocked(parseJournalDateInput(openingDate))) {
      toast.error("That period is closed — cannot post opening balances for that date.");
      return;
    }
    try {
      await setOpeningBalance(openingAccountId, Number(openingAmount), parseJournalDateInput(openingDate));
      toast.success("Opening balance saved.");
      setOpeningAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save opening balance");
    }
  };

  const handleClosePeriod = async () => {
    setPeriodActionLoading(true);
    try {
      const monthOrQuarter = periodType === "month" ? periodMonth : periodQuarter;
      const result = await closePeriod(periodType, periodYear, monthOrQuarter, closeNote || undefined);
      toast.success(`Closed ${result.label}`);
      setCloseDialogOpen(false);
      setCloseNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close period");
    } finally {
      setPeriodActionLoading(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (!reopenTargetId) {
      toast.error("Select a closed period to reopen.");
      return;
    }
    setPeriodActionLoading(true);
    try {
      const result = await reopenPeriod(reopenTargetId, reopenReason);
      toast.success(`Reopened ${result.label}`);
      setReopenDialogOpen(false);
      setReopenReason("");
      setReopenTargetId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reopen period");
    } finally {
      setPeriodActionLoading(false);
    }
  };

  const closedPeriods = periodClosures.filter((p) => p.isClosed);
  const manualClosedPeriods = closedPeriods.filter(
    (p) => !p.history?.some((h) => h.action === "close" && String(h.reason || "").includes("Auto-closed")),
  );
  const periodLockBanner = asOfPeriod ? (
    <Badge
      variant="outline"
      className={
        asOfPeriodLocked
          ? "border-amber-500 text-amber-800 bg-amber-50"
          : "border-green-600 text-green-800 bg-green-50"
      }
    >
      {asOfPeriodLocked ? <Lock className="h-3 w-3 mr-1" /> : null}
      {asOfPeriod.label} — {asOfPeriodLocked ? "locked" : "open for posting"}
    </Badge>
  ) : null;

  const showQuickBar = isPrimaryView;
  const backLink = isDeepLinkView ? tabBackLink(activeTab) : null;

  return (
    <FinancePageShell onLogout={logout}>
      <div className={embedded ? 'space-y-3' : 'space-y-6'}>
        {!embedded && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="finance-page-header">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-teal-600" />
              Accounting
              <SystemGuideInfo
                enabled={systemGuideEnabled}
                label="What Accounting does"
                title="Accounting"
                content={[
                  "Vouchers and daily ledger work live here.",
                  "Trial balance, P&L, aging, and COA setup are under Reports and Settings.",
                ]}
              />
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vouchers, workspace, and party statements — reports and setup are on other tabs.
            </p>
          </div>
          <div className="finance-as-of-toolbar flex flex-wrap items-end gap-3">
            <CustomDateRangeToolbar
              compact
              startDate={periodStartDate}
              endDate={periodEndDate}
              onStartDateChange={setPeriodStartDate}
              onEndDateChange={setPeriodEndDate}
              showVatQuarters={isLebaneseCoa}
              quarterYear={Number(asOfDate.slice(0, 4)) || new Date().getFullYear()}
              shortcuts={periodShortcuts}
            />
            <div className="flex items-center gap-2">
            <Label htmlFor="as-of" className="finance-as-of-label text-xs whitespace-nowrap">As of</Label>
            <Input
              id="as-of"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="finance-as-of-input w-[150px] bg-white text-slate-900 border-slate-300"
            />
            <Button variant="outline" size="sm" onClick={() => void refreshLedger()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCloseDialogOpen(true)}>
              <Lock className="h-4 w-4 mr-1" />
              Close Period
            </Button>
            {manualClosedPeriods.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setReopenDialogOpen(true)}>
                <Unlock className="h-4 w-4 mr-1" />
                Reopen
              </Button>
            )}
            </div>
          </div>
        </div>
        )}

        {embedded && isHubEmbed && (
          <div className="flex flex-wrap items-end gap-2 pb-1">
            <CustomDateRangeToolbar
              compact
              startDate={periodStartDate}
              endDate={periodEndDate}
              onStartDateChange={setPeriodStartDate}
              onEndDateChange={setPeriodEndDate}
              showVatQuarters={isLebaneseCoa}
              quarterYear={Number(asOfDate.slice(0, 4)) || new Date().getFullYear()}
              shortcuts={periodShortcuts}
            />
            <Label htmlFor="hub-embed-as-of" className="text-xs whitespace-nowrap">
              As of
            </Label>
            <Input
              id="hub-embed-as-of"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-[150px] bg-white text-slate-900 border-slate-300"
            />
            <Button variant="outline" size="sm" onClick={() => void refreshLedger()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        )}

        {!isHubEmbed && !embedded && <SystemGuideBanner enabled={systemGuideEnabled} />}

        {periodLockBanner ? <div className="flex flex-wrap gap-2">{periodLockBanner}</div> : null}

        {showQuickBar && !embedded && (
        <AccountingQuickBar
          totals={subledgerTotals}
          balanced={trialBalance.balanced}
          asOfDate={asOfDate}
          loading={loading}
          systemGuideEnabled={systemGuideEnabled}
          onNavigate={navigateFromQuickBar}
          onOpenSearch={() => setCommandPaletteOpen(true)}
          onOpenQuickStatement={embedded ? openQuickStatement : undefined}
        />
        )}

        <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close accounting period</DialogTitle>
              <DialogDescription>
                Fiscal quarters auto-close on the 30th: Q1 Jan 1–Mar 30 · Q2 Apr 1–Jun 30 · Q3 Jul 1–Sep 30 · Q4 Oct 1–Dec 30.
                Manual close is optional — expired quarters lock automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Period type</Label>
                <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodLockType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Year</Label>
                  <Input type="number" min={2000} max={2100} value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} />
                </div>
                <div>
                  <Label>{periodType === "month" ? "Month" : "Quarter"}</Label>
                  {periodType === "month" ? (
                    <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={String(periodQuarter)} onValueChange={(v) => setPeriodQuarter(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((q) => (
                          <SelectItem key={q} value={String(q)}>
                            {q === 1 ? "Q1 · Jan 1 – Mar 30" : q === 2 ? "Q2 · Apr 1 – Jun 30" : q === 3 ? "Q3 · Jul 1 – Sep 30" : "Q4 · Oct 1 – Dec 30"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="e.g. Month-end close approved" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleClosePeriod()} disabled={periodActionLoading}>
                {periodActionLoading ? "Closing…" : "Close period"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen closed period</DialogTitle>
              <DialogDescription>
                Admin override — requires a reason. This is logged in the period audit trail.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Period</Label>
                <Select value={reopenTargetId} onValueChange={setReopenTargetId}>
                  <SelectTrigger><SelectValue placeholder="Select closed period" /></SelectTrigger>
                  <SelectContent>
                    {manualClosedPeriods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason (required)</Label>
                <Textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Why is this period being reopened?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleReopenPeriod()} disabled={periodActionLoading || !reopenReason.trim()}>
                {periodActionLoading ? "Reopening…" : "Reopen period"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Tabs value={activeTab} onValueChange={goToTab}>
          <div className="finance-accounting-tabs-shell hidden" aria-hidden />

          <TabsContent value="workspace" className="mt-4">
            <AccountantWorkspacePanel
              accounts={accounts}
              entries={entries}
              lines={lines}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              isLebaneseCoa={isLebaneseCoa}
              onAddClientAccount={openClientAccountFromPcg}
              onOpenVouchers={() => goToTab("vouchers")}
              onViewAccount={openAccountActivity}
              onViewEntry={setQuickVoucherEntryId}
              systemGuideEnabled={systemGuideEnabled}
            />
          </TabsContent>

          <TabsContent value="coa" className="mt-4">
            {isLebaneseCoa ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Account List — Lebanese PCG
                          <SystemGuideInfo
                            enabled={systemGuideEnabled}
                            label="What the PCG list is"
                            title="Lebanese PCG chart"
                            content={[
                              "Standard plan comptable — classes 1 through 7.",
                              "Click a number for voucher movements. Use Add on a class or detail row to create working account numbers.",
                            ]}
                          />
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Expand a class, click an account for movements, or Add to map your working numbers.
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void ensureCoa()}>
                        Sync chart
                      </Button>
                      <Button size="sm" onClick={() => setCoaAddOpen(true)}>
                        Add account
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <LebanesePcgCoaPanel
                      activeLedgerAccounts={accounts.filter((a) => a.isActive)}
                      pcgClientAccounts={pcgClientAccounts}
                      entries={entries}
                      lines={lines}
                      asOfDate={asOfDate}
                      accountingLanguage={accountingLanguage}
                      onAddClientAccount={openClientAccountFromPcg}
                    />
                  </CardContent>
                </Card>

                <Collapsible open={coaWorkingOpen} onOpenChange={setCoaWorkingOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="w-full text-left">
                        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              Your Working Account Numbers
                              <SystemGuideInfo
                                enabled={systemGuideEnabled}
                                label="What working account numbers are"
                                title="Client sub-accounts"
                                content={[
                                  "Your accountant's own codes under the PCG chart.",
                                  "Reports show these numbers; balances post through linked Grabio accounts.",
                                ]}
                              />
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {pcgClientAccounts.length
                                ? `${pcgClientAccounts.length} working account${pcgClientAccounts.length === 1 ? "" : "s"} — expand to edit or import`
                                : "No working accounts yet — expand to add or import"}
                            </CardDescription>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              coaWorkingOpen && "rotate-180",
                            )}
                          />
                        </CardHeader>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {financeStoreId ? (
                          <PcgClientAccountsPanel
                            storeId={financeStoreId}
                            activeLedgerAccounts={accounts.filter((a) => a.isActive)}
                            rows={pcgClientAccounts}
                            onChange={setPcgClientAccounts}
                            prefillAccount={pcgPrefillAccount}
                            prefillKey={pcgPrefillKey}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">Select a store to manage client codes.</p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Chart of Accounts
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What the chart of accounts is"
                    title="Chart of Accounts"
                    content={[
                      "Every ledger account used for posting sales, purchases, expenses, and manual vouchers.",
                      "Use Ledger on a row to see activity, or Sync/Initialize to add missing template accounts.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>
                  {accounts.length ? `${accounts.length} accounts` : "Default SMB template will seed on first load."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="mb-4 mr-2" onClick={() => void ensureCoa()}>
                  Initialize / Refresh COA
                </Button>
                <Button size="sm" className="mb-4" onClick={() => setCoaAddOpen(true)}>
                  Add account
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      {arabicEntry ? <TableHead>Arabic name</TableHead> : null}
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                      {arabicEntry ? <TableHead className="w-[90px]" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs tabular-nums">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        {arabicEntry ? (
                          <TableCell dir="rtl" className="text-right">
                            {a.nameAr || "—"}
                          </TableCell>
                        ) : null}
                        <TableCell className="capitalize">{a.type}</TableCell>
                        <TableCell className="text-right">{formatCurrency(a.openingBalance || 0)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openAccountActivity(a.id, `${a.code} · ${a.name}`)}
                          >
                            Ledger
                          </Button>
                        </TableCell>
                        {arabicEntry ? (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCoaEditAccountId(a.id);
                                setCoaEditNameAr(a.nameAr || "");
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Dialog open={Boolean(coaEditAccountId)} onOpenChange={(open) => !open && setCoaEditAccountId("")}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Arabic account label</DialogTitle>
                      <DialogDescription>Persisted on the ledger account for bilingual reports and vouchers.</DialogDescription>
                    </DialogHeader>
                    <div>
                      <Label htmlFor="coa-name-ar">Name (Arabic)</Label>
                      <Input
                        id="coa-name-ar"
                        dir="rtl"
                        value={coaEditNameAr}
                        onChange={(e) => setCoaEditNameAr(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        disabled={coaEditSaving || !coaEditAccountId || !activeOrganizationId}
                        onClick={() => {
                          if (!activeOrganizationId || !coaEditAccountId) return;
                          setCoaEditSaving(true);
                          void updateLedgerAccountNames(activeOrganizationId, coaEditAccountId, {
                            nameAr: coaEditNameAr.trim() || undefined,
                          })
                            .then(() => {
                              toast.success("Arabic label saved");
                              setCoaEditAccountId("");
                              return refreshLedger();
                            })
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Save failed"))
                            .finally(() => setCoaEditSaving(false));
                        }}
                      >
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
            )}
          </TabsContent>

          <TabsContent value="vouchers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Vouchers (JV / PV / RV / CV)
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What vouchers do"
                    title="Voucher entry"
                    content={[
                      "Journal (JV), Payment (PV), Receipt (RV), and Contra (CV) all post through the same ledger engine.",
                      "Each voucher gets a store-scoped serial number for audit trail.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>Debits must equal credits before posting.</CardDescription>
              </CardHeader>
              <CardContent>
                <VoucherEntryPanel
                  storeId={financeStoreId}
                  accounts={accounts}
                  accountingLanguage={accountingLanguage}
                  isLebaneseCoa={isLebaneseCoa}
                  pcgClientAccounts={pcgClientAccounts}
                  invoices={invoices}
                  purchaseOrders={purchaseOrders}
                  paymentOrders={paymentOrders}
                  settlements={settlements}
                  mainCurrency={profile?.mainCurrency}
                  fxRateDefault={profile?.customExchangeRate}
                  posting={posting}
                  onPost={handlePostVoucher}
                  registerEntries={entries}
                  registerLines={lines}
                  systemGuideEnabled={systemGuideEnabled}
                  onRegisterPostDraft={(id) => void handlePostDraft(id)}
                  postingRegisterDraft={postingDraft}
                  onRegisterReverse={(id) => void handleReverseEntry(id)}
                  reversingRegister={reversing}
                  prefillEntry={voucherEditPrefill?.entry || null}
                  prefillLines={voucherEditPrefill?.lines || []}
                  onPrefillConsumed={() => setVoucherEditPrefill(null)}
                  onReversePosted={async (entryId) => {
                    await reverseEntry(entryId);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vat-filing" className="mt-4">
            {isLebaneseCoa ? (
              <LebanonVatReturnFormPanel
                storeId={financeStoreId}
                glForm={lebanonVatForm}
                companyName={profile?.name || profile?.storeName}
                taxId={(profile as { taxId?: string } | null)?.taxId}
                systemGuideEnabled={systemGuideEnabled}
              />
            ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  VAT filing summary
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="How this summary works"
                    title="VAT filing summary"
                    content={[
                      "Period totals come from posted GL lines on Output VAT (220) and Input VAT (140).",
                      "Net VAT due = net output collected minus net input recoverable for the selected period.",
                      "Closing balances are as of the period end date. Export CSV for your accountant.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>
                  Lebanon 11% accounts · read-only from the general ledger
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-end justify-end gap-4">
                  <Button type="button" variant="outline" size="sm" onClick={downloadVatCsv}>
                    Export CSV
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={downloadVatMof}>
                    MoF worksheet
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Net output VAT ({isLebaneseCoa ? displayPcgCode("220", clientByGrabio) : "220"})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatCurrency(vatFiling.outputVat.net)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cr {formatCurrency(vatFiling.outputVat.collected)} · Dr {formatCurrency(vatFiling.outputVat.reversed)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Closing liability: {formatCurrency(vatFiling.outputVat.closingBalance)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Net input VAT ({isLebaneseCoa ? displayPcgCode("140", clientByGrabio) : "140"})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {vatFiling.inputVat.accountActive ? (
                        <>
                          <p className="text-2xl font-semibold">{formatCurrency(vatFiling.inputVat.net)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Dr {formatCurrency(vatFiling.inputVat.recoverable)} · Cr {formatCurrency(vatFiling.inputVat.reversed)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Closing asset: {formatCurrency(vatFiling.inputVat.closingBalance)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Account {isLebaneseCoa ? displayPcgCode("140", clientByGrabio) : "140"} not active on this store — input VAT will show $0 until enabled.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Net VAT {vatFiling.netVatDueLabel}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatCurrency(Math.abs(vatFiling.netVatDue))}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Output − input · {vatFiling.entryCount} entries · {vatFiling.lineCount} VAT lines
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {vatFiling.bySource.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">By GL source (period)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Output net</TableHead>
                          <TableHead className="text-right">Input net</TableHead>
                          <TableHead className="text-right">Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vatFiling.bySource.map((r) => (
                          <TableRow key={r.sourceType}>
                            <TableCell className="font-mono text-sm">{r.sourceType}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.outputNet)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.inputNet)}</TableCell>
                            <TableCell className="text-right">{r.entryCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </TabsContent>

          <TabsContent value="ar-aging" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Aged receivables
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="How AR aging works"
                    title="Aged receivables"
                    content={[
                      "Open invoices (sent / partial) are aged by days since invoice date.",
                      "Buckets: current 0–30, 31–60, 61–90, 91+ days.",
                      "Subledger total is compared to GL account 110 as of the As-of date above.",
                    ]}
                  />
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  As of {asOfDate} · {arAging.openInvoiceCount} open invoice{arAging.openInvoiceCount === 1 ? "" : "s"}
                  {arAging.matched ? (
                    <Badge className="bg-green-600">Matches GL 110</Badge>
                  ) : (
                    <Badge variant="destructive">GL variance {formatCurrency(arAging.variance)}</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 flex-1">
                    {(Object.keys(AGED_RECEIVABLES_BUCKET_LABELS) as Array<keyof typeof AGED_RECEIVABLES_BUCKET_LABELS>).map((key) => (
                      <Card key={key} className="border-dashed">
                        <CardHeader className="pb-1 pt-3 px-4">
                          <CardTitle className="text-xs font-medium text-muted-foreground">
                            {AGED_RECEIVABLES_BUCKET_LABELS[key]}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                          <p className="text-lg font-semibold">{formatCurrency(arAging.buckets[key])}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={downloadArCsv}>
                    Export CSV
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
                  <span>Invoice subledger: <strong>{formatCurrency(arAging.subledgerTotal)}</strong></span>
                  <span>GL {isLebaneseCoa ? formatGlAccountReference("110", "Accounts Receivable", clientByGrabio) : "110"}: <strong>{formatCurrency(arAging.glBalance)}</strong></span>
                </div>
                {arAging.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open receivables on unpaid invoices.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[110px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {arAging.rows.map((r) => (
                        <TableRow key={r.invoiceId}>
                          <TableCell className="font-mono text-sm">{r.invoiceId}</TableCell>
                          <TableCell>{r.clientName}</TableCell>
                          <TableCell>{r.invoiceDate}</TableCell>
                          <TableCell className="text-right">{r.daysPast}</TableCell>
                          <TableCell>{AGED_RECEIVABLES_BUCKET_LABELS[r.bucket]}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.outstanding)}</TableCell>
                          <TableCell className="capitalize">{r.status}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openClientVouchers(r.clientId, r.clientName)}
                            >
                              Vouchers
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ap-aging" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Aged payables
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="How AP aging works"
                    title="Aged payables"
                    content={[
                      "Open payables from Admin Purchases (platform) plus Invoice Manager POs when used.",
                      "Received stock with unpaid/partial payment stays in aging even when status is fulfilled.",
                      "Outstanding = total minus payments; compared to GL account 201 as of the As-of date.",
                    ]}
                  />
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  As of {asOfDate} · {apAging.openPoCount} open PO{apAging.openPoCount === 1 ? "" : "s"}
                  {apAging.matched ? (
                    <Badge className="bg-green-600">Matches GL 201</Badge>
                  ) : (
                    <Badge variant="destructive">GL variance {formatCurrency(apAging.variance)}</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 flex-1">
                    {(Object.keys(AGED_PAYABLES_BUCKET_LABELS) as Array<keyof typeof AGED_PAYABLES_BUCKET_LABELS>).map((key) => (
                      <Card key={key} className="border-dashed">
                        <CardHeader className="pb-1 pt-3 px-4">
                          <CardTitle className="text-xs font-medium text-muted-foreground">
                            {AGED_PAYABLES_BUCKET_LABELS[key]}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                          <p className="text-lg font-semibold">{formatCurrency(apAging.buckets[key])}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={downloadApCsv}>
                    Export CSV
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
                  <span>PO subledger: <strong>{formatCurrency(apAging.subledgerTotal)}</strong></span>
                  <span>GL {isLebaneseCoa ? formatGlAccountReference("201", "Accounts Payable", clientByGrabio) : "201"}: <strong>{formatCurrency(apAging.glBalance)}</strong></span>
                </div>
                {apAging.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open payables on sent/approved POs.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[110px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apAging.rows.map((r) => (
                        <TableRow key={r.purchaseOrderId}>
                          <TableCell className="font-mono text-sm">{r.purchaseOrderId}</TableCell>
                          <TableCell>{r.supplierName}</TableCell>
                          <TableCell>{r.poDate}</TableCell>
                          <TableCell className="text-right">{r.daysPast}</TableCell>
                          <TableCell>{AGED_PAYABLES_BUCKET_LABELS[r.bucket]}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.grossAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.paidAmount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.outstanding)}</TableCell>
                          <TableCell className="capitalize">{r.status}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openSupplierVouchers(r.supplierId, r.supplierName)}
                            >
                              Vouchers
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cash-flow" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Cash flow statement
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="How cash flow works"
                    title="Cash flow (indirect)"
                    content={[
                      "Period net income plus working-capital changes (110, 120/121, 140, 201, 220/222 VAT).",
                      "Investing and financing sections use fixed-asset and equity/long-term liability movement.",
                      "Computed net change is compared to cash accounts 102, 106, 103, etc.",
                    ]}
                  />
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  {cashFlow.startDate} → {cashFlow.endDate}
                  {cashFlow.reconciled ? (
                    <Badge className="bg-green-600">Reconciles to cash GL</Badge>
                  ) : (
                    <Badge variant="destructive">
                      Cash variance {formatCurrency(cashFlow.reconciliationVariance)}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-end justify-end gap-4">
                  <Button type="button" variant="outline" size="sm" onClick={downloadCashFlowCsv}>
                    Export CSV
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Operating</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatCurrency(cashFlow.netCashFromOperating)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Net income {formatCurrency(cashFlow.netIncome)} · WC adj {formatCurrency(cashFlow.workingCapitalAdjustments)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Investing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatCurrency(cashFlow.netCashFromInvesting)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Financing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatCurrency(cashFlow.netCashFromFinancing)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Net change in cash</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatCurrency(cashFlow.netChangeInCash)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(cashFlow.cashAtBeginning)} → {formatCurrency(cashFlow.cashAtEnd)} (GL cash)
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {(["operating", "investing", "financing"] as const).map((section) => {
                  const lines =
                    section === "operating"
                      ? cashFlow.operatingLines
                      : section === "investing"
                        ? cashFlow.investingLines
                        : cashFlow.financingLines;
                  if (lines.length === 0 && section !== "operating") return null;
                  return (
                    <div key={section}>
                      <h4 className="text-sm font-medium mb-2 capitalize">{section} activities</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Line</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((l, idx) => {
                            const acct = l.accountCode ? accounts.find((a) => a.code === l.accountCode) : undefined;
                            const label =
                              isLebaneseCoa && l.accountCode
                                ? remapCashFlowLineLabel(l, acct?.name, clientByGrabio)
                                : l.label;
                            return (
                            <TableRow key={`${section}-${idx}`}>
                              <TableCell>{label}</TableCell>
                              <TableCell className="text-right">{formatCurrency(l.amount)}</TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="depreciation" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Fixed assets &amp; depreciation
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="How depreciation works"
                    title="Monthly depreciation"
                    content={[
                      "Register assets with cost, in-service date, and useful life (straight-line).",
                      "Run posts Dr 710 / Cr 156 (default) on the last day of the selected month.",
                      "One idempotent JE per store per month; blocked when that period is closed.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>
                  Straight-line · posts to GL accounts{" "}
                  {isLebaneseCoa
                    ? `${displayPcgCode("710", clientByGrabio)} / ${displayPcgCode("156", clientByGrabio)}`
                    : "710 / 156"}{" "}
                  by default
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <Label>Run month</Label>
                      <Select value={String(depMonth)} onValueChange={(v) => setDepMonth(Number(v))}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Year</Label>
                      <Select value={String(depYear)} onValueChange={(v) => setDepYear(Number(v))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026, 2027].map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setAssetDialogOpen(true)}>
                      Add asset
                    </Button>
                    <Button
                      type="button"
                      disabled={!depPreview.canPost || postingDep}
                      onClick={() => void handlePostDepreciation()}
                    >
                      {postingDep ? "Posting…" : `Post ${depPreview.periodLabel}`}
                    </Button>
                  </div>
                </div>

                {!depPreview.canPost && depPreview.blockReason ? (
                  <p className="text-sm text-muted-foreground">{depPreview.blockReason}</p>
                ) : null}

                {depPreview.totalDepreciation > 0 ? (
                  <div className="rounded-md border p-4">
                    <p className="font-medium">
                      Preview · {formatCurrency(depPreview.totalDepreciation)} on {depPreview.postDate}
                    </p>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                      {depPreview.lines
                        .filter((l) => l.amount > 0)
                        .map((l) => (
                          <li key={l.assetId}>
                            {l.assetName}: {formatCurrency(l.amount)}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>In service</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Accum. depr.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : fixedAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          No fixed assets — add one to run depreciation.
                        </TableCell>
                      </TableRow>
                    ) : (
                      fixedAssets.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.name}</TableCell>
                          <TableCell>{a.inServiceDate.slice(0, 10)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.cost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(a.accumulatedDepreciation || 0)}</TableCell>
                          <TableCell className="capitalize">{a.status.replace("_", " ")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add fixed asset</DialogTitle>
                  <DialogDescription>
                    Straight-line depreciation · Dr {isLebaneseCoa ? displayPcgCode("710", clientByGrabio) : "710"} / Cr{" "}
                    {isLebaneseCoa ? displayPcgCode("156", clientByGrabio) : "156"} when you post a month.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <Label>Name</Label>
                    <Input value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)} placeholder="Kitchen oven" />
                  </div>
                  <div>
                    <Label>Cost (USD)</Label>
                    <Input type="number" min={0} step="0.01" value={newAssetCost} onChange={(e) => setNewAssetCost(e.target.value)} />
                  </div>
                  <div>
                    <Label>Useful life (months)</Label>
                    <Input type="number" min={1} value={newAssetLifeMonths} onChange={(e) => setNewAssetLifeMonths(e.target.value)} />
                  </div>
                  <div>
                    <Label>In-service date</Label>
                    <Input type="date" value={newAssetInService} onChange={(e) => setNewAssetInService(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleCreateFixedAsset()}>Save asset</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="trial-balance" className="mt-4">
            <TrialBalancePanel
              accounts={accounts}
              entries={entries}
              lines={lines}
              asOfDate={asOfDate}
              loading={loading}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              currencyCode={profile?.mainCurrency || (isLebaneseCoa ? 'LBP' : 'USD')}
              usdToLbp={profile?.customExchangeRate}
              onRefresh={() => void refreshLedger()}
              onOpenGl={(accountId) => {
                const account = accounts.find((row) => row.id === accountId);
                openAccountActivity(accountId, account ? `${account.code} ${account.name}` : accountId);
              }}
            />
          </TabsContent>

          <TabsContent value="balance-sheet" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Balance Sheet
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What Balance Sheet does"
                    title="Balance Sheet"
                    content={[
                      "Balance Sheet shows what the business owns, what it owes, and the value left for the owner at a point in time.",
                      "Use it to review cash, receivables, payables, and equity in one snapshot.",
                    ]}
                  />
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  Assets = Liabilities + Equity (incl. current-year earnings) · as of {asOfDate}
                  {periodLockBanner}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(["assets", "liabilities", "equity"] as const).map((key) => {
                  const section = balanceSheet[key];
                  return (
                    <div key={key}>
                      <h3 className="font-semibold mb-2">{section.title}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-28">Code</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.rows.map((r) => {
                            const linked = accounts.find((a) => a.code === r.code);
                            return (
                            <TableRow key={r.code}>
                              <TableCell className="font-mono w-28">
                                {isLebaneseCoa ? (
                                  <PcgMappedCodeBadge grabioCode={r.code} clientByGrabio={clientByGrabio} />
                                ) : (
                                  r.code
                                )}
                              </TableCell>
                              <TableCell>
                                {isLebaneseCoa ? (
                                  (() => {
                                    const pcg = resolvePcgDisplay(r.code, r.name, clientByGrabio);
                                    return (
                                      <div>
                                        <div>{pcg?.name || r.name}</div>
                                        {arabicEntry && pcg?.nameAr ? (
                                          <div dir="rtl" className="text-xs text-muted-foreground text-right">{pcg.nameAr}</div>
                                        ) : null}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  r.name
                                )}
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                              <TableCell className="w-[100px]">
                                {linked ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => openAccountActivity(linked.id, `${r.code} · ${r.name}`)}
                                  >
                                    Ledger
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                            );
                          })}
                          <TableRow className="font-medium border-t">
                            <TableCell colSpan={2}>Subtotal</TableCell>
                            <TableCell className="text-right">{formatCurrency(section.subtotal)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-4 text-sm border-t pt-4">
                  <span>Total Assets: <strong>{formatCurrency(balanceSheet.totalAssets)}</strong></span>
                  <span>Total Liab. + Equity: <strong>{formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}</strong></span>
                  {balanceSheet.balanced ? (
                    <Badge className="bg-green-600">Balanced</Badge>
                  ) : (
                    <Badge variant="destructive">Check entries</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profit-loss" className="mt-4 space-y-4">
            <LebaneseProfitLossDocument
              report={incomeStatement}
              storeCurrency={profile?.mainCurrency || (isLebaneseCoa ? "LBP" : "USD")}
              usdToLbp={profile?.customExchangeRate}
              companyName={profile?.name || profile?.storeName}
              hasActivity={plHasActivity}
              systemGuideEnabled={systemGuideEnabled}
              accounts={accounts}
              onExportCsv={downloadPlCsv}
              onOpenAccount={openAccountActivity}
            />
          </TabsContent>

          <TabsContent value="year-end-close" className="mt-4">
            <YearEndClosePanel
              accounts={accounts}
              entries={entries}
              lines={lines}
              systemGuideEnabled={systemGuideEnabled}
              posting={posting}
              periodLocked={asOfPeriodLocked}
              onPost={handleAdjustmentPost}
              onExportPack={() => {
                downloadCsvText(`trial-balance-${asOfDate}.csv`, extendedTrialBalanceToCsv(extendedTrialBalance));
                downloadCsvText(`income-statement-${asOfDate}.csv`, incomeStatementToCsv(incomeStatement));
              }}
            />
          </TabsContent>

          <TabsContent value="fx-revaluation" className="mt-4">
            <FxRevaluationPanel
              accounts={accounts}
              entries={entries}
              lines={lines}
              asOfDate={asOfDate}
              mainCurrency={profile?.mainCurrency}
              defaultPreviousRate={profile?.customExchangeRate}
              systemGuideEnabled={systemGuideEnabled}
              posting={posting}
              onPost={handleAdjustmentPost}
            />
          </TabsContent>

          <TabsContent value="party-soa" className="mt-4">
            <PartyStatementPanel
              accounts={accounts}
              entries={entries}
              lines={lines}
              settlements={settlements}
              purchaseOrders={purchaseOrders}
              paymentOrders={paymentOrders}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              initialPartyName={searchParams.get("partyName") || ""}
            />
          </TabsContent>

          <TabsContent value="general-ledger" className="mt-4">
            <GeneralLedgerPanel
              storeId={financeStoreId}
              accounts={accounts}
              entries={entries}
              lines={lines}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              presetAccountId={glPresetAccountId}
              defaultStartDate={reportPeriod.startDate}
              defaultEndDate={reportPeriod.endDate}
              storeCurrency={profile?.mainCurrency || (isLebaneseCoa ? 'LBP' : 'USD')}
              purchaseOrders={purchaseOrders}
              paymentOrders={paymentOrders}
              invoices={invoices}
              expenses={expenses}
              usdToLbp={profile?.customExchangeRate}
              onOpenEntry={setQuickVoucherEntryId}
            />
          </TabsContent>

          <TabsContent value="tax-reports" className="mt-4 space-y-4">
            {isLebaneseCoa ? (
              <>
                <LebanonR10FormPanel
                  storeId={financeStoreId}
                  glForm={lebanonR10Form}
                  companyName={profile?.name || profile?.storeName}
                  taxId={(profile as { taxId?: string } | null)?.taxId}
                  systemGuideEnabled={systemGuideEnabled}
                />
                <LebanonCnss190AFormPanel
                  storeId={financeStoreId}
                  glForm={lebanonCnss190AForm}
                  companyName={profile?.name || profile?.storeName}
                  companyNumber={(profile as { cnssNumber?: string; taxId?: string } | null)?.cnssNumber || (profile as { taxId?: string } | null)?.taxId}
                  systemGuideEnabled={systemGuideEnabled}
                />
              </>
            ) : null}
            {!isLebaneseCoa ? (
            <Card>
              <CardHeader>
                <CardTitle>Lebanese tax reports</CardTitle>
                <CardDescription>
                  R10 salary withholding · CNSS employer summary · as of {asOfDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadCsvText(`r10-${r10Report.periodLabel}.csv`, r10ReportToCsv(r10Report))}>
                    Export R10 CSV
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadXlsxFromCsv(`r10-${r10Report.periodLabel}.xlsx`, "R10", r10ReportToCsv(r10Report))}>
                    Export R10 XLSX
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadCsvText(`cnss-${cnssReport.periodLabel}.csv`, cnssReportToCsv(cnssReport))}>
                    Export CNSS CSV
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadXlsxFromCsv(`cnss-${cnssReport.periodLabel}.xlsx`, "CNSS", cnssReportToCsv(cnssReport))}>
                    Export CNSS XLSX
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <div className="rounded-md border p-4">
                    <h3 className="font-semibold mb-2">R10 — Salary withholding</h3>
                    <p>Total wages: {formatCurrency(r10Report.totalWages)}</p>
                    <p>Withholding payable ({r10Report.withholdingAccountCode}): {formatCurrency(r10Report.withholdingPayable)}</p>
                  </div>
                  <div className="rounded-md border p-4">
                    <h3 className="font-semibold mb-2">CNSS summary</h3>
                    <p>Employer share: {formatCurrency(cnssReport.totalEmployerShare)}</p>
                    <p>Payable ({cnssReport.payableAccountCode}): {formatCurrency(cnssReport.payableBalance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="recurring" className="mt-4">
            <RecurringVouchersPanel
              storeId={financeStoreId}
              accounts={accounts}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              systemGuideEnabled={systemGuideEnabled}
              onPostTemplate={async (p) => {
                setPosting(true);
                try {
                  await handlePostVoucher({ ...p, voucherMeta: {} });
                } finally {
                  setPosting(false);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="checks" className="mt-4">
            <CheckRegisterPanel
              entries={entries}
              lines={lines}
              storeId={financeStoreId}
              systemGuideEnabled={systemGuideEnabled}
              onOpenEntry={setQuickVoucherEntryId}
              onStatusUpdated={() => void refreshLedger()}
            />
          </TabsContent>

          <TabsContent value="cost-centers" className="mt-4">
            <CostCentersPanel storeId={financeStoreId} systemGuideEnabled={systemGuideEnabled} />
          </TabsContent>

          <TabsContent value="bulk-import" className="mt-4">
            <BulkVoucherImportPanel
              storeId={financeStoreId}
              accountsById={accountsById ?? new Map()}
              createdBy={getFinanceAuth().currentUser?.uid}
              onSaved={() => void refreshLedger()}
            />
          </TabsContent>

          <TabsContent value="opening" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Opening Balances
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What opening balances do"
                    title="Opening balances"
                    content={[
                      "Set starting balances when moving from another system or at fiscal year open.",
                      "Each entry posts to the selected account with an offset to Opening Balance Equity — use before regular month activity.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>Posts offset to Opening Balance Equity ({isLebaneseCoa ? displayPcgCode("303", clientByGrabio) : "303"}).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div>
                  <Label>Account</Label>
                  <LedgerAccountCombobox
                    accounts={accounts}
                    value={openingAccountId}
                    onValueChange={setOpeningAccountId}
                    isLebaneseCoa={isLebaneseCoa}
                    pcgClientAccounts={pcgClientAccounts}
                    accountingLanguage={accountingLanguage}
                    filterAccounts={(account) => account.type !== "revenue" && account.type !== "expense"}
                    placeholder="Search asset, liability, or equity account…"
                  />
                </div>
                <div>
                  <Label>Amount (normal balance direction)</Label>
                  <Input type="number" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Effective date</Label>
                  <Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
                </div>
                <Button onClick={() => void handleOpeningBalance()}>Save opening balance</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-4">
            {activeOrganizationId ? (
              <ReconciliationPanel
                storeId={activeOrganizationId}
                accounts={accounts}
                entries={entries}
                lines={lines}
                asOfDate={asOfDate}
                subledger={subledgerTotals}
                isLebaneseCoa={isLebaneseCoa}
                arAging={arAging}
                apAging={apAging}
                onRefresh={() => refreshLedger()}
                loading={loading}
                systemGuideEnabled={systemGuideEnabled}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-muted-foreground">Select a store to reconcile accounts.</CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="bank-rec" className="mt-4">
            {activeOrganizationId ? (
              <BankReconciliationPanel
                storeId={activeOrganizationId}
                accounts={accounts}
                entries={entries}
                lines={lines}
                systemGuideEnabled={systemGuideEnabled}
                isLebaneseCoa={isLebaneseCoa}
                pcgClientAccounts={pcgClientAccounts}
                accountingLanguage={accountingLanguage}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-muted-foreground">Select a store to use bank reconciliation.</CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <LedgerActivityDialog
          focus={ledgerFocus}
          onClose={() => setLedgerFocus(null)}
          accounts={accounts}
          entries={entries}
          lines={lines}
          asOfDate={asOfDate}
          isLebaneseCoa={isLebaneseCoa}
          pcgClientAccounts={pcgClientAccounts}
          accountingLanguage={accountingLanguage}
          onOpenVouchersTab={() => {
            setLedgerFocus(null);
            goToTab("vouchers");
          }}
          onDrillToGl={(accountId) => {
            setLedgerFocus(null);
            openAccountDrill(accountId);
          }}
        />
        <VoucherDetailDialog
          entry={quickVoucherEntry}
          lines={lines}
          open={Boolean(quickVoucherEntry)}
          onOpenChange={(open) => !open && setQuickVoucherEntryId("")}
          isLebaneseCoa={isLebaneseCoa}
          pcgClientAccounts={pcgClientAccounts}
          accountingLanguage={accountingLanguage}
          onEdit={quickVoucherEntry ? () => beginEditPostedVoucher(quickVoucherEntry) : undefined}
        />
        <AddLedgerAccountDialog
          open={coaAddOpen}
          onOpenChange={setCoaAddOpen}
          storeId={financeStoreId}
          accounts={accounts}
          isLebaneseCoa={isLebaneseCoa}
          pcgClientAccounts={pcgClientAccounts}
          accountingLanguage={accountingLanguage}
          onCreated={() => refreshLedger()}
        />
        <AccountingCommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          tabs={accountingPaletteTabs}
          accounts={accounts}
          entries={entries}
          isLebaneseCoa={isLebaneseCoa}
          pcgClientAccounts={pcgClientAccounts}
          onSelectTab={goToTab}
          onSelectAccount={openAccountActivity}
          onSelectEntry={setQuickVoucherEntryId}
        />
      </div>
    </FinancePageShell>
  );
};

export default Accounting;
