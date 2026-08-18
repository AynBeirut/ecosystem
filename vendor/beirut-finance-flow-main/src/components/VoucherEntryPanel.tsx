import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LedgerAccountCombobox } from "@/components/LedgerAccountCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { useAppContext } from "@/context/AppContext";
import { SearchableCombobox, type SearchableOption } from "@/components/SearchableCombobox";
import InvoiceAllocationDialog from "@/components/InvoiceAllocationDialog";
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
  isCashOrBankCode,
  pickDefaultApAccount,
  pickDefaultArAccount,
} from "@/lib/ledger/accountControlCodes";
import { buildOpenInvoices, buildOpenPurchaseOrders, validateAllocations } from "@/lib/ledger/openItems";
import { loadCostCenters } from "@/lib/firestore/costCentersFirestore";
import VoucherRegisterPanel, { type RegisterFilter } from "@/components/VoucherRegisterPanel";
import type { JournalEntry, JournalLine } from "@/types/generalLedger";
import { buildClientByGrabioMap, mapPcgCodeToGrabioCodes, resolvePcgDisplay } from "@/lib/ledger/grabioToPcgMap";
import { parseJournalDateInput } from "@/lib/ledger/periodLockCore";

type DraftLine = {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
  transactionCurrency: string;
  fxRate: string;
  amountFx: string;
  costCenterId: string;
};

const emptyLine = (): DraftLine => ({
  accountId: "",
  debit: "",
  credit: "",
  description: "",
  transactionCurrency: "",
  fxRate: "",
  amountFx: "",
  costCenterId: "",
});

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
  const active = accounts.filter((a) => a.isActive);
  if (!isLebaneseCoa) return active.sort((a, b) => a.code.localeCompare(b.code));
  // Vouchers post to Grabio operational accounts (601, 102, …). PCG template rows are display-only.
  return active
    .filter((account) => account.pcgKind !== "G" && !account.isPcgChart)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function mapDraftLine(line: DraftLine, mainCurrency?: string): JournalLineInput | null {
  if (!line.accountId) return null;
  const debit = Number(line.debit) || 0;
  const credit = Number(line.credit) || 0;
  if (debit <= 0 && credit <= 0) return null;
  const fxRate = Number(line.fxRate) || 0;
  const amountFx = Number(line.amountFx) || 0;
  let finalDebit = debit;
  let finalCredit = credit;
  if (amountFx > 0 && fxRate > 0) {
    const base = Math.round(amountFx * fxRate * 100) / 100;
    if (debit > 0) finalDebit = base;
    if (credit > 0) finalCredit = base;
  }
  return {
    accountId: line.accountId,
    debit: finalDebit,
    credit: finalCredit,
    description: line.description || undefined,
    transactionCurrency: line.transactionCurrency || mainCurrency || undefined,
    fxRate: fxRate > 0 ? fxRate : undefined,
    amountFx: amountFx > 0 ? amountFx : undefined,
    costCenterId: line.costCenterId || undefined,
  };
}

