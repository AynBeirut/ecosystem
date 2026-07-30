import { useMemo, useState, useEffect, useCallback } from "react";
import FinancePageShell from "@/components/FinancePageShell";
import { useAppContext } from "@/context/AppContext";
import { useAccounting } from "@/context/AccountingContext";
import { useLedger } from "@/context/LedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Scale, Plus, RefreshCw, CheckCircle2, AlertTriangle, Lock, Unlock, FileSpreadsheet, Layers, FileText, Receipt, TrendingUp, TrendingDown, Wallet, Calculator, Landmark, GitCompare, CalendarRange, PieChart, Repeat, Building2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { JournalLineInput, PeriodLockType, VoucherMeta, VoucherType } from "@/types/generalLedger";
import { buildReconciliationReport, LEBANESE_PCG_GL_CODES, tbBalanceForCodes } from "@/lib/ledger/reconciliation";
import { buildVatFilingSummary, vatFilingSummaryToCsv } from "@/lib/ledger/vatFilingSummary";
import { vatFilingMofWorksheet } from "@/lib/ledger/vatFilingMofExport";
import { buildIncomeStatement, incomeStatementToCsv } from "@/lib/ledger/incomeStatement";
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
import BankReconciliationPanel from "@/components/BankReconciliationPanel";
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
import { buildClientByGrabioMap, resolvePcgDisplay, formatPcgAccountLabel, formatGlAccountReference, remapCashFlowLineLabel, displayPcgCode } from "@/lib/ledger/grabioToPcgMap";
import { loadPcgClientAccounts } from "@/lib/firestore/pcgClientAccountsFirestore";
import type { PcgClientAccount } from "@/types/generalLedger";
import type { LebanesePcgAccount } from "@/lib/ledger/lebanesePcgChart.generated";
import AccountantWorkspacePanel from "@/components/AccountantWorkspacePanel";
import VoucherRegisterPanel from "@/components/VoucherRegisterPanel";
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
import type { LedgerActivityFocus } from "@/lib/ledger/ledgerActivity";
import { consumeLedgerFocus } from "@/lib/ledger/ledgerActivity";

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

