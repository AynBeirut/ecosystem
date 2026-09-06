import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AccountingSideSheet from "@/components/AccountingSideSheet";
import InvoiceAllocationDialog from "@/components/InvoiceAllocationDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  JournalLineInput,
  LedgerAccount,
  LedgerCostCenter,
  PcgClientAccount,
  SettlementAllocationInput,
  VoucherLineSettlement,
  VoucherType,
} from "@/types/generalLedger";
import type { Invoice, PurchaseOrder } from "@/types/index";
import { type AccountingLanguage } from "@/lib/grabio/accountingMode";
import {
  isAccountsPayableCode,
  isAccountsReceivableCode,
} from "@/lib/ledger/accountControlCodes";
import { buildOpenInvoices, buildOpenPurchaseOrders, validateAllocations } from "@/lib/ledger/openItems";
import { loadCostCenters } from "@/lib/firestore/costCentersFirestore";
import VoucherRegisterPanel, { type RegisterFilter } from "@/components/VoucherRegisterPanel";
import type { JournalEntry, JournalLine } from "@/types/generalLedger";
import {
  buildClientByGrabioMap,
  buildClientByParentPcgMap,
  displayPcgCodeForLedgerRow,
  mapPcgCodeToGrabioCodes,
  resolvePcgDisplay,
} from "@/lib/ledger/grabioToPcgMap";
import VoucherLinesEditor from "@/components/VoucherLinesEditor";
import {
  type DraftLine,
  emptyLine,
  mapDraftLines,
  draftLinesTotals,
  draftLinesBalanced,
  draftMatrixBalanced,
  journalLinesToDraft,
  seedPvLines,
  seedRvLines,
  seedCvLines,
  firstDebitLine,
  firstCreditLine,
  findKnockOffAccountId,
  previewLineSideAmount,
  previewLineFxLabel,
} from "@/lib/ledger/voucherDraftLineUtils";
import { sanitizeJournalMemoForDisplay } from '@/lib/ledger/ledgerHumanLabels';
import { assertUniqueVoucherReference, peekAutoVoucherReference } from '@/lib/ledger/voucherReference';
import { validateBalancedLines } from '@/lib/ledger/postingService';
import { parseVoucherAmountNumber } from '@/lib/ledger/voucherAmountInput';
import { parseJournalDateInput } from "@/lib/ledger/periodLockCore";
import { applyRvSalesDiscount, resolveSaleDiscountAmount, type SaleDiscountMode } from '@/lib/ledger/salesDiscountPosting';
import VoucherSaleTotalsBand, {
  isSalesDiscountLedgerLine,
  parseSaleTotalsFromMeta,
} from '@/components/VoucherSaleTotalsBand';
import type { OpenVoucherEntryHandler } from "@/lib/accounting/accountingNavigation";
import ReportAmountCell from "@/components/ReportAmountCell";
import {
  defaultReportCurrencyMode,
  normalizeLedgerCurrency,
  resolveStoreLedgerCurrency,
  type ReportCurrencyMode,
} from "@/lib/ledger/formatLedgerAmount";

const LEBANESE_VOUCHER_TAB_CLASS =
  'legacy-erp-tab !rounded-none !text-white !shadow-none data-[state=active]:!bg-[#1e4a8a] data-[state=active]:!text-white data-[state=inactive]:!bg-[#3d76c8] data-[state=inactive]:!text-white hover:!bg-[#2a5dad] hover:!text-white';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function resolvePartyFromLedgerAccount(account: LedgerAccount | undefined) {
  if (!account) return { label: "", partyId: undefined as string | undefined, partyType: undefined as LedgerAccount["partyType"] };
  const label = String(account.name || account.code || "").trim();
  const partyId = String(account.partyId || "").trim() || undefined;
  const partyType = account.partyType;
  return { label, partyId, partyType };
}

type Props = {
  storeId?: string;
  accounts: LedgerAccount[];
  accountingLanguage?: AccountingLanguage;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  invoices?: Invoice[];
  purchaseOrders?: PurchaseOrder[];
  paymentOrders?: Array<{ purchaseOrderId?: string; amount?: number }>;
  settlements?: VoucherLineSettlement[];
  mainCurrency?: string;
  posting: boolean;
  onPost: (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  }) => Promise<void>;
  registerEntries?: JournalEntry[];
  registerLines?: JournalLine[];
  systemGuideEnabled?: boolean;
  onRegisterPostDraft?: (entryId: string) => void;
  postingRegisterDraft?: boolean;
  onRegisterReverse?: (entryId: string) => void;
  reversingRegister?: boolean;
  fxRateDefault?: number;
  prefillEntry?: JournalEntry | null;
  prefillLines?: JournalLine[];
  onPrefillConsumed?: () => void;
  onReversePosted?: (entryId: string) => Promise<void>;
  onOpenEntry?: OpenVoucherEntryHandler;
};

/** Map PCG display/chart rows to Grabio operational account ids used for posting. */
function resolveOperationalAccountId(
  accountId: string,
  accounts: LedgerAccount[],
  acctById: Map<string, LedgerAccount>,
): string {
  const account = acctById.get(accountId) ?? accounts.find((row) => row.id === accountId);
  if (!account || !account.isPcgChart) return accountId;
  const grabioCodes = mapPcgCodeToGrabioCodes(account.code);
  if (grabioCodes.length === 1) {
    const operational = accounts.find(
      (row) => row.code === grabioCodes[0] && row.isActive && !row.isPcgChart,
    );
    if (operational) return operational.id;
  }
  return accountId;
}

function activeAccounts(accounts: LedgerAccount[], isLebaneseCoa?: boolean) {
  /** JV lines often need inactive operational accounts (FX, transport). */
  const JV_VOUCHER_CODES = new Set(["450", "704", "653", "655", "506"]);
  const active = accounts.filter(
    (a) => a.isActive || (isLebaneseCoa && JV_VOUCHER_CODES.has(a.code)),
  );
  if (!isLebaneseCoa) return active.sort((a, b) => a.code.localeCompare(b.code));
  // Vouchers post to Grabio operational accounts (601, 102, …). PCG template rows are display-only.
  return active
    .filter((account) => account.pcgKind !== "G" && !account.isPcgChart)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}