function mirrorJvAmount(
  lines: DraftLine[],
  idx: number,
  field: "debit" | "credit",
  value: string,
): DraftLine[] {
  const next = lines.map((line) => ({ ...line }));
  if (field === "debit") {
    next[idx] = { ...next[idx], debit: value, credit: value ? "" : next[idx].credit };
  } else {
    next[idx] = { ...next[idx], credit: value, debit: value ? "" : next[idx].debit };
  }

  const pairIdx = idx === 0 ? 1 : idx === 1 ? 0 : -1;
  if (pairIdx < 0 || pairIdx >= next.length) return next;

  if (!value.trim()) {
    if (field === "debit") next[pairIdx] = { ...next[pairIdx], credit: "" };
    else next[pairIdx] = { ...next[pairIdx], debit: "" };
    return next;
  }

  if (field === "debit") {
    next[pairIdx] = { ...next[pairIdx], credit: value, debit: "" };
  } else {
    next[pairIdx] = { ...next[pairIdx], debit: value, credit: "" };
  }
  return next;
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
}: Props) {
  const { clients = [], suppliers = [] } = useAppContext() as {
    clients?: Array<{ id: string; name: string; email?: string; phone?: string }>;
    suppliers?: Array<{ id: string; name: string; email?: string; phone?: string }>;
  };
  const accts = useMemo(() => activeAccounts(accounts, isLebaneseCoa), [accounts, isLebaneseCoa]);
  const acctById = useMemo(() => new Map(accts.map((a) => [a.id, a])), [accts]);
  const allAcctById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const [pvStatus, setPvStatus] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const [costCenters, setCostCenters] = useState<LedgerCostCenter[]>([]);
  const [voucherTab, setVoucherTab] = useState<VoucherType>("JV");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
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

  const [pvFrom, setPvFrom] = useState("");
  const [pvTo, setPvTo] = useState("");
  const [pvAmount, setPvAmount] = useState("");
  const [pvPayee, setPvPayee] = useState("");
  const [pvSupplierId, setPvSupplierId] = useState("");
  const [pvRef, setPvRef] = useState("");
  const [pvCheckNumber, setPvCheckNumber] = useState("");

  const [rvInto, setRvInto] = useState("");
  const [rvFrom, setRvFrom] = useState("");
  const [rvAmount, setRvAmount] = useState("");
  const [rvPayer, setRvPayer] = useState("");
  const [rvClientId, setRvClientId] = useState("");
  const [rvRef, setRvRef] = useState("");

  const [cvFrom, setCvFrom] = useState("");
  const [cvTo, setCvTo] = useState("");
  const [cvAmount, setCvAmount] = useState("");
  const [cvRef, setCvRef] = useState("");

  const registerFilter = useMemo<RegisterFilter>(() => {
    if (voucherTab === "JV") return "jv";
    if (voucherTab === "PV") return "pv";
    if (voucherTab === "RV") return "rv";
    if (voucherTab === "CV") return "cv";
    return "all";
  }, [voucherTab]);

  useEffect(() => {
    if (!storeId) return;
    void loadCostCenters(storeId).then(setCostCenters);
  }, [storeId]);

  useEffect(() => {
    if (pvFrom) return;
    const cash =
      accts.find((row) => row.code === "102") ||
      accts.find((row) => isCashOrBankCode(row.code));
    if (cash) setPvFrom(cash.id);
  }, [accts, pvFrom]);

  useEffect(() => {
    if (pvTo) return;
    const ap = pickDefaultApAccount(accts);
    if (ap) setPvTo(ap.id);
  }, [accts, pvTo]);

  useEffect(() => {
    if (rvFrom) return;
    const ar = pickDefaultArAccount(accts);
    if (ar) setRvFrom(ar.id);
  }, [accts, rvFrom]);

  const draftTotals = useMemo(() => {
    const debit = draftLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = draftLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100 };
  }, [draftLines]);

  const jvBalanced =
    draftTotals.debit === draftTotals.credit && draftTotals.debit > 0 && draftTotals.credit > 0;

  const clientOptions = useMemo<SearchableOption[]>(
    () =>
      clients.map((client) => ({
        value: client.id,
        label: client.name,
        keywords: [client.email, client.phone].filter(Boolean).join(" "),
      })),
    [clients],
  );

  const supplierOptions = useMemo<SearchableOption[]>(
    () =>
      suppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
        keywords: [supplier.email, supplier.phone].filter(Boolean).join(" "),
      })),
    [suppliers],
  );

  const selectPvSupplier = (supplierId: string) => {
    setPvSupplierId(supplierId);
    const supplier = suppliers.find((row) => row.id === supplierId);
    if (supplier) setPvPayee(supplier.name);
  };

  const selectRvClient = (clientId: string) => {
    setRvClientId(clientId);
    const client = clients.find((row) => row.id === clientId);
    if (client) setRvPayer(client.name);
  };

  const finalizePost = async (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  }) => {
    await onPost(payload);
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
        setPvAmount("");
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
        setPvAmount("");
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

  const postJv = () => {
    if (!jvBalanced) {
      toast.error("Entry must be balanced before posting.");
      return;
    }
    const lines = draftLines.map((l) => mapDraftLine(l, mainCurrency)).filter(Boolean) as JournalLineInput[];
    if (lines.length < 2) {
      toast.error("Add at least two lines with accounts and amounts.");
      return;
    }
    void finalizePost({
      voucherType: "JV",
      date: entryDate,
      memo: memo || "Journal voucher",
      lines,
      voucherMeta: {},
    });
  };

  const postPv = async () => {
    setPvStatus(null);
    try {
      parseJournalDateInput(entryDate);
    } catch {
      const text = "Enter a valid voucher date (2000–2099).";
      setPvStatus({ kind: "error", text });
      toast.error(text);
      return;
    }
    const amount = Number(pvAmount) || 0;
    const paidFromId = resolveOperationalAccountId(pvFrom, accounts, allAcctById);
    const paidToId = resolveOperationalAccountId(pvTo, accounts, allAcctById);
    if (!paidFromId || !paidToId || amount <= 0) {
      const text = "Select cash/bank, expense/AP account, and enter an amount.";
      setPvStatus({ kind: "error", text });
      toast.error(text);
      return;
    }
    if (!pvPayee.trim() && !pvSupplierId) {
      const text = "Select or enter a payee.";
      setPvStatus({ kind: "error", text });
      toast.error(text);
      return;
    }
    const meta: Record<string, unknown> = {
      payee: pvPayee,
      paymentRef: pvRef,
      checkAmount: amount,
      amount,
      paidFromAccountId: paidFromId,
      paidToAccountId: paidToId,
      ...(pvSupplierId ? { supplierId: pvSupplierId } : {}),
      ...(pvCheckNumber ? { checkNumber: pvCheckNumber, checkStatus: "issued" } : {}),
      ...(pvRef && !pvCheckNumber ? { checkNumber: pvRef } : {}),
    };
    const payload = {
      voucherType: "PV" as const,
      date: entryDate,
      memo: memo || `Payment voucher${pvPayee ? ` — ${pvPayee}` : ""}`,
      lines: [
        { accountId: paidToId, debit: amount, credit: 0, description: "Payment" },
        { accountId: paidFromId, debit: 0, credit: amount, description: "Paid from" },
      ],
      voucherMeta: meta,
    };
    const knockOffAcct = allAcctById.get(paidToId) ?? acctById.get(paidToId);
    const isAp = knockOffAcct ? isAccountsPayableCode(knockOffAcct.code) : false;
    const isAr = knockOffAcct ? isAccountsReceivableCode(knockOffAcct.code) : false;
    if (!isAp && !isAr) {
      try {
        await finalizePost(payload);
        setPvStatus({ kind: "success", text: "Payment voucher posted." });
        setPvAmount("");
        setPvRef("");
        setPvCheckNumber("");
      } catch (err) {
        const text = err instanceof Error ? err.message : "Failed to post payment voucher.";
        setPvStatus({ kind: "error", text });
        toast.error(text);
      }
      return;
    }
    maybeShowAllocation({
      ...payload,
      knockOffAccountId: paidToId,
      paymentAmount: amount,
      partyLabel: pvPayee || "Supplier",
      partyId: pvSupplierId || undefined,
      documentType: "purchase_order",
    });
  };

  const postRv = () => {
    const amount = Number(rvAmount) || 0;
    if (!rvInto || !rvFrom || amount <= 0) {
      toast.error("Select cash/bank, AR account, and enter an amount.");
      return;
    }
    if (!rvPayer.trim() && !rvClientId) {
      toast.error("Select or enter a payer.");
      return;
    }
    const meta = {
      payer: rvPayer,
      clientId: rvClientId || undefined,
      receiptRef: rvRef,
      receivedIntoAccountId: rvInto,
      receivedFromAccountId: rvFrom,
    };
    maybeShowAllocation({
      voucherType: "RV",
      date: entryDate,
      memo: memo || `Receipt voucher${rvPayer ? ` — ${rvPayer}` : ""}`,
      lines: [
        { accountId: rvInto, debit: amount, credit: 0, description: "Received into" },
        { accountId: rvFrom, debit: 0, credit: amount, description: "Received from" },
      ],
      voucherMeta: meta,
      knockOffAccountId: rvFrom,
      paymentAmount: amount,
      partyLabel: rvPayer || "Client",
      partyId: rvClientId || undefined,
      documentType: "invoice",
    });
  };

  const postCv = () => {
    const amount = Number(cvAmount) || 0;
    if (!cvFrom || !cvTo || amount <= 0) return;
    void finalizePost({
      voucherType: "CV",
      date: entryDate,
      memo: memo || "Contra voucher — transfer",
      lines: [
        { accountId: cvTo, debit: amount, credit: 0, description: "Transfer to" },
        { accountId: cvFrom, debit: 0, credit: amount, description: "Transfer from" },
      ],
      voucherMeta: { fromAccountId: cvFrom, toAccountId: cvTo, transferRef: cvRef },
    });
  };

  const handleLineKeyDown = (e: React.KeyboardEvent, idx: number, field: keyof DraftLine) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (field === "description" && idx < draftLines.length - 1) {
        const nextInput = document.querySelector<HTMLInputElement>(`[data-jv-line="${idx + 1}"][data-jv-field="accountId"]`);
        nextInput?.focus();
      }
    }
  };

  return (
    <>
      <div className={isLebaneseCoa ? "legacy-erp-shell overflow-hidden" : undefined}>
        {isLebaneseCoa ? (
          <div className="legacy-erp-toolbar">
            Journal voucher entry · {voucherTab}
          </div>
        ) : null}
        <div className={isLebaneseCoa ? "legacy-erp-body space-y-3" : undefined}>
      <Tabs value={voucherTab} onValueChange={(v) => setVoucherTab(v as VoucherType)}>
        <TabsList className={cn("flex h-auto flex-wrap gap-1 mb-4", isLebaneseCoa && "rounded-sm border border-slate-400 bg-[#e8e6dc] p-1")}>
          <TabsTrigger value="JV">Journal (JV)</TabsTrigger>
          <TabsTrigger value="PV">Payment (PV)</TabsTrigger>
          <TabsTrigger value="RV">Receipt (RV)</TabsTrigger>
          <TabsTrigger value="CV">Contra (CV)</TabsTrigger>
        </TabsList>

        <div className={cn("grid gap-4 sm:grid-cols-2 mb-4", isLebaneseCoa && "legacy-erp-field-grid mb-3")}>
          <div>
            <Label>Date</Label>
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
            <Label>Memo</Label>
            <Input className={isLebaneseCoa ? "legacy-erp-input" : undefined} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
          </div>
        </div>

        <TabsContent value="JV" className="mt-0 space-y-4">
          {isLebaneseCoa ? (
            <div className="max-h-[min(28rem,60vh)] overflow-y-auto overflow-x-hidden rounded-md border border-slate-300 bg-white">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col style={{ width: '42%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[#316ac5] text-white">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[11px] font-semibold">Account</th>
                    <th className="px-2 py-1.5 text-right text-[11px] font-semibold">Debit</th>
                    <th className="px-2 py-1.5 text-right text-[11px] font-semibold">Credit</th>
                    <th className="px-2 py-1.5 text-left text-[11px] font-semibold">Line memo</th>
                  </tr>
                </thead>
                <tbody>
                  {draftLines.map((line, idx) => {
                    const account = acctById.get(line.accountId);
                    const accountTitle =
                      account && isLebaneseCoa
                        ? resolvePcgDisplay(account.code, account.name, clientByGrabio)?.name || account.name
                        : account?.name;
                    return (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="max-w-0 px-2 py-1 align-top">
                          <LedgerAccountCombobox
                            accounts={accts}
                            accountingLanguage={accountingLanguage}
                            isLebaneseCoa={isLebaneseCoa}
                            pcgClientAccounts={pcgClientAccounts}
                            value={line.accountId}
                            onValueChange={(v) => {
                              const next = [...draftLines];
                              next[idx] = { ...next[idx], accountId: v };
                              setDraftLines(next);
                            }}
                          />
                          {accountTitle ? (
                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={accountTitle}>
                              {accountTitle}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-1 align-top">
                          <Input
                            className="legacy-erp-input h-8 text-right tabular-nums"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.debit}
                            data-jv-line={idx}
                            data-jv-field="debit"
                            onKeyDown={(e) => handleLineKeyDown(e, idx, "debit")}
                            onChange={(e) => {
                              setDraftLines(mirrorJvAmount(draftLines, idx, "debit", e.target.value));
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <Input
                            className="legacy-erp-input h-8 text-right tabular-nums"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.credit}
                            onKeyDown={(e) => handleLineKeyDown(e, idx, "credit")}
                            onChange={(e) => {
                              setDraftLines(mirrorJvAmount(draftLines, idx, "credit", e.target.value));
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <Input
                            className="legacy-erp-input h-8"
                            value={line.description}
                            onKeyDown={(e) => handleLineKeyDown(e, idx, "description")}
                            onChange={(e) => {
                              const next = [...draftLines];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setDraftLines(next);
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>FX amt</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Cost ctr</TableHead>
                  <TableHead>Line memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftLines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <LedgerAccountCombobox
                          accounts={accts}
                          accountingLanguage={accountingLanguage}
                          isLebaneseCoa={isLebaneseCoa}
                          pcgClientAccounts={pcgClientAccounts}
                          value={line.accountId}
                          onValueChange={(v) => {
                            const next = [...draftLines];
                            next[idx] = { ...next[idx], accountId: v };
                            setDraftLines(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          data-jv-line={idx}
                          data-jv-field="debit"
                          onKeyDown={(e) => handleLineKeyDown(e, idx, "debit")}
                          onChange={(e) => {
                            setDraftLines(mirrorJvAmount(draftLines, idx, "debit", e.target.value));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onKeyDown={(e) => handleLineKeyDown(e, idx, "credit")}
                          onChange={(e) => {
                            setDraftLines(mirrorJvAmount(draftLines, idx, "credit", e.target.value));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="FX"
                          value={line.amountFx}
                          onChange={(e) => {
                            const next = [...draftLines];
                            next[idx] = { ...next[idx], amountFx: e.target.value };
                            setDraftLines(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.000001"
                          placeholder="Rate"
                          value={line.fxRate}
                          onChange={(e) => {
                            const next = [...draftLines];
                            next[idx] = { ...next[idx], fxRate: e.target.value };
                            setDraftLines(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={line.costCenterId || "__none"}
                          onValueChange={(v) => {
                            const next = [...draftLines];
                            next[idx] = { ...next[idx], costCenterId: v === "__none" ? "" : v };
                            setDraftLines(next);
                          }}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {costCenters.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.description}
                          onKeyDown={(e) => handleLineKeyDown(e, idx, "description")}
                          onChange={(e) => {
                            const next = [...draftLines];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setDraftLines(next);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
          <div className={cn("flex flex-wrap items-center justify-between gap-2", isLebaneseCoa && "legacy-erp-totals")}>
            <Button variant="outline" size="sm" onClick={() => setDraftLines((p) => [...p, emptyLine()])}>
              <Plus className="h-4 w-4 mr-1" /> Add line
            </Button>
            <p className="text-sm">
              Totals: Debit <strong>{formatCurrency(draftTotals.debit)}</strong> · Credit{" "}
              <strong>{formatCurrency(draftTotals.credit)}</strong>
              {jvBalanced && <Badge variant="outline" className="ml-2 text-green-700">Balanced</Badge>}
            </p>
            <div className="flex gap-2">
              <Button onClick={postJv} disabled={posting || !jvBalanced}>
                {posting ? "Posting…" : "Post JV"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="PV" className="mt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Pay from (cash/bank)</Label>
              <LedgerAccountCombobox accounts={accts} accountingLanguage={accountingLanguage} isLebaneseCoa={isLebaneseCoa} pcgClientAccounts={pcgClientAccounts} value={pvFrom} onValueChange={setPvFrom} placeholder="Search cash/bank account…" />
            </div>
            <div>
              <Label>Pay to (expense / AP)</Label>
              <LedgerAccountCombobox accounts={accts} accountingLanguage={accountingLanguage} isLebaneseCoa={isLebaneseCoa} pcgClientAccounts={pcgClientAccounts} value={pvTo} onValueChange={setPvTo} placeholder="Search expense/AP account…" />
            </div>
            <div>
              <Label>Amount</Label>
              <Input className={isLebaneseCoa ? "legacy-erp-input" : undefined} type="number" min="0" step="0.01" value={pvAmount} onChange={(e) => setPvAmount(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Payee</Label>
              <SearchableCombobox options={supplierOptions} value={pvSupplierId} onValueChange={selectPvSupplier} placeholder="Select supplier" searchPlaceholder="Search suppliers…" emptyText="No suppliers found." />
              <Input className={cn("mt-2", isLebaneseCoa && "legacy-erp-input")} value={pvPayee} onChange={(e) => setPvPayee(e.target.value)} placeholder="Or type payee name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Reference</Label>
              <Input className={isLebaneseCoa ? "legacy-erp-input" : undefined} value={pvRef} onChange={(e) => setPvRef(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Check number (optional)</Label>
              <Input className={isLebaneseCoa ? "legacy-erp-input" : undefined} value={pvCheckNumber} onChange={(e) => setPvCheckNumber(e.target.value)} placeholder="For check register workflow" />
            </div>
          </div>
          {pvStatus ? (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                pvStatus.kind === "error" && "border-red-300 bg-red-50 text-red-800",
                pvStatus.kind === "success" && "border-green-300 bg-green-50 text-green-800",
                pvStatus.kind === "info" && "border-sky-300 bg-sky-50 text-sky-900",
              )}
              role="status"
            >
              {pvStatus.text}
            </p>
          ) : null}
          <Button type="button" onClick={() => void postPv()} disabled={posting}>
            {posting ? "Posting…" : "Post PV"}
          </Button>
        </TabsContent>

        <TabsContent value="RV" className="mt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Receive into (cash/bank)</Label>
              <LedgerAccountCombobox accounts={accts} accountingLanguage={accountingLanguage} isLebaneseCoa={isLebaneseCoa} pcgClientAccounts={pcgClientAccounts} value={rvInto} onValueChange={setRvInto} placeholder="Search cash/bank account…" />
            </div>
            <div>
              <Label>Received from (AR / other)</Label>
              <LedgerAccountCombobox accounts={accts} accountingLanguage={accountingLanguage} isLebaneseCoa={isLebaneseCoa} pcgClientAccounts={pcgClientAccounts} value={rvFrom} onValueChange={setRvFrom} placeholder="Search AR account…" />
            </div>
            <div>
              <Label>Amount</Label>
              <Input className={isLebaneseCoa ? "legacy-erp-input" : undefined} type="number" min="0" step="0.01" value={rvAmount} onChange={(e) => setRvAmount(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Payer</Label>
              <SearchableCombobox options={clientOptions} value={rvClientId} onValueChange={selectRvClient} placeholder="Select client" searchPlaceholder="Search clients…" emptyText="No clients found." />
              <Input className={cn("mt-2", isLebaneseCoa && "legacy-erp-input")} value={rvPayer} onChange={(e) => setRvPayer(e.target.value)} placeholder="Or type payer name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Reference</Label>
              <Input className={isLebaneseCoa ? "legacy-erp-input" : undefined} value={rvRef} onChange={(e) => setRvRef(e.target.value)} />
            </div>
          </div>
          <Button onClick={postRv} disabled={posting}>Post RV</Button>
        </TabsContent>

        <TabsContent value="CV" className="mt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>From account</Label>
              <LedgerAccountCombobox accounts={accts} accountingLanguage={accountingLanguage} isLebaneseCoa={isLebaneseCoa} pcgClientAccounts={pcgClientAccounts} value={cvFrom} onValueChange={setCvFrom} placeholder="Search from account…" />
            </div>
            <div>
              <Label>To account</Label>
              <LedgerAccountCombobox accounts={accts} accountingLanguage={accountingLanguage} isLebaneseCoa={isLebaneseCoa} pcgClientAccounts={pcgClientAccounts} value={cvTo} onValueChange={setCvTo} placeholder="Search to account…" />
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={cvAmount} onChange={(e) => setCvAmount(e.target.value)} />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={cvRef} onChange={(e) => setCvRef(e.target.value)} />
            </div>
          </div>
          <Button onClick={postCv} disabled={posting}>Post CV</Button>
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
          />
        </div>
      ) : null}
        </div>
      </div>

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
