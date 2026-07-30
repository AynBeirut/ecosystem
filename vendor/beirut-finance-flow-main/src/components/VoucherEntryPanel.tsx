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
import { formatCurrency } from "@/lib/utils";
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
import { mapGrabioCodeToPcg } from "@/lib/ledger/grabioToPcgMap";
import { isAccountsPayableCode, isAccountsReceivableCode } from "@/lib/ledger/accountControlCodes";
import { buildOpenInvoices, buildOpenPurchaseOrders, validateAllocations } from "@/lib/ledger/openItems";
import { loadCostCenters } from "@/lib/firestore/costCentersFirestore";

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
  }) => void;
  onSaveDraft?: (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  }) => void;
  onSubmitForApproval?: (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  }) => void;
};

function activeAccounts(accounts: LedgerAccount[], isLebaneseCoa?: boolean) {
  const active = accounts.filter((a) => a.isActive);
  if (!isLebaneseCoa) return active.sort((a, b) => a.code.localeCompare(b.code));
  return active
    .filter((account) => {
      if (account.pcgKind === "G") return false;
      if (account.isPcgChart) return true;
      if (mapGrabioCodeToPcg(account.code)) return false;
      return true;
    })
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
  onSaveDraft,
  onSubmitForApproval,
}: Props) {
  const { clients = [], suppliers = [] } = useAppContext() as {
    clients?: Array<{ id: string; name: string; email?: string; phone?: string }>;
    suppliers?: Array<{ id: string; name: string; email?: string; phone?: string }>;
  };
  const accts = useMemo(() => activeAccounts(accounts, isLebaneseCoa), [accounts, isLebaneseCoa]);
  const acctById = useMemo(() => new Map(accts.map((a) => [a.id, a])), [accts]);
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

  useEffect(() => {
    if (!storeId) return;
    void loadCostCenters(storeId).then(setCostCenters);
  }, [storeId]);

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

  const finalizePost = (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
    voucherMeta?: Record<string, unknown>;
  }) => {
    onPost(payload);
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
      finalizePost(payload);
      return;
    }
    const isAr = isAccountsReceivableCode(acct.code);
    const isAp = isAccountsPayableCode(acct.code);
    if (!isAr && !isAp) {
      finalizePost(payload);
      return;
    }
    const openItems =
      payload.documentType === "invoice"
        ? buildOpenInvoices(invoices, settlements, payload.partyId)
        : buildOpenPurchaseOrders(purchaseOrders, paymentOrders, settlements, payload.partyId);
    if (!openItems.length) {
      finalizePost(payload);
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
  };

  const handleAllocationConfirm = (allocations: SettlementAllocationInput[]) => {
    if (!pendingPost) return;
    const check = validateAllocations(pendingPost.paymentAmount, allocations, pendingPost.openItems);
    if (!check.valid) {
      toast.error(check.message);
      return;
    }
    finalizePost({
      voucherType: pendingPost.voucherType,
      date: pendingPost.date,
      memo: pendingPost.memo,
      lines: pendingPost.lines,
      voucherMeta: {
        ...(pendingPost.voucherMeta || {}),
        allocations,
      },
    });
    setPendingPost(null);
  };

  const postJv = (mode: 'post' | 'draft' | 'pending' = 'post') => {
    if (!jvBalanced && mode === 'post') {
      toast.error("Entry must be balanced before posting.");
      return;
    }
    const lines = draftLines.map((l) => mapDraftLine(l, mainCurrency)).filter(Boolean) as JournalLineInput[];
    if (lines.length < 2) {
      toast.error("Add at least two lines with accounts and amounts.");
      return;
    }
    const payload = { voucherType: "JV" as const, date: entryDate, memo: memo || "Journal voucher", lines, voucherMeta: {} };
    if (mode === 'draft' && onSaveDraft) onSaveDraft(payload);
    else if (mode === 'pending' && onSubmitForApproval) onSubmitForApproval(payload);
    else finalizePost(payload);
  };

  const postPv = () => {
    const amount = Number(pvAmount) || 0;
    if (!pvFrom || !pvTo || amount <= 0) return;
    const meta = {
      payee: pvPayee,
      supplierId: pvSupplierId || undefined,
      paymentRef: pvRef,
      checkNumber: pvCheckNumber || pvRef || undefined,
      checkStatus: pvCheckNumber ? "issued" : undefined,
      checkAmount: amount,
      amount,
      paidFromAccountId: pvFrom,
      paidToAccountId: pvTo,
    };
    maybeShowAllocation({
      voucherType: "PV",
      date: entryDate,
      memo: memo || `Payment voucher${pvPayee ? ` — ${pvPayee}` : ""}`,
      lines: [
        { accountId: pvTo, debit: amount, credit: 0, description: "Payment" },
        { accountId: pvFrom, debit: 0, credit: amount, description: "Paid from" },
      ],
      voucherMeta: meta,
      knockOffAccountId: pvTo,
      paymentAmount: amount,
      partyLabel: pvPayee || "Supplier",
      partyId: pvSupplierId || undefined,
      documentType: "purchase_order",
    });
  };

  const postRv = () => {
    const amount = Number(rvAmount) || 0;
    if (!rvInto || !rvFrom || amount <= 0) return;
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
    finalizePost({
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
      <Tabs value={voucherTab} onValueChange={(v) => setVoucherTab(v as VoucherType)}>
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="JV">Journal (JV)</TabsTrigger>
          <TabsTrigger value="PV">Payment (PV)</TabsTrigger>
          <TabsTrigger value="RV">Receipt (RV)</TabsTrigger>
          <TabsTrigger value="CV">Contra (CV)</TabsTrigger>
        </TabsList>

        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div>
            <Label>Date</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div>
            <Label>Memo</Label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
          </div>
        </div>

        <TabsContent value="JV" className="mt-0 space-y-4">
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
                        const next = [...draftLines];
                        next[idx] = { ...next[idx], debit: e.target.value, credit: e.target.value ? "" : next[idx].credit };
                        setDraftLines(next);
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
                        const next = [...draftLines];
                        next[idx] = { ...next[idx], credit: e.target.value, debit: e.target.value ? "" : next[idx].debit };
                        setDraftLines(next);
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
                      <SelectTrigger className="w-[100px]"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {costCenters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraftLines((p) => [...p, emptyLine()])}>
              <Plus className="h-4 w-4 mr-1" /> Add line
            </Button>
            <p className="text-sm">
              Totals: Debit <strong>{formatCurrency(draftTotals.debit)}</strong> · Credit{" "}
              <strong>{formatCurrency(draftTotals.credit)}</strong>
              {jvBalanced && <Badge variant="outline" className="ml-2 text-green-700">Balanced</Badge>}
            </p>
            <div className="flex gap-2">
              {onSaveDraft ? (
                <Button variant="outline" onClick={() => postJv('draft')} disabled={posting || !jvBalanced}>
                  Save draft
                </Button>
              ) : null}
              {onSubmitForApproval ? (
                <Button variant="secondary" onClick={() => postJv('pending')} disabled={posting || !jvBalanced}>
                  Submit for approval
                </Button>
              ) : null}
              <Button onClick={() => postJv('post')} disabled={posting || !jvBalanced}>
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
              <Input type="number" min="0" step="0.01" value={pvAmount} onChange={(e) => setPvAmount(e.target.value)} />
            </div>
            <div>
              <Label>Payee</Label>
              <SearchableCombobox options={supplierOptions} value={pvSupplierId} onValueChange={selectPvSupplier} placeholder="Select supplier" searchPlaceholder="Search suppliers…" emptyText="No suppliers found." />
              <Input className="mt-2" value={pvPayee} onChange={(e) => setPvPayee(e.target.value)} placeholder="Or type payee name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Reference</Label>
              <Input value={pvRef} onChange={(e) => setPvRef(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Check number (optional)</Label>
              <Input value={pvCheckNumber} onChange={(e) => setPvCheckNumber(e.target.value)} placeholder="For check register workflow" />
            </div>
          </div>
          <Button onClick={postPv} disabled={posting}>Post PV</Button>
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
              <Input type="number" min="0" step="0.01" value={rvAmount} onChange={(e) => setRvAmount(e.target.value)} />
            </div>
            <div>
              <Label>Payer</Label>
              <SearchableCombobox options={clientOptions} value={rvClientId} onValueChange={selectRvClient} placeholder="Select client" searchPlaceholder="Search clients…" emptyText="No clients found." />
              <Input className="mt-2" value={rvPayer} onChange={(e) => setRvPayer(e.target.value)} placeholder="Or type payer name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Reference</Label>
              <Input value={rvRef} onChange={(e) => setRvRef(e.target.value)} />
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

      <InvoiceAllocationDialog
        open={allocOpen}
        onOpenChange={setAllocOpen}
        paymentAmount={pendingPost?.paymentAmount || 0}
        openItems={pendingPost?.openItems || []}
        partyLabel={pendingPost?.partyLabel || ""}
        onConfirm={handleAllocationConfirm}
      />
    </>
  );
}