export default function VoucherEntryPanel({
  storeId,
  accounts,
  accountingLanguage,
  isLebaneseCoa,
  pcgClientAccounts = [],
  invoices = [],
  purchaseOrders = [],
  paymentOrders = [],
  settlements = [],
  mainCurrency,
  posting,
  onPost,
  registerEntries = [],
  registerLines = [],
  systemGuideEnabled = false,
  onRegisterPostDraft,
  postingRegisterDraft,
  onRegisterReverse,
  reversingRegister,
  fxRateDefault,
  prefillEntry,
  prefillLines = [],
  onPrefillConsumed,
  onReversePosted,
  onOpenEntry,
}: Props) {
  const accts = useMemo(() => activeAccounts(accounts, isLebaneseCoa), [accounts, isLebaneseCoa]);
  const acctById = useMemo(() => new Map(accts.map((a) => [a.id, a])), [accts]);
  const allAcctById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const clientByParentPcg = useMemo(
    () => buildClientByParentPcgMap(pcgClientAccounts),
    [pcgClientAccounts],
  );
  const formatPreviewAccount = (acct: LedgerAccount) => {
    if (!isLebaneseCoa) return `${acct.code} · ${acct.name}`;
    const pcgCode = displayPcgCodeForLedgerRow(acct, clientByGrabio, clientByParentPcg);
    const name = resolvePcgDisplay(acct.code, acct.name, clientByGrabio)?.name ?? acct.name;
    return `${pcgCode} · ${name}`;
  };
  const [pvStatus, setPvStatus] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [costCenters, setCostCenters] = useState<LedgerCostCenter[]>([]);
  const [voucherTab, setVoucherTab] = useState<VoucherType>("JV");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [pvLines, setPvLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [rvLines, setRvLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [cvLines, setCvLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [crnLines, setCrnLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [drnLines, setDrnLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [editLockedReference, setEditLockedReference] = useState<string | null>(null);
  const [voucherExchangeRate, setVoucherExchangeRate] = useState("");
  const [editingPostedEntryId, setEditingPostedEntryId] = useState("");
  const [preview, setPreview] = useState<{
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  } | null>(null);
  const [previewPosting, setPreviewPosting] = useState(false);
  const pendingPreviewAction = useRef<(() => void | Promise<void>) | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [pendingPost, setPendingPost] = useState<{
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
    paymentAmount: number;
    openItems: ReturnType<typeof buildOpenInvoices>;
    partyLabel: string;
  } | null>(null);

  const [pvRef, setPvRef] = useState("");
  const [pvCheckNumber, setPvCheckNumber] = useState("");

  const [rvRef, setRvRef] = useState("");
  const [rvDiscountType, setRvDiscountType] = useState<SaleDiscountMode>("fixed");
  const [rvDiscountValue, setRvDiscountValue] = useState("");

  const [cvRef, setCvRef] = useState("");

  const registerFilter = useMemo<RegisterFilter>(() => {
    if (voucherTab === "JV") return "jv";
    if (voucherTab === "PV") return "pv";
    if (voucherTab === "RV") return "rv";
    if (voucherTab === "CV") return "cv";
    if (voucherTab === "CRN") return "crn";
    if (voucherTab === "DRN") return "drn";
    return "all";
  }, [voucherTab]);

  const ledgerCurrency = useMemo(
    () => resolveStoreLedgerCurrency(mainCurrency, { secondaryCurrency: isLebaneseCoa ? "LBP" : undefined }),
    [mainCurrency, isLebaneseCoa],
  );
  const previewAmountMode = useMemo<ReportCurrencyMode>(() => {
    return defaultReportCurrencyMode(ledgerCurrency);
  }, [ledgerCurrency]);

  const autoVoucherReference = useMemo(() => {
    if (editLockedReference) return editLockedReference;
    return peekAutoVoucherReference(voucherTab, entryDate, registerEntries);
  }, [editLockedReference, voucherTab, entryDate, registerEntries]);

  const effectiveVoucherRate = useMemo(() => {
    const manual = Number(voucherExchangeRate);
    if (manual > 0) return manual;
    return fxRateDefault && fxRateDefault > 0 ? fxRateDefault : undefined;
  }, [voucherExchangeRate, fxRateDefault]);

  const matrixJvFooter = Boolean(isLebaneseCoa);
  const jdEdwardsGrid = matrixJvFooter;
  const lbFieldLabel = "text-[11px] font-semibold uppercase tracking-wide text-slate-600";

  const lineHasAmount = (line: DraftLine) =>
    parseVoucherAmountNumber(line.debit) > 0 || parseVoucherAmountNumber(line.credit) > 0;

  const assertAccountsOnAmountLines = (lines: DraftLine[]): boolean => {
    if (lines.some((line) => lineHasAmount(line) && !line.accountId)) {
      toast.error("Select an account on every line with an amount.");
      return false;
    }
    return true;
  };

  const withAutoReference = (meta: Record<string, unknown> = {}) => ({
    ...meta,
    externalReference: autoVoucherReference,
  });

  const sharedLinesEditorProps = {
    ledgerCurrency,
    fxRateDefault,
    exchangeRate: effectiveVoucherRate,
    jdEdwardsGrid,
    previewAmountMode,
    isLebaneseCoa,
    matrixJvFooter,
    accounts: accts,
    accountingLanguage,
    pcgClientAccounts,
    costCenters,
    posting,
    showValueDate: false as const,
    voucherDate: entryDate,
    hint: isLebaneseCoa ? "" : undefined,
  };

  useEffect(() => {
    if (fxRateDefault && fxRateDefault > 0) {
      setVoucherExchangeRate(String(fxRateDefault));
    }
  }, [fxRateDefault]);

  const isVoucherBalanced = (lines: DraftLine[]) =>
    matrixJvFooter
      ? draftMatrixBalanced(lines, ledgerCurrency, effectiveVoucherRate, jdEdwardsGrid)
      : draftLinesBalanced(lines, ledgerCurrency, jdEdwardsGrid, effectiveVoucherRate);

  const mapVoucherLines = (lines: DraftLine[]) =>
    mapDraftLines(lines, ledgerCurrency, entryDate, effectiveVoucherRate, jdEdwardsGrid);

  const voucherLedgerTotal = (lines: DraftLine[]) =>
    draftLinesTotals(lines, ledgerCurrency, jdEdwardsGrid, effectiveVoucherRate);

  const rvNetTotal = useMemo(
    () => round2(voucherLedgerTotal(rvLines).debit),
    [rvLines, ledgerCurrency, jdEdwardsGrid, effectiveVoucherRate],
  );

  const rvDiscountInputValue = useMemo(
    () => round2(Math.max(0, parseVoucherAmountNumber(rvDiscountValue))),
    [rvDiscountValue],
  );

  const rvDiscountAmount = useMemo(
    () =>
      resolveSaleDiscountAmount({
        discountType: rvDiscountType,
        discountValue: rvDiscountInputValue,
        netTotal: rvNetTotal,
      }),
    [rvDiscountType, rvDiscountInputValue, rvNetTotal],
  );

  const rvSaleTotals = useMemo(() => {
    const net = rvNetTotal;
    const discount = rvDiscountAmount;
    const subtotal = round2(net + discount);
    return { subtotal, discount, net };
  }, [rvNetTotal, rvDiscountAmount]);

  const renderPreviewAmount = (amount: number, currency = ledgerCurrency) => (
    <ReportAmountCell
      amount={amount}
      storeCurrency={currency}
      mode={normalizeLedgerCurrency(currency) === "LBP" ? "LBP" : previewAmountMode}
      usdToLbp={fxRateDefault}
    />
  );

  const renderPreviewLineAmount = (line: JournalLineInput, side: "debit" | "credit") => {
    const display = previewLineSideAmount(line, side, ledgerCurrency, jdEdwardsGrid);
    if (!display) return "—";
    return renderPreviewAmount(display.amount, display.currency);
  };

  const voucherScreenTitle = useMemo(() => {
    if (voucherTab === "PV") return "Payment voucher (PV)";
    if (voucherTab === "RV") return "Receipt voucher (RV)";
    if (voucherTab === "CV") return "Contra voucher (CV)";
    if (voucherTab === "CRN") return "Credit note (CRN)";
    if (voucherTab === "DRN") return "Debit note (DRN)";
    return "Journal voucher (JV)";
  }, [voucherTab]);

  useEffect(() => {
    if (!prefillEntry) return;
    const entry = prefillEntry;
    const meta = (entry.voucherMeta || {}) as Record<string, unknown>;
    const vt = (entry.voucherType || "JV") as VoucherType;
    setVoucherTab(vt);
    setEntryDate(entry.date.slice(0, 10));
    setMemo(sanitizeJournalMemoForDisplay(entry.memo || ""));
    setEditLockedReference(
      String(
        meta.externalReference || meta.paymentRef || meta.receiptRef || meta.transferRef || "",
      ) || null,
    );
    setEditingPostedEntryId(entry.id);
    if (vt === "JV") {
      setDraftLines(journalLinesToDraft(prefillLines, ledgerCurrency));
    }
    if (vt === "PV") {
      setPvLines(journalLinesToDraft(prefillLines, ledgerCurrency));
      setPvRef(String(meta.paymentRef || ""));
      setPvCheckNumber(String(meta.checkNumber || ""));
    }
    if (vt === "RV") {
      setRvLines(journalLinesToDraft(prefillLines, ledgerCurrency));
      setRvRef(String(meta.receiptRef || ""));
      const prefilledDiscountType = meta.discountType === "percentage" ? "percentage" : "fixed";
      const prefilledDiscountValue = Number(meta.discountValue ?? meta.discountAmount);
      setRvDiscountType(prefilledDiscountType);
      setRvDiscountValue(
        Number.isFinite(prefilledDiscountValue) && prefilledDiscountValue > 0
          ? String(prefilledDiscountValue)
          : "",
      );
    }
    if (vt === "CV") {
      setCvLines(journalLinesToDraft(prefillLines, ledgerCurrency));
      setCvRef(String(meta.transferRef || ""));
    }
    if (vt === "CRN") {
      setCrnLines(journalLinesToDraft(prefillLines, ledgerCurrency));
    }
    if (vt === "DRN") {
      setDrnLines(journalLinesToDraft(prefillLines, ledgerCurrency));
    }
    onPrefillConsumed?.();
  }, [prefillEntry?.id]);

  useEffect(() => {
    if (!storeId) return;
    void loadCostCenters(storeId).then(setCostCenters);
  }, [storeId]);

  useEffect(() => {
    setPvLines((prev) => (prev.some((line) => line.accountId) ? prev : seedPvLines(accts, ledgerCurrency)));
  }, [accts, ledgerCurrency]);

  useEffect(() => {
    setRvLines((prev) => (prev.some((line) => line.accountId) ? prev : seedRvLines(accts, ledgerCurrency)));
  }, [accts, ledgerCurrency]);

  useEffect(() => {
    setCvLines((prev) => (prev.some((line) => line.accountId) ? prev : seedCvLines(accts, ledgerCurrency)));
  }, [accts, ledgerCurrency]);


  const draftLinesForType = (voucherType: VoucherType): DraftLine[] => {
    if (voucherType === "JV") return draftLines;
    if (voucherType === "CRN") return crnLines;
    if (voucherType === "DRN") return drnLines;
    if (voucherType === "PV") return pvLines;
    if (voucherType === "RV") return rvLines;
    if (voucherType === "CV") return cvLines;
    return draftLines;
  };

  const jvBalanced = useMemo(
    () => isVoucherBalanced(draftLines),
    [draftLines, ledgerCurrency, effectiveVoucherRate, matrixJvFooter, jdEdwardsGrid],
  );

  const previewCanPost = useMemo(() => {
    if (!preview) return false;
    const validation = validateBalancedLines(preview.lines);
    if (!validation.valid) return false;
    if (!isVoucherBalanced(draftLinesForType(preview.voucherType))) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, draftLines, crnLines, drnLines, pvLines, rvLines, cvLines, matrixJvFooter, effectiveVoucherRate]);

  const finalizePost = async (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  }) => {
    const validation = validateBalancedLines(payload.lines);
    if (!validation.valid) {
      throw new Error(validation.message || "Entry must be balanced before posting.");
    }
    if (!isVoucherBalanced(draftLinesForType(payload.voucherType))) {
      throw new Error(
        matrixJvFooter
          ? "USD and LBP buckets must each balance before posting."
          : "Entry must be balanced before posting.",
      );
    }
    await onPost(payload);
  };

  const resetVoucherDraft = (voucherType: VoucherType) => {
    if (voucherType === "JV") {
      setDraftLines([emptyLine(ledgerCurrency), emptyLine(ledgerCurrency)]);
      setEditLockedReference(null);
      setMemo("");
    }
    if (voucherType === "PV") {
      setPvLines(seedPvLines(accts, ledgerCurrency));
      setPvRef("");
      setPvCheckNumber("");
    }
    if (voucherType === "RV") {
      setRvLines(seedRvLines(accts, ledgerCurrency));
      setRvRef("");
      setRvDiscount("");
    }
    if (voucherType === "CV") {
      setCvLines(seedCvLines(accts, ledgerCurrency));
      setCvRef("");
    }
    if (voucherType === "CRN") {
      setCrnLines([emptyLine(ledgerCurrency), emptyLine(ledgerCurrency)]);
    }
    if (voucherType === "DRN") {
      setDrnLines([emptyLine(ledgerCurrency), emptyLine(ledgerCurrency)]);
    }
  };

  const closePreview = () => {
    if (previewPosting) return;
    pendingPreviewAction.current = null;
    setPreview(null);
  };

  const openPreview = (
    payload: {
      voucherType: VoucherType;
      date: string;
      memo: string;
      lines: JournalLineInput[];
      voucherMeta?: Record<string, unknown>;
    },
    action: () => void | Promise<void>,
  ) => {
    pendingPreviewAction.current = action;
    setPreview(payload);
  };

  const confirmPreview = async () => {
    const action = pendingPreviewAction.current;
    const payload = preview;
    if (!action || !payload || previewPosting) return;
    const validation = validateBalancedLines(payload.lines);
    if (!validation.valid) {
      toast.error(validation.message || "Entry must be balanced before posting.");
      return;
    }
    if (matrixJvFooter && !isVoucherBalanced(draftLinesForType(payload.voucherType))) {
      toast.error("USD and LBP buckets must each balance before posting.");
      return;
    }
    setPreviewPosting(true);
    try {
      if (editingPostedEntryId && onReversePosted) {
        await onReversePosted(editingPostedEntryId);
        setEditingPostedEntryId("");
        onPrefillConsumed?.();
      }
      await action();
      pendingPreviewAction.current = null;
      setPreview(null);
      resetVoucherDraft(payload.voucherType);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post voucher.");
    } finally {
      setPreviewPosting(false);
    }
  };

  const maybeShowAllocation = (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
    knockOffAccountId: string;
    paymentAmount: number;
    partyLabel: string;
    partyId?: string;
    documentType: "invoice" | "purchase_order";
  }) => {
    const acct = acctById.get(payload.knockOffAccountId);
    if (!acct) {
      void finalizePost(payload);
      return;
    }
    const isAr = isAccountsReceivableCode(acct.code);
    const isAp = isAccountsPayableCode(acct.code);
    if (!isAr && !isAp) {
      void finalizePost(payload);
      return;
    }
    const openItems =
      payload.documentType === "invoice"
        ? buildOpenInvoices(invoices, settlements, payload.partyId)
        : buildOpenPurchaseOrders(purchaseOrders, paymentOrders, settlements, payload.partyId);
    if (!openItems.length) {
      void finalizePost(payload);
      return;
    }
    setPendingPost({
      voucherType: payload.voucherType,
      date: payload.date,
      memo: payload.memo,
      lines: payload.lines,
      voucherMeta: payload.voucherMeta,
      paymentAmount: payload.paymentAmount,
      openItems,
      partyLabel: payload.partyLabel,
    });
    setAllocOpen(true);
    toast.info('Apply this payment to open invoices/POs, or click Skip to post without allocation.');
  };

  const postWithoutAllocation = async () => {
    if (!pendingPost) return;
    try {
      await finalizePost({
        voucherType: pendingPost.voucherType,
        date: pendingPost.date,
        memo: pendingPost.memo,
        lines: pendingPost.lines,
        voucherMeta: pendingPost.voucherMeta,
      });
      if (pendingPost.voucherType === "PV") {
        setPvStatus({ kind: "success", text: "Payment voucher posted." });
        setPvLines(seedPvLines(accts, ledgerCurrency));
        setPvRef("");
        setPvCheckNumber("");
      }
      setPendingPost(null);
      setAllocOpen(false);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to post voucher.";
      if (pendingPost.voucherType === "PV") {
        setPvStatus({ kind: "error", text });
      }
      toast.error(text);
    }
  };

  const handleAllocationConfirm = async (allocations: SettlementAllocationInput[]) => {
    if (!pendingPost) return;
    const check = validateAllocations(pendingPost.paymentAmount, allocations, pendingPost.openItems);
    if (!check.valid) {
      toast.error(check.message);
      return;
    }
    try {
      await finalizePost({
        voucherType: pendingPost.voucherType,
        date: pendingPost.date,
        memo: pendingPost.memo,
        lines: pendingPost.lines,
        voucherMeta: {
          ...(pendingPost.voucherMeta || {}),
          allocations,
        },
      });
      if (pendingPost.voucherType === "PV") {
        setPvStatus({ kind: "success", text: "Payment voucher posted." });
        setPvLines(seedPvLines(accts, ledgerCurrency));
        setPvRef("");
        setPvCheckNumber("");
      }
      setPendingPost(null);
      setAllocOpen(false);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to post voucher.";
      if (pendingPost.voucherType === "PV") {
        setPvStatus({ kind: "error", text });
      }
      toast.error(text);
    }
  };

  const guardReference = (excludeEntryId?: string) => {
    try {
      assertUniqueVoucherReference(registerEntries, autoVoucherReference, excludeEntryId);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Duplicate voucher reference.";
      toast.error(text);
      throw err;
    }
  };

  const tryGuardReference = (): boolean => {
    try {
      guardReference(editingPostedEntryId || undefined);
      return true;
    } catch {
      return false;
    }
  };

  const postJv = () => {
    if (!tryGuardReference()) return;
    if (!assertAccountsOnAmountLines(draftLines)) return;
    if (!jvBalanced) {
      toast.error(
        matrixJvFooter
          ? "USD and LBP buckets must each balance before posting."
          : "Entry must be balanced before posting.",
      );
      return;
    }
    const lines = mapVoucherLines(draftLines);
    if (lines.length < 2) {
      toast.error("Add at least two lines with accounts and amounts.");
      return;
    }
    const payload = {
      voucherType: "JV" as const,
      date: entryDate,
      memo: memo || "Journal voucher",
      lines,
      voucherMeta: withAutoReference(),
    };
    openPreview(payload, () => finalizePost(payload));
  };

  const postMatrixNote = (voucherType: "CRN" | "DRN", noteLines: DraftLine[], defaultMemo: string) => {
    if (!isVoucherBalanced(noteLines)) {
      toast.error(
        matrixJvFooter
          ? "USD and LBP buckets must each balance before posting."
          : "Entry must be balanced before posting.",
      );
      return;
    }
    if (!tryGuardReference()) return;
    if (!assertAccountsOnAmountLines(noteLines)) return;
    const lines = mapVoucherLines(noteLines);
    if (lines.length < 2) {
      toast.error("Add at least two lines with accounts and amounts.");
      return;
    }
    const payload = {
      voucherType,
      date: entryDate,
      memo: memo || defaultMemo,
      lines,
      voucherMeta: withAutoReference(),
    };
    openPreview(payload, () => finalizePost(payload));
  };

  const postCrn = () => postMatrixNote("CRN", crnLines, "Credit note");
  const postDrn = () => postMatrixNote("DRN", drnLines, "Debit note");

  const postPv = async () => {
    setPvStatus(null);
    if (!tryGuardReference()) return;
    try {
      parseJournalDateInput(entryDate);
    } catch {
      const text = "Enter a valid voucher date (2000–2099).";
      setPvStatus({ kind: "error", text });
      toast.error(text);
      return;
    }
    if (!isVoucherBalanced(pvLines)) {
      const text = matrixJvFooter
        ? "USD and LBP buckets must each balance before posting."
        : "Entry must be balanced before posting.";
      setPvStatus({ kind: "error", text });
      toast.error(text);
      return;
    }
    if (!assertAccountsOnAmountLines(pvLines)) return;
    const mapped = mapVoucherLines(pvLines).map((line) => ({
      ...line,
      accountId: resolveOperationalAccountId(line.accountId, accounts, allAcctById),
    }));
    if (mapped.length < 2) {
      const text = "Add at least two lines with accounts and amounts.";
      setPvStatus({ kind: "error", text });
      toast.error(text);
      return;
    }
    const amount = voucherLedgerTotal(pvLines).debit;
    const paidToLine = firstDebitLine(mapped);
    const paidFromLine = firstCreditLine(mapped);
    if (!paidToLine || !paidFromLine || amount <= 0) {
      const text = "Add debit (expense/AP) and credit (cash/bank) lines with amounts.";
      setPvStatus({ kind: "error", text });
      toast.error(text);
      return;
    }
    const paidFromId = paidFromLine.accountId;
    const paidToId = paidToLine.accountId;
    const knockOffAccountId = findKnockOffAccountId(mapped, acctById, "ap") || paidToId;
    const knockOffAcct = allAcctById.get(knockOffAccountId) ?? acctById.get(knockOffAccountId);
    const party = resolvePartyFromLedgerAccount(knockOffAcct ?? allAcctById.get(paidToId));
    const payeeLabel = party.label || memo.trim() || "Payment";
    const paymentRef = isLebaneseCoa ? autoVoucherReference : pvRef;
    const meta: Record<string, unknown> = withAutoReference({
      payee: payeeLabel,
      paymentRef,
      checkAmount: amount,
      amount,
      paidFromAccountId: paidFromId,
      paidToAccountId: paidToId,
      ...(party.partyType === "supplier" && party.partyId ? { supplierId: party.partyId } : {}),
      ...(pvCheckNumber ? { checkNumber: pvCheckNumber, checkStatus: "issued" } : {}),
      ...(paymentRef && !pvCheckNumber ? { checkNumber: paymentRef } : {}),
    });
    const payload = {
      voucherType: "PV" as const,
      date: entryDate,
      memo: memo || `Payment voucher${payeeLabel ? ` — ${payeeLabel}` : ""}`,
      lines: mapped,
      voucherMeta: meta,
    };
    const isAp = knockOffAcct ? isAccountsPayableCode(knockOffAcct.code) : false;
    const isAr = knockOffAcct ? isAccountsReceivableCode(knockOffAcct.code) : false;
    openPreview(payload, async () => {
      if (!isAp && !isAr) {
        await finalizePost(payload);
        setPvStatus({ kind: "success", text: "Payment voucher posted." });
        setPvLines(seedPvLines(accts, ledgerCurrency));
        setPvRef("");
        setPvCheckNumber("");
        return;
      }
      maybeShowAllocation({
        ...payload,
        knockOffAccountId,
        paymentAmount: amount,
        partyLabel: payeeLabel || "Supplier",
        partyId: party.partyType === "supplier" ? party.partyId : undefined,
        documentType: "purchase_order",
      });
    });
  };

  const postRv = () => {
    if (!tryGuardReference()) return;
    if (!isVoucherBalanced(rvLines)) {
      toast.error(
        matrixJvFooter
          ? "USD and LBP buckets must each balance before posting."
          : "Entry must be balanced before posting.",
      );
      return;
    }
    if (!assertAccountsOnAmountLines(rvLines)) return;
    let mapped = mapVoucherLines(rvLines);
    if (rvDiscountAmount > 0) {
      mapped = applyRvSalesDiscount(mapped, rvDiscountAmount, accounts);
      const validation = validateBalancedLines(mapped);
      if (!validation.valid) {
        toast.error(validation.message || "Discount makes this receipt out of balance — check amounts.");
        return;
      }
    }
    if (mapped.length < 2) {
      toast.error("Add at least two lines with accounts and amounts.");
      return;
    }
    const amount = voucherLedgerTotal(rvLines).debit;
    const receivedIntoLine = firstDebitLine(mapped);
    const receivedFromLine = firstCreditLine(mapped);
    if (!receivedIntoLine || !receivedFromLine || amount <= 0) {
      toast.error("Add debit (cash/bank) and credit (AR) lines with amounts.");
      return;
    }
    const knockOffAccountId = findKnockOffAccountId(mapped, acctById, "ar") || receivedFromLine.accountId;
    const knockOffAcct = allAcctById.get(knockOffAccountId) ?? acctById.get(knockOffAccountId);
    const party = resolvePartyFromLedgerAccount(knockOffAcct ?? allAcctById.get(receivedFromLine.accountId));
    const payerLabel = party.label || memo.trim() || "Receipt";
    const meta = withAutoReference({
      payer: payerLabel,
      ...(party.partyType === "client" && party.partyId ? { clientId: party.partyId } : {}),
      receiptRef: isLebaneseCoa ? autoVoucherReference : rvRef,
      receivedIntoAccountId: receivedIntoLine.accountId,
      receivedFromAccountId: receivedFromLine.accountId,
      ...(rvDiscountAmount > 0
        ? {
            discountType: rvDiscountType,
            discountValue: String(rvDiscountInputValue),
            discountAmount: String(rvDiscountAmount),
            grossRevenue: String(rvSaleTotals.subtotal),
            netTotal: String(rvSaleTotals.net),
          }
        : {}),
    });
    const payload = {
      voucherType: "RV" as const,
      date: entryDate,
      memo: memo || `Receipt voucher${payerLabel ? ` — ${payerLabel}` : ""}`,
      lines: mapped,
      voucherMeta: meta,
    };
    openPreview(payload, () =>
      maybeShowAllocation({
        ...payload,
        knockOffAccountId,
        paymentAmount: amount,
        partyLabel: payerLabel || "Client",
        partyId: party.partyType === "client" ? party.partyId : undefined,
        documentType: "invoice",
      }),
    );
  };

  const postCv = () => {
    if (!tryGuardReference()) return;
    if (!isVoucherBalanced(cvLines)) {
      toast.error(
        matrixJvFooter
          ? "USD and LBP buckets must each balance before posting."
          : "Entry must be balanced before posting.",
      );
      return;
    }
    if (!assertAccountsOnAmountLines(cvLines)) return;
    const mapped = mapVoucherLines(cvLines);
    if (mapped.length < 2) {
      toast.error("Add at least two lines with accounts and amounts.");
      return;
    }
    const toLine = firstDebitLine(mapped);
    const fromLine = firstCreditLine(mapped);
    if (!toLine || !fromLine) return;
    const payload = {
      voucherType: "CV" as const,
      date: entryDate,
      memo: memo || "Contra voucher — transfer",
      lines: mapped,
      voucherMeta: withAutoReference({
        fromAccountId: fromLine.accountId,
        toAccountId: toLine.accountId,
        transferRef: isLebaneseCoa ? autoVoucherReference : cvRef,
      }),
    };
    openPreview(payload, async () => {
      await finalizePost(payload);
      setCvLines(seedCvLines(accts, ledgerCurrency));
      setCvRef("");
    });
  };

  return (
    <>
      <div className={isLebaneseCoa ? "legacy-erp-shell legacy-erp-voucher--classic overflow-hidden" : undefined}>
        {isLebaneseCoa ? <div className="legacy-erp-voucher-title">{voucherScreenTitle}</div> : null}
        <div className={isLebaneseCoa ? "legacy-erp-body space-y-2" : undefined}>
      <Tabs value={voucherTab} onValueChange={(v) => setVoucherTab(v as VoucherType)}>
        <TabsList
          className={cn(
            isLebaneseCoa
              ? 'legacy-erp-tabs mb-2 !h-auto !w-full !flex-wrap !justify-stretch !gap-0 !rounded-none !border !border-[#2a5dad] !bg-[#316ac5] !p-0 !text-white shadow-none'
              : 'mb-4 flex h-auto flex-wrap gap-1',
          )}
        >
          <TabsTrigger value="JV" className={isLebaneseCoa ? LEBANESE_VOUCHER_TAB_CLASS : undefined}>
            Journal (JV)
          </TabsTrigger>
          <TabsTrigger value="PV" className={isLebaneseCoa ? LEBANESE_VOUCHER_TAB_CLASS : undefined}>
            Payment (PV)
          </TabsTrigger>
          <TabsTrigger value="RV" className={isLebaneseCoa ? LEBANESE_VOUCHER_TAB_CLASS : undefined}>
            Receipt (RV)
          </TabsTrigger>
          {isLebaneseCoa ? (
            <>
              <TabsTrigger value="CRN" className={LEBANESE_VOUCHER_TAB_CLASS}>
                Credit note (CRN)
              </TabsTrigger>
              <TabsTrigger value="DRN" className={LEBANESE_VOUCHER_TAB_CLASS}>
                Debit note (DRN)
              </TabsTrigger>
            </>
          ) : null}
          <TabsTrigger value="CV" className={isLebaneseCoa ? LEBANESE_VOUCHER_TAB_CLASS : undefined}>
            Contra (CV)
          </TabsTrigger>
        </TabsList>

        <div className={cn("grid gap-4 sm:grid-cols-3 mb-4", isLebaneseCoa && "legacy-erp-field-grid mb-2 gap-2")}>
          <div>
            <Label className={isLebaneseCoa ? "text-[11px] font-semibold uppercase tracking-wide text-slate-600" : undefined}>Date</Label>
            <Input
              className={isLebaneseCoa ? "legacy-erp-input" : undefined}
              type="date"
              min="2000-01-01"
              max="2099-12-31"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
          <div>
            <Label className={isLebaneseCoa ? "text-[11px] font-semibold uppercase tracking-wide text-slate-600" : undefined}>
              Reference {editLockedReference ? "" : "(auto)"}
            </Label>
            <Input
              className={cn(isLebaneseCoa && "legacy-erp-input", !editLockedReference && "bg-slate-50")}
              readOnly
              value={autoVoucherReference}
              title="Auto-generated from next voucher serial"
            />
          </div>
          <div>
            <Label className={isLebaneseCoa ? "text-[11px] font-semibold uppercase tracking-wide text-slate-600" : undefined}>Memo</Label>
            <Input className={isLebaneseCoa ? "legacy-erp-input" : undefined} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
          </div>
        </div>
        {isLebaneseCoa ? (
          <div className="legacy-erp-field-grid mb-2 grid gap-2 sm:grid-cols-4">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Ledger
              </Label>
              <Input className="legacy-erp-input" readOnly value={ledgerCurrency} />
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Exchange rate
              </Label>
              <Input
                className="legacy-erp-input text-right"
                type="number"
                min="0"
                step="1"
                value={voucherExchangeRate}
                onChange={(e) => setVoucherExchangeRate(e.target.value)}
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <p className="pb-2 text-[11px] text-slate-600">
                1 USD = {(effectiveVoucherRate || 0).toLocaleString()} LBP · applies to this voucher only
              </p>
            </div>
          </div>
        ) : null}
        {editingPostedEntryId ? (
          <p className={cn(
            "mb-3 px-3 py-2 text-sm",
            isLebaneseCoa
              ? "legacy-erp-alert legacy-erp-alert--error"
              : "rounded-md border border-amber-300 bg-amber-50 text-amber-900",
          )}>
            Editing posted voucher — Confirm reverses the original and posts a new serial. Posted lines are not rewritten.
          </p>
        ) : null}

        <TabsContent value="JV" className="mt-0 space-y-2">
          <VoucherLinesEditor
            {...sharedLinesEditorProps}
            lines={draftLines}
            onLinesChange={setDraftLines}
            mirrorPair
            lineKeyPrefix="jv-line"
            previewLabel="Preview JV"
            onPreview={postJv}
            extraPreviewDisabled={!jvBalanced}
          />
        </TabsContent>

        <TabsContent value="CRN" className="mt-0 space-y-2">
          <VoucherLinesEditor
            {...sharedLinesEditorProps}
            lines={crnLines}
            onLinesChange={setCrnLines}
            mirrorPair
            lineKeyPrefix="crn-line"
            previewLabel="Preview CRN"
            onPreview={postCrn}
            extraPreviewDisabled={!isVoucherBalanced(crnLines)}
          />
        </TabsContent>

        <TabsContent value="DRN" className="mt-0 space-y-2">
          <VoucherLinesEditor
            {...sharedLinesEditorProps}
            lines={drnLines}
            onLinesChange={setDrnLines}
            mirrorPair
            lineKeyPrefix="drn-line"
            previewLabel="Preview DRN"
            onPreview={postDrn}
            extraPreviewDisabled={!isVoucherBalanced(drnLines)}
          />
        </TabsContent>

        <TabsContent value="PV" className="mt-0 space-y-3">
          {!isLebaneseCoa ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Reference</Label>
                <Input value={pvRef} onChange={(e) => setPvRef(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Check number (optional)</Label>
                <Input value={pvCheckNumber} onChange={(e) => setPvCheckNumber(e.target.value)} placeholder="For check register workflow" />
              </div>
            </div>
          ) : (
            <div className={cn("grid gap-4 sm:grid-cols-2", "legacy-erp-field-grid gap-2")}>
              <div className="sm:col-span-2">
                <Label className={lbFieldLabel}>Check number (optional)</Label>
                <Input className="legacy-erp-input" value={pvCheckNumber} onChange={(e) => setPvCheckNumber(e.target.value)} placeholder="For check register workflow" />
              </div>
            </div>
          )}
          <VoucherLinesEditor
            {...sharedLinesEditorProps}
            lines={pvLines}
            onLinesChange={setPvLines}
            mirrorPair
            lineKeyPrefix="pv-line"
            hint={
              isLebaneseCoa
                ? ""
                : `Debit expense/AP · Credit cash/bank. ${ledgerCurrency} ledger amounts; FX row under account when line ccy differs.`
            }
            previewLabel="Preview PV"
            onPreview={() => void postPv()}
            extraPreviewDisabled={!isVoucherBalanced(pvLines)}
          />
          {pvStatus ? (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                isLebaneseCoa && pvStatus.kind === "error" && "legacy-erp-alert legacy-erp-alert--error",
                isLebaneseCoa && pvStatus.kind === "success" && "legacy-erp-alert border-emerald-400 bg-emerald-50 text-emerald-900",
                isLebaneseCoa && pvStatus.kind === "info" && "legacy-erp-alert border-sky-400 bg-sky-50 text-sky-900",
                !isLebaneseCoa && pvStatus.kind === "error" && "border-red-300 bg-red-50 text-red-800",
                !isLebaneseCoa && pvStatus.kind === "success" && "border-green-300 bg-green-50 text-green-800",
                !isLebaneseCoa && pvStatus.kind === "info" && "border-sky-300 bg-sky-50 text-sky-900",
              )}
              role="status"
            >
              {pvStatus.text}
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="RV" className="mt-0 space-y-3">
          <div className={cn("grid gap-4 sm:grid-cols-2", isLebaneseCoa && "legacy-erp-field-grid gap-2")}>
            {!isLebaneseCoa ? (
              <div className="sm:col-span-2">
                <Label>Reference</Label>
                <Input value={rvRef} onChange={(e) => setRvRef(e.target.value)} />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Label className={isLebaneseCoa ? lbFieldLabel : undefined}>Sales discount (optional)</Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Select
                  value={rvDiscountType}
                  onValueChange={(value: SaleDiscountMode) => setRvDiscountType(value)}
                >
                  <SelectTrigger
                    className={cn(
                      "w-[9.5rem] shrink-0",
                      isLebaneseCoa && "legacy-erp-input h-8",
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Amount ({ledgerCurrency})</SelectItem>
                    <SelectItem value="percentage">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className={cn(
                    "min-w-[8rem] flex-1 text-right",
                    isLebaneseCoa && "legacy-erp-input",
                  )}
                  type="number"
                  min="0"
                  step={rvDiscountType === "percentage" ? "0.01" : "0.01"}
                  max={rvDiscountType === "percentage" ? "99.99" : undefined}
                  value={rvDiscountValue}
                  onChange={(e) => setRvDiscountValue(e.target.value)}
                  placeholder={rvDiscountType === "percentage" ? "0" : "0.00"}
                />
                {rvDiscountType === "percentage" && rvDiscountAmount > 0 ? (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    = {rvDiscountAmount.toFixed(2)} {ledgerCurrency}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {rvDiscountAmount > 0 ? (
            <VoucherSaleTotalsBand
              totals={{
                grossRevenue: rvSaleTotals.subtotal,
                discountAmount: rvDiscountAmount,
                netTotal: rvSaleTotals.net,
                discountType: rvDiscountType,
                discountValue: rvDiscountInputValue,
              }}
              isLebaneseCoa={isLebaneseCoa}
              storeCurrency={ledgerCurrency}
              usdToLbp={fxRateDefault}
            />
          ) : null}
          <VoucherLinesEditor
            {...sharedLinesEditorProps}
            lines={rvLines}
            onLinesChange={setRvLines}
            mirrorPair
            lineKeyPrefix="rv-line"
            hint={
              isLebaneseCoa
                ? ""
                : `Debit cash/bank · Credit AR. ${ledgerCurrency} ledger amounts; FX row under account when line ccy differs.`
            }
            previewLabel="Preview RV"
            onPreview={postRv}
            extraPreviewDisabled={!isVoucherBalanced(rvLines)}
          />
        </TabsContent>

        <TabsContent value="CV" className="mt-0 space-y-3">
          {!isLebaneseCoa ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Reference</Label>
                <Input value={cvRef} onChange={(e) => setCvRef(e.target.value)} />
              </div>
            </div>
          ) : null}
          <VoucherLinesEditor
            {...sharedLinesEditorProps}
            lines={cvLines}
            onLinesChange={setCvLines}
            mirrorPair
            lineKeyPrefix="cv-line"
            hint={
              isLebaneseCoa
                ? ""
                : `Debit destination · Credit source. ${ledgerCurrency} ledger amounts; FX row under account when line ccy differs.`
            }
            previewLabel="Preview CV"
            onPreview={postCv}
            extraPreviewDisabled={!isVoucherBalanced(cvLines)}
          />
        </TabsContent>
      </Tabs>

      {registerEntries.length ? (
        <div className="-mx-2 mt-2 sm:-mx-0">
          <VoucherRegisterPanel
            entries={registerEntries}
            lines={registerLines}
            accountingLanguage={accountingLanguage}
            isLebaneseCoa={isLebaneseCoa}
            pcgClientAccounts={pcgClientAccounts}
            systemGuideEnabled={systemGuideEnabled}
            defaultOpen={false}
            initialFilter={registerFilter}
            lockFilter
            onPostDraft={onRegisterPostDraft}
            postingDraft={postingRegisterDraft}
            onReverse={onRegisterReverse}
            reversing={reversingRegister}
            onOpenEntry={onOpenEntry}
          />
        </div>
      ) : null}
        </div>
      </div>

      <AccountingSideSheet
        open={preview != null}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
        size="detail"
        tall
        className={isLebaneseCoa ? "legacy-erp-preview-sheet bg-[#f7f6f2]" : undefined}
        bodyClassName={isLebaneseCoa ? "legacy-erp-preview-body" : "space-y-3 text-sm"}
        title={preview ? `Preview ${preview.voucherType} before post` : "Preview voucher"}
        description={
          preview ? (
            <>
              {preview.date} · {preview.memo}
              {editingPostedEntryId ? " · will reverse original then post a new serial" : ""}
              {previewAmountMode === "both" && fxRateDefault
                ? ` · 1 USD = ${fxRateDefault.toLocaleString()} LBP`
                : ""}
            </>
          ) : undefined
        }
        footer={
          <div
            className={cn(
              "flex flex-wrap justify-end gap-2",
              isLebaneseCoa && "border-t border-slate-400 bg-[#e8e6dc] px-4 py-2 -mx-6 -mb-4",
            )}
          >
            {isLebaneseCoa ? (
              <>
                <button type="button" className="legacy-erp-btn" disabled={previewPosting} onClick={closePreview}>
                  Back
                </button>
                <button
                  type="button"
                  className="legacy-erp-btn legacy-erp-btn--primary legacy-erp-btn--post"
                  disabled={posting || previewPosting || !previewCanPost}
                  onClick={() => void confirmPreview()}
                >
                  {posting || previewPosting ? "Posting…" : "Confirm post"}
                </button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" disabled={previewPosting} onClick={closePreview}>
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={posting || previewPosting || !previewCanPost}
                  onClick={() => void confirmPreview()}
                >
                  {posting || previewPosting ? "Posting…" : "Confirm post"}
                </Button>
              </>
            )}
          </div>
        }
      >
        {preview ? (
          <>
            {!previewCanPost ? (
              <p className="legacy-erp-alert legacy-erp-alert--error mb-3 text-sm">
                Out of balance — fix Dr/Cr
                {matrixJvFooter ? " and USD/LBP buckets" : ""} before posting.
              </p>
            ) : null}
            {(() => {
              const previewSaleTotals = parseSaleTotalsFromMeta(
                (preview.voucherMeta || {}) as Record<string, unknown>,
              );
              return previewSaleTotals ? (
                <VoucherSaleTotalsBand
                  totals={previewSaleTotals}
                  isLebaneseCoa={isLebaneseCoa}
                  storeCurrency={ledgerCurrency}
                  usdToLbp={fxRateDefault}
                  className="mb-3"
                />
              ) : null;
            })()}
            <p className="text-sm">
              Party:{" "}
              {String(
                (preview.voucherMeta as Record<string, unknown> | undefined)?.partyName ||
                  (preview.voucherMeta as Record<string, unknown> | undefined)?.payee ||
                  (preview.voucherMeta as Record<string, unknown> | undefined)?.payer ||
                  "—",
              )}
            </p>
            <p className="mb-3 text-xs text-muted-foreground">Click any amount to see full digits (no K/M).</p>
            <div className={isLebaneseCoa ? "legacy-erp-soa-scroll" : undefined}>
              <Table className={isLebaneseCoa ? "legacy-erp-grid w-full" : "w-full"}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-white">Account</TableHead>
                    <TableHead className="text-right text-white">Debit</TableHead>
                    <TableHead className="text-right text-white">Credit</TableHead>
                    <TableHead className="text-white">FX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.lines.map((line, idx) => {
                    const acct = allAcctById.get(line.accountId) || acctById.get(line.accountId);
                    const fx = previewLineFxLabel(line, ledgerCurrency, jdEdwardsGrid);
                    const discountLine = isSalesDiscountLedgerLine({
                      accountId: line.accountId,
                      accountCode: acct?.code,
                      description: line.description,
                    });
                    return (
                      <TableRow
                        key={`${line.accountId}-${idx}`}
                        className={discountLine ? "bg-amber-50/90" : undefined}
                      >
                        <TableCell>{acct ? formatPreviewAccount(acct) : line.accountId}</TableCell>
                        <TableCell className="text-right align-top">
                          {renderPreviewLineAmount(line, "debit")}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          {renderPreviewLineAmount(line, "credit")}
                        </TableCell>
                        <TableCell className="text-xs">{fx}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell>Totals</TableCell>
                    <TableCell className="text-right align-top">
                      {renderPreviewAmount(preview.lines.reduce((sum, line) => sum + (line.debit || 0), 0))}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      {renderPreviewAmount(preview.lines.reduce((sum, line) => sum + (line.credit || 0), 0))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        ) : null}
      </AccountingSideSheet>

      <InvoiceAllocationDialog
        open={allocOpen}
        onOpenChange={(open) => {
          if (!open && pendingPost) {
            void postWithoutAllocation();
            return;
          }
          setAllocOpen(open);
        }}
        paymentAmount={pendingPost?.paymentAmount || 0}
        openItems={pendingPost?.openItems || []}
        partyLabel={pendingPost?.partyLabel || ""}
        onConfirm={handleAllocationConfirm}
        onSkip={postWithoutAllocation}
      />
    </>
  );
}
