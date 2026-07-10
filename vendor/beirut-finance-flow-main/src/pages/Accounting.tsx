import { useMemo, useState } from "react";
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
import { BookOpen, Scale, Plus, RefreshCw, CheckCircle2, AlertTriangle, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type { JournalLineInput, PeriodLockType } from "@/types/generalLedger";
import { buildReconciliationReport } from "@/lib/ledger/reconciliation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type DraftLine = { accountId: string; debit: string; credit: string; description: string };

const emptyLine = (): DraftLine => ({ accountId: "", debit: "", credit: "", description: "" });

const Accounting = () => {
  const { logout, invoices, purchaseOrders } = useAppContext();
  const { cashBalance } = useAccounting();
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
    postManualEntry,
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
  const [memo, setMemo] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [posting, setPosting] = useState(false);
  const [openingAccountId, setOpeningAccountId] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));

  const subledgerTotals = useMemo(() => {
    const ar = invoices
      .filter((i) => i.status !== "paid")
      .reduce((s, i) => s + (i.amount || 0), 0);
    const ap = purchaseOrders
      .filter((p) => p.status === "approved" || p.status === "sent")
      .reduce((s, p) => s + (p.amount || 0), 0);
    return {
      cashOnHand: cashBalance.cash || 0,
      bankBalance: cashBalance.bank || 0,
      accountsReceivable: ar,
      accountsPayable: ap,
    };
  }, [cashBalance, invoices, purchaseOrders]);

  const reconciliation = useMemo(
    () => buildReconciliationReport(accounts, entries, lines, asOfDate, subledgerTotals),
    [accounts, entries, lines, asOfDate, subledgerTotals],
  );

  const draftTotals = useMemo(() => {
    const debit = draftLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = draftLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100 };
  }, [draftLines]);

  const handlePostManual = async () => {
    const journalLines: JournalLineInput[] = draftLines
      .filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      }));

    if (journalLines.length < 2) {
      toast.error("Add at least two lines with amounts.");
      return;
    }
    if (draftTotals.debit !== draftTotals.credit) {
      toast.error(`Entry out of balance (${draftTotals.debit} ≠ ${draftTotals.credit}).`);
      return;
    }
    if (isDateLocked(new Date(entryDate).toISOString())) {
      toast.error("That period is closed — cannot post journal entries for that date.");
      return;
    }

    setPosting(true);
    try {
      const result = await postManualEntry({
        date: new Date(entryDate).toISOString(),
        memo: memo || "Manual journal entry",
        lines: journalLines,
      });
      toast.success(result.idempotentReplay ? "Entry already posted (idempotent)." : `Posted ${result.entryId}`);
      setMemo("");
      setDraftLines([emptyLine(), emptyLine()]);
      setActiveTab("trial-balance");
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
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-teal-600" />
              Accounting
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              General ledger, manual journals, trial balance, and balance sheet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="as-of" className="text-xs whitespace-nowrap">As of</Label>
            <Input
              id="as-of"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-[150px]"
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
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
            <TabsTrigger value="manual">Manual Journal</TabsTrigger>
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="opening">Opening Balances</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="coa" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Chart of Accounts</CardTitle>
                <CardDescription>
                  {accounts.length ? `${accounts.length} accounts` : "Default SMB template will seed on first load."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="mb-4" onClick={() => void ensureCoa()}>
                  Initialize / Refresh COA
                </Button>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="capitalize">{a.type}</TableCell>
                        <TableCell className="text-right">{formatCurrency(a.openingBalance || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Manual Journal Entry</CardTitle>
                <CardDescription>Debits must equal credits before posting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Memo</Label>
                    <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
                  </div>
                </div>

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
                          <Select
                            value={line.accountId}
                            onValueChange={(v) => {
                              const next = [...draftLines];
                              next[idx] = { ...next[idx], accountId: v };
                              setDraftLines(next);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.code} — {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                    {draftTotals.debit === draftTotals.credit && draftTotals.debit > 0 && (
                      <Badge variant="outline" className="ml-2 text-green-700">Balanced</Badge>
                    )}
                  </p>
                  <Button onClick={() => void handlePostManual()} disabled={posting}>
                    {posting ? "Posting…" : "Post entry"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trial-balance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Trial Balance
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  Read-only · as of {asOfDate}
                  {periodLockBanner}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                      <TableHead>Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.rows.map((r) => (
                      <TableRow key={r.accountId}>
                        <TableCell className="font-mono">{r.accountCode}</TableCell>
                        <TableCell>{r.accountName}</TableCell>
                        <TableCell className="capitalize">{r.accountType}</TableCell>
                        <TableCell className="text-right">{r.debit ? formatCurrency(r.debit) : "—"}</TableCell>
                        <TableCell className="text-right">{r.credit ? formatCurrency(r.credit) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell colSpan={3}>Totals</TableCell>
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
                <CardTitle>Balance Sheet</CardTitle>
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
                        <TableBody>
                          {section.rows.map((r) => (
                            <TableRow key={r.code}>
                              <TableCell className="font-mono w-24">{r.code}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-medium border-t">
                            <TableCell colSpan={2}>Subtotal</TableCell>
                            <TableCell className="text-right">{formatCurrency(section.subtotal)}</TableCell>
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

          <TabsContent value="opening" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Opening Balances</CardTitle>
                <CardDescription>Posts offset to Opening Balance Equity (3100).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div>
                  <Label>Account</Label>
                  <Select value={openingAccountId} onValueChange={setOpeningAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter((a) => a.type !== "revenue" && a.type !== "expense").map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <CardTitle>Subledger Reconciliation</CardTitle>
                <CardDescription>GL vs operational cash, AR, and AP snapshots.</CardDescription>
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
        </Tabs>
      </div>
    </FinancePageShell>
  );
};

export default Accounting;