const ACCOUNTING_TAB_ROWS: AccountingTabDef[][] = [
  [
    { value: "workspace", label: "Workspace", icon: BookOpen, tone: "emerald" },
    { value: "coa", label: "Chart of Accounts", shortLabel: "COA", icon: Layers, tone: "blue" },
    { value: "vouchers", label: "Vouchers", icon: FileText, tone: "violet" },
    { value: "vat-filing", label: "VAT Filing", icon: Receipt, tone: "amber" },
    { value: "ar-aging", label: "AR Aging", icon: TrendingUp, tone: "emerald" },
    { value: "ap-aging", label: "AP Aging", icon: TrendingDown, tone: "orange" },
    { value: "cash-flow", label: "Cash Flow", icon: Wallet, tone: "cyan" },
  ],
  [
    { value: "depreciation", label: "Depreciation", icon: Calculator, tone: "rose" },
    { value: "trial-balance", label: "Trial Balance", icon: Scale, tone: "indigo" },
    { value: "balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet, tone: "teal" },
    { value: "profit-loss", label: "P&L", icon: PieChart, tone: "green" },
    { value: "opening", label: "Opening Balances", shortLabel: "Opening", icon: CalendarRange, tone: "sky" },
    { value: "reconciliation", label: "Reconciliation", icon: GitCompare, tone: "purple" },
    { value: "bank-rec", label: "Bank Rec", icon: Landmark, tone: "slate" },
  ],
  [
    { value: "fx-revaluation", label: "FX Reval", icon: RefreshCw, tone: "amber" },
    { value: "recurring", label: "Recurring", icon: Repeat, tone: "violet" },
    { value: "checks", label: "Checks", icon: FileText, tone: "orange" },
    { value: "cost-centers", label: "Cost Centers", icon: Building2, tone: "slate" },
  ],
];

const Accounting = () => {
  const { logout, invoices, purchaseOrders, paymentOrders, activeOrganizationId } = useAppContext();
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
    setOpeningBalance,
    periodClosures,
    asOfPeriod,
    asOfPeriodLocked,
    isDateLocked,
    closePeriod,
    reopenPeriod,
  } = useLedger();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodLockType>("month");
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1);
  const [periodQuarter, setPeriodQuarter] = useState(() => Math.floor(new Date().getMonth() / 3) + 1);
  const [closeNote, setCloseNote] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenTargetId, setReopenTargetId] = useState("");
  const [periodActionLoading, setPeriodActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("trial-balance");
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
  const [ledgerFocus, setLedgerFocus] = useState<LedgerActivityFocus | null>(null);
  const [quickVoucherEntryId, setQuickVoucherEntryId] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const accountingPaletteTabs = useMemo(
    () => ACCOUNTING_TAB_ROWS.flat().map(({ value, label, icon }) => ({ value, label, icon })),
    [],
  );

  const openAccountActivity = useCallback((accountId: string, label: string) => {
    setLedgerFocus({ kind: "account", accountId, label });
  }, []);

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

  useEffect(() => {
    if (!isLebaneseCoa || !financeStoreId) {
      setPcgClientAccounts([]);
      return;
    }
    let cancelled = false;
    void loadPcgClientAccounts(financeStoreId).then((rows) => {
      if (!cancelled) setPcgClientAccounts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [isLebaneseCoa, financeStoreId]);

  // Lebanese stores default to Workspace on first load only — do not block Trial Balance afterward.
  useEffect(() => {
    if (isLebaneseCoa) {
      setActiveTab((current) => (current === "trial-balance" ? "workspace" : current));
    }
  }, [isLebaneseCoa]);

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

  const openClientAccountFromPcg = useCallback((account: LebanesePcgAccount) => {
    setPcgPrefillAccount(account);
    setPcgPrefillKey((key) => key + 1);
    setActiveTab("coa");
  }, []);

  const [vatMonth, setVatMonth] = useState(() => new Date().getMonth() + 1);
  const [vatYear, setVatYear] = useState(() => new Date().getFullYear());
  const vatPeriod = useMemo(() => monthBounds(vatYear, vatMonth), [vatYear, vatMonth]);

  const [plMonth, setPlMonth] = useState(() => new Date().getMonth() + 1);
  const [plYear, setPlYear] = useState(() => new Date().getFullYear());
  const plPeriod = useMemo(() => monthBounds(plYear, plMonth), [plYear, plMonth]);

  const [cfMonth, setCfMonth] = useState(() => new Date().getMonth() + 1);
  const [cfYear, setCfYear] = useState(() => new Date().getFullYear());
  const cfPeriod = useMemo(() => monthBounds(cfYear, cfMonth), [cfYear, cfMonth]);

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

  const vatFiling = useMemo(
    () =>
      buildVatFilingSummary(accounts, entries, lines, {
        startDate: vatPeriod.start,
        endDate: vatPeriod.end,
        currency: entries[0]?.currency || "USD",
      }),
    [accounts, entries, lines, vatPeriod.start, vatPeriod.end],
  );

  const incomeStatement = useMemo(
    () => buildIncomeStatement(accounts, entries, lines, plPeriod.start, plPeriod.end),
    [accounts, entries, lines, plPeriod.start, plPeriod.end],
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
        startDate: cfPeriod.start,
        endDate: cfPeriod.end,
        currency: entries[0]?.currency || "USD",
      }),
    [accounts, entries, lines, cfPeriod.start, cfPeriod.end],
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
      if (isDateLocked(new Date(payload.date).toISOString())) {
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
    if (isLebaneseCoa) {
      return {
        cashOnHand: tbBalanceForCodes(trialBalance, [...LEBANESE_PCG_GL_CODES.cash]),
        bankBalance: tbBalanceForCodes(trialBalance, [...LEBANESE_PCG_GL_CODES.bank]),
        accountsReceivable: arAging.subledgerTotal,
        accountsPayable: apAging.subledgerTotal,
      };
    }
    return {
      cashOnHand: cashBalance.cash || 0,
      bankBalance: cashBalance.bank || 0,
      accountsReceivable: arAging.subledgerTotal,
      accountsPayable: apAging.subledgerTotal,
    };
  }, [isLebaneseCoa, trialBalance, cashBalance, arAging.subledgerTotal, apAging.subledgerTotal]);

  const reconciliation = useMemo(
    () => buildReconciliationReport(accounts, entries, lines, asOfDate, subledgerTotals, { lebaneseCoa: isLebaneseCoa }),
    [accounts, entries, lines, asOfDate, subledgerTotals, isLebaneseCoa],
  );

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
    if (isDateLocked(new Date(payload.date).toISOString())) {
      toast.error("That period is closed — cannot post journal entries for that date.");
      return;
    }
    if (payload.lines.length < 2) {
      toast.error("Add at least two lines with amounts.");
      return;
    }
    setPosting(true);
    try {
      const result = await postVoucherEntry({
        date: new Date(payload.date).toISOString(),
        memo: payload.memo,
        lines: payload.lines,
        voucherType: payload.voucherType,
        voucherMeta: (payload.voucherMeta || {}) as VoucherMeta,
      });
      toast.success(
        result.idempotentReplay
          ? "Entry already posted (idempotent)."
          : `Posted ${result.voucherNumber || result.entryId}`,
      );
      setActiveTab("vouchers");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post entry");
    } finally {
      setPosting(false);
    }
  };

  const handleOpeningBalance = async () => {
    if (!openingAccountId || !openingAmount) {
      toast.error("Select account and amount.");
      return;
    }
    if (isDateLocked(new Date(openingDate).toISOString())) {
      toast.error("That period is closed — cannot post opening balances for that date.");
      return;
    }
    try {
      await setOpeningBalance(openingAccountId, Number(openingAmount), new Date(openingDate).toISOString());
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
  const periodLockBanner = asOfPeriodLocked && asOfPeriod ? (
    <Badge variant="outline" className="border-amber-500 text-amber-800 bg-amber-50">
      <Lock className="h-3 w-3 mr-1" />
      {asOfPeriod.label} closed
    </Badge>
  ) : null;

  return (
    <FinancePageShell onLogout={logout}>
      <div className="space-y-6">
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
                  "This page is the general ledger area of the system.",
                  "Use it for journal entries, Trial Balance, Balance Sheet, and other book-level checks after sales, purchases, and expenses have been recorded.",
                ]}
              />
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              General ledger, manual journals, trial balance, and balance sheet.
            </p>
          </div>
          <div className="finance-as-of-toolbar flex items-center gap-2">
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
            {closedPeriods.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setReopenDialogOpen(true)}>
                <Unlock className="h-4 w-4 mr-1" />
                Reopen
              </Button>
            )}
          </div>
        </div>

        <SystemGuideBanner enabled={systemGuideEnabled} />

        {closedPeriods.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {closedPeriods.map((p) => (
              <Badge key={p.id} variant="outline" className="border-amber-500 text-amber-800">
                <Lock className="h-3 w-3 mr-1" />
                {p.label} locked
              </Badge>
            ))}
          </div>
        )}

        <AccountingQuickBar
          totals={subledgerTotals}
          balanced={trialBalance.balanced}
          asOfDate={asOfDate}
          loading={loading}
          systemGuideEnabled={systemGuideEnabled}
          onNavigate={setActiveTab}
          onOpenSearch={() => setCommandPaletteOpen(true)}
        />

        <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close accounting period</DialogTitle>
              <DialogDescription>
                Once closed, no new journal entries can post with a date in that period. Existing entries become read-only until an admin reopens the period.
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
                          <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
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
                    {closedPeriods.map((p) => (
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="finance-accounting-tabs-shell">
            {ACCOUNTING_TAB_ROWS.map((row, rowIndex) => (
              <TabsList
                key={`accounting-tab-row-${rowIndex}`}
                className="finance-accounting-tabs-row !inline-flex !h-auto !w-full !flex-wrap !items-stretch !justify-start !gap-1.5 !rounded-2xl !border !bg-transparent !p-1.5 !text-inherit shadow-none"
              >
                {row.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={`finance-accounting-tab finance-accounting-tab--${tab.tone} !rounded-xl !border !border-transparent !bg-transparent !px-2.5 !py-2 !shadow-none data-[state=active]:!shadow-none`}
                    >
                      <span className={`finance-accounting-tab__icon-wrap finance-accounting-tab__icon-wrap--${tab.tone}`}>
                        <Icon className="finance-accounting-tab__icon" aria-hidden />
                      </span>
                      <span className="finance-accounting-tab__label">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            ))}
          </div>

          <TabsContent value="workspace" className="mt-4">
            <AccountantWorkspacePanel
              accounts={accounts}
              entries={entries}
              lines={lines}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              isLebaneseCoa={isLebaneseCoa}
              onAddClientAccount={openClientAccountFromPcg}
              onOpenVouchers={() => setActiveTab("vouchers")}
              onViewAccount={openAccountActivity}
              onViewEntry={setQuickVoucherEntryId}
              systemGuideEnabled={systemGuideEnabled}
            />
          </TabsContent>

          <TabsContent value="coa" className="mt-4">
            {isLebaneseCoa ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Your Working Account Numbers
                    <SystemGuideInfo
                      enabled={systemGuideEnabled}
                      label="What working account numbers are"
                      title="Client sub-accounts"
                      content={[
                        "Map your accountant's own account numbers under the official PCG chart.",
                        "Reports and exports show these codes; underlying ledger balances stay on Grabio posting accounts.",
                      ]}
                    />
                  </CardTitle>
                  <CardDescription>
                    Add only the accounts the accountant needs under the Lebanese PCG chart. Reports show these
                    numbers while ledger totals stay unchanged.
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
              </Card>
            ) : null}

            {isLebaneseCoa ? (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Account List — Lebanese PCG
                    <SystemGuideInfo
                      enabled={systemGuideEnabled}
                      label="What the PCG list is"
                      title="Lebanese PCG chart"
                      content={[
                        "Reference list from the standard Lebanese plan comptable. Use it to pick parent codes when adding working numbers.",
                        "G = group header, D = detail account. Balances post to operational Grabio accounts linked to each PCG code.",
                      ]}
                    />
                  </CardTitle>
                  <CardDescription>
                    Standard chart from your PCG template (Code · Name · Arabic · G/D · Cur). Operational GL
                    balances remain on Grabio posting accounts; reports show PCG or your client sub-account codes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LebanesePcgCoaPanel
                    activeLedgerAccounts={accounts.filter((a) => a.isActive)}
                    pcgClientAccounts={pcgClientAccounts}
                    onAddClientAccount={openClientAccountFromPcg}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card className={isLebaneseCoa ? "mt-4" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isLebaneseCoa ? "Active posting accounts (Grabio)" : "Chart of Accounts"}
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What the chart of accounts is"
                    title="Chart of Accounts"
                    content={[
                      "Every ledger account used for posting sales, purchases, expenses, and manual vouchers.",
                      "Use Ledger on a row to see activity, or Sync/Initialize to add missing PCG template accounts.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>
                  {accounts.length
                    ? isLebaneseCoa
                      ? `${accounts.length} ledger accounts (${accounts.filter((a) => a.isPcgChart).length} PCG chart + ${accounts.filter((a) => !a.isPcgChart).length} operational posting). Click Initialize to add any missing Excel chart rows.`
                      : `${accounts.length} accounts`
                    : "Default SMB template will seed on first load."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="mb-4" onClick={() => void ensureCoa()}>
                  {isLebaneseCoa ? "Sync full PCG chart" : "Initialize / Refresh COA"}
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      {isLebaneseCoa ? <TableHead>PCG code</TableHead> : null}
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
                        <TableCell className="font-mono">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        {isLebaneseCoa ? (
                          <TableCell className="font-mono text-xs">
                            <PcgMappedCodeBadge grabioCode={a.code} clientByGrabio={clientByGrabio} showGrabioHint />
                          </TableCell>
                        ) : null}
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
                            onClick={() =>
                              openAccountActivity(
                                a.id,
                                isLebaneseCoa
                                  ? formatPcgAccountLabel(a, accountingLanguage, clientByGrabio)
                                  : `${a.code} · ${a.name}`,
                              )
                            }
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
                  accounts={accounts}
                  accountingLanguage={accountingLanguage}
                  isLebaneseCoa={isLebaneseCoa}
                  pcgClientAccounts={pcgClientAccounts}
                  posting={posting}
                  onPost={(p) => void handlePostVoucher(p)}
                />
              </CardContent>
            </Card>
            <div className="mt-4">
              <VoucherRegisterPanel
                entries={entries}
                lines={lines}
                accountingLanguage={accountingLanguage}
                isLebaneseCoa={isLebaneseCoa}
                pcgClientAccounts={pcgClientAccounts}
                systemGuideEnabled={systemGuideEnabled}
              />
            </div>
          </TabsContent>

          <TabsContent value="vat-filing" className="mt-4">
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
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <Label htmlFor="vat-month">Period</Label>
                    <div className="flex gap-2 mt-1">
                      <Select value={String(vatMonth)} onValueChange={(v) => setVatMonth(Number(v))}>
                        <SelectTrigger id="vat-month" className="w-[140px]">
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
                      <Select value={String(vatYear)} onValueChange={(v) => setVatYear(Number(v))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[vatYear - 1, vatYear, vatYear + 1].map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {vatFiling.startDate} → {vatFiling.endDate}
                    </p>
                  </div>
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
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <Label>Month</Label>
                      <Select value={String(cfMonth)} onValueChange={(v) => setCfMonth(Number(v))}>
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
                      <Select value={String(cfYear)} onValueChange={(v) => setCfYear(Number(v))}>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Trial Balance
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What Trial Balance does"
                    title="Trial Balance"
                    content={[
                      "Trial Balance lists each ledger account with its debit or credit balance as of the selected date.",
                      "Use it to confirm the books are balanced and to spot accounts that need review before you trust the final reports.",
                    ]}
                  />
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  Read-only · as of {asOfDate}
                  {isLebaneseCoa ? (
                    <Badge variant="secondary">PCG / client codes (Phase 3)</Badge>
                  ) : null}
                  {periodLockBanner}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!loading && accounts.length > 0 && entries.length === 0 ? (
                  <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
                    Ledger accounts loaded but no journal history yet for this store. Click <strong>Refresh</strong> above
                    or confirm you are on the correct store ({financeStoreId || activeOrganizationId || "unknown"}).
                  </p>
                ) : null}
                {!loading && accounts.length === 0 && financeStoreId ? (
                  <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
                    No ledger data loaded. Click <strong>Refresh</strong> or use Initialize / Sync COA on the Chart of Accounts tab.
                  </p>
                ) : null}
                <div className="mb-4 flex items-center gap-2">
                  {trialBalance.balanced ? (
                    <Badge className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Debits = Credits
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Out of balance
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(trialBalance.totalDebits)} debits · {formatCurrency(trialBalance.totalCredits)} credits
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isLebaneseCoa ? "PCG code" : "Code"}</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.rows.map((r) => (
                      <TableRow key={r.accountId}>
                        <TableCell>
                          {isLebaneseCoa ? (
                            <PcgMappedCodeBadge grabioCode={r.accountCode} clientByGrabio={clientByGrabio} />
                          ) : (
                            <span className="font-mono">{r.accountCode}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isLebaneseCoa ? (
                            (() => {
                              const pcg = resolvePcgDisplay(r.accountCode, r.accountName, clientByGrabio);
                              if (!pcg) return r.accountName;
                              return (
                                <div>
                                  <div>{pcg.name}</div>
                                  {arabicEntry && pcg.nameAr ? (
                                    <div dir="rtl" className="text-xs text-muted-foreground text-right">{pcg.nameAr}</div>
                                  ) : null}
                                </div>
                              );
                            })()
                          ) : (
                            r.accountName
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{r.accountType}</TableCell>
                        <TableCell className="text-right">{r.debit ? formatCurrency(r.debit) : "—"}</TableCell>
                        <TableCell className="text-right">{r.credit ? formatCurrency(r.credit) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openAccountActivity(
                                r.accountId,
                                isLebaneseCoa
                                  ? `${resolvePcgDisplay(r.accountCode, r.accountName, clientByGrabio)?.pcgCode || r.accountCode} · ${r.accountName}`
                                  : `${r.accountCode} · ${r.accountName}`,
                              )
                            }
                          >
                            Ledger
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell colSpan={4}>Totals</TableCell>
                      <TableCell className="text-right">{formatCurrency(trialBalance.totalDebits)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(trialBalance.totalCredits)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Income statement (P&L)
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What P&L shows"
                    title="Profit & Loss"
                    content={[
                      "Period revenue minus expenses — the standard report every Lebanon ERP (Libra, Odoo, PIMS2) provides alongside Trial Balance.",
                      "Use monthly period selectors; export CSV for your accountant or MoF filing pack.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>Period activity only · {plPeriod.start} → {plPeriod.end}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <Label>Month</Label>
                    <Select value={String(plMonth)} onValueChange={(v) => setPlMonth(Number(v))}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Select value={String(plYear)} onValueChange={(v) => setPlYear(Number(v))}>
                      <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[plYear - 1, plYear, plYear + 1].map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={downloadPlCsv}>Export CSV</Button>
                </div>
                {([
                  incomeStatement.revenue,
                  incomeStatement.otherIncome,
                  incomeStatement.cogs,
                  incomeStatement.operatingExpenses,
                  incomeStatement.financialExpenses,
                ] as const).map((section) => (
                  section.rows.length > 0 ? (
                    <div key={section.title}>
                      <h3 className="font-semibold mb-2">{section.title}</h3>
                      <Table>
                        <TableBody>
                          {section.rows.map((r) => (
                            <TableRow key={r.accountId}>
                              <TableCell className="font-mono w-24">
                                {isLebaneseCoa ? <PcgMappedCodeBadge grabioCode={r.code} clientByGrabio={clientByGrabio} /> : r.code}
                              </TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                              <TableCell className="w-[90px]">
                                <Button variant="ghost" size="sm" onClick={() => openAccountActivity(r.accountId, `${r.code} · ${r.name}`)}>Ledger</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-medium border-t">
                            <TableCell colSpan={2}>Subtotal</TableCell>
                            <TableCell className="text-right">{formatCurrency(section.subtotal)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : null
                ))}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm border-t pt-4">
                  <span>Gross profit: <strong>{formatCurrency(incomeStatement.grossProfit)}</strong></span>
                  <span>Operating income: <strong>{formatCurrency(incomeStatement.operatingIncome)}</strong></span>
                  <span>Total revenue: <strong>{formatCurrency(incomeStatement.totalRevenue)}</strong></span>
                  <span>Net income: <strong>{formatCurrency(incomeStatement.netIncome)}</strong></span>
                </div>
              </CardContent>
            </Card>
            <YearEndClosePanel
              accounts={accounts}
              entries={entries}
              lines={lines}
              systemGuideEnabled={systemGuideEnabled}
              posting={posting}
              onPost={handleAdjustmentPost}
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
              systemGuideEnabled={systemGuideEnabled}
              onOpenEntry={setQuickVoucherEntryId}
            />
          </TabsContent>

          <TabsContent value="cost-centers" className="mt-4">
            <CostCentersPanel storeId={financeStoreId} systemGuideEnabled={systemGuideEnabled} />
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Subledger Reconciliation
                  <SystemGuideInfo
                    enabled={systemGuideEnabled}
                    label="What reconciliation checks"
                    title="Subledger reconciliation"
                    content={[
                      "Compares general ledger balances to operational subledgers (cash, bank, AR, AP) as of the date above.",
                      "A variance means invoices, payments, or postings need review before you trust the books.",
                    ]}
                  />
                </CardTitle>
                <CardDescription>
                  GL vs operational snapshots. AR and AP subledger totals match the AR/AP Aging tabs (as of date above).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">GL</TableHead>
                      <TableHead className="text-right">Subledger</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliation.rows.map((r) => (
                      <TableRow key={r.label}>
                        <TableCell>{r.label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.glAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.subledgerAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.variance)}</TableCell>
                        <TableCell>
                          {r.matched ? (
                            <Badge variant="outline" className="text-green-700">Matched</Badge>
                          ) : (
                            <Badge variant="destructive">Variance</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
            setActiveTab("vouchers");
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
        />
        <AccountingCommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          tabs={accountingPaletteTabs}
          accounts={accounts}
          entries={entries}
          isLebaneseCoa={isLebaneseCoa}
          pcgClientAccounts={pcgClientAccounts}
          onSelectTab={setActiveTab}
          onSelectAccount={openAccountActivity}
          onSelectEntry={setQuickVoucherEntryId}
        />
      </div>
    </FinancePageShell>
  );
};

export default Accounting;
