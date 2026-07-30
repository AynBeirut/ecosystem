import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LedgerAccountCombobox } from "@/components/LedgerAccountCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useAppContext } from "@/context/AppContext";
import { SearchableCombobox, type SearchableOption } from "@/components/SearchableCombobox";
import type { JournalLineInput, LedgerAccount, PcgClientAccount, VoucherType } from "@/types/generalLedger";
import { type AccountingLanguage } from "@/lib/grabio/accountingMode";
import { mapGrabioCodeToPcg } from "@/lib/ledger/grabioToPcgMap";

type DraftLine = { accountId: string; debit: string; credit: string; description: string };

const emptyLine = (): DraftLine => ({ accountId: "", debit: "", credit: "", description: "" });

type Props = {
  accounts: LedgerAccount[];
  accountingLanguage?: AccountingLanguage;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  posting: boolean;
  onPost: (payload: {
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
      if (account.pcgKind === 'G') return false;
      if (account.isPcgChart) return true;
      if (mapGrabioCodeToPcg(account.code)) return false;
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export default function VoucherEntryPanel({
  accounts,
  accountingLanguage,
  isLebaneseCoa,
  pcgClientAccounts = [],
  posting,
  onPost,
}: Props) {
  const { clients = [], suppliers = [] } = useAppContext() as {
    clients?: Array<{ id: string; name: string; email?: string; phone?: string }>;
    suppliers?: Array<{ id: string; name: string; email?: string; phone?: string }>;
  };
  const accts = useMemo(() => activeAccounts(accounts, isLebaneseCoa), [accounts, isLebaneseCoa]);
  const [voucherTab, setVoucherTab] = useState<VoucherType>("JV");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");

  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);

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

  const postJv = () => {
    if (!jvBalanced) {
      toast.error(
        draftTotals.debit === 0 && draftTotals.credit === 0
          ? "Enter debit and credit amounts on at least two lines."
          : `Entry is out of balance (debits ${formatCurrency(draftTotals.debit)} ≠ credits ${formatCurrency(draftTotals.credit)}). Nothing was saved.`,
      );
      return;
    }
    const lines: JournalLineInput[] = draftLines
      .filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      }));
    if (lines.length < 2) {
      toast.error("Add at least two lines with accounts and amounts.");
      return;
    }
    onPost({ voucherType: "JV", date: entryDate, memo: memo || "Journal voucher", lines, voucherMeta: {} });
  };

  const postPv = () => {
    const amount = Number(pvAmount) || 0;
    if (!pvFrom || !pvTo || amount <= 0) return;
    onPost({
      voucherType: "PV",
      date: entryDate,
      memo: memo || `Payment voucher${pvPayee ? ` — ${pvPayee}` : ""}`,
      lines: [
        { accountId: pvTo, debit: amount, credit: 0, description: "Payment" },
        { accountId: pvFrom, debit: 0, credit: amount, description: "Paid from" },
      ],
      voucherMeta: {
        payee: pvPayee,
        supplierId: pvSupplierId || undefined,
        paymentRef: pvRef,
        checkNumber: pvCheckNumber || pvRef || undefined,
        checkStatus: pvCheckNumber ? 'issued' : undefined,
        checkAmount: amount,
        amount,
        paidFromAccountId: pvFrom,
        paidToAccountId: pvTo,
      },
    });
  };

  const postRv = () => {
    const amount = Number(rvAmount) || 0;
    if (!rvInto || !rvFrom || amount <= 0) return;
    onPost({
      voucherType: "RV",
      date: entryDate,
      memo: memo || `Receipt voucher${rvPayer ? ` — ${rvPayer}` : ""}`,
      lines: [
        { accountId: rvInto, debit: amount, credit: 0, description: "Received into" },
        { accountId: rvFrom, debit: 0, credit: amount, description: "Received from" },
      ],
      voucherMeta: {
        payer: rvPayer,
        clientId: rvClientId || undefined,
        receiptRef: rvRef,
        receivedIntoAccountId: rvInto,
        receivedFromAccountId: rvFrom,
      },
    });
  };

  const postCv = () => {
    const amount = Number(cvAmount) || 0;
    if (!cvFrom || !cvTo || amount <= 0) return;
    onPost({
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

  return (
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
                    onChange={(e) => {
                      const next = [...draftLines];
                      next[idx] = { ...next[idx], credit: e.target.value, debit: e.target.value ? "" : next[idx].debit };
                      setDraftLines(next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={line.description}
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
            {jvBalanced && (
              <Badge variant="outline" className="ml-2 text-green-700">Balanced</Badge>
            )}
            {!jvBalanced && (draftTotals.debit > 0 || draftTotals.credit > 0) && (
              <Badge variant="outline" className="ml-2 text-amber-700">Out of balance</Badge>
            )}
          </p>
          <Button onClick={postJv} disabled={posting || !jvBalanced}>
            {posting ? "Posting…" : "Post JV"}
          </Button>
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
            <SearchableCombobox
              options={supplierOptions}
              value={pvSupplierId}
              onValueChange={selectPvSupplier}
              placeholder="Select supplier"
              searchPlaceholder="Search suppliers…"
              emptyText="No suppliers found."
            />
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
            <SearchableCombobox
              options={clientOptions}
              value={rvClientId}
              onValueChange={selectRvClient}
              placeholder="Select client"
              searchPlaceholder="Search clients…"
              emptyText="No clients found."
            />
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
  );
}
