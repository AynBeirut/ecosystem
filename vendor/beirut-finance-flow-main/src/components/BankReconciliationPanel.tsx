import { useCallback, useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, RefreshCw, Link2, Unlink, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import type {
  BankRecMatch,
  BankRecSession,
  BankStatementLine,
  JournalEntry,
  JournalLine,
  LedgerAccount,
  PcgClientAccount,
} from "@/types/generalLedger";
import { BANK_REC_PHASE1_ACCOUNT_CODES } from "@/types/generalLedger";
import {
  buildBankRecPhase1Summary,
  buildBookLinesForAccount,
} from "@/lib/ledger/accountLedgerLines";
import { parseBankStatementCsv } from "@/lib/ledger/bankRecCsv";
import { partitionUnmatched, suggestAutoMatches } from "@/lib/ledger/bankRecMatching";
import { buildBankRecReport } from "@/lib/ledger/bankRecReport";
import {
  addStatementLine,
  createBankRecMatch,
  createBankRecMatchesBatch,
  deleteBankRecMatch,
  deleteStatementLine,
  importStatementLines,
  loadBankRecMatches,
  loadOrCreateBankRecSession,
  loadStatementLines,
  lockBankRecSession,
  updateBankRecSession,
} from "@/lib/firestore/bankRecFirestore";
import SystemGuideInfo from "@/components/SystemGuideInfo";
import { getFinanceAuth } from "@/integrations/firebase/client";
import { buildClientByGrabioMap, displayPcgCode, formatPcgAccountLabel } from "@/lib/ledger/grabioToPcgMap";
import { compareLedgerAccountCode } from "@/lib/ledger/accountCodeSort";

type Props = {
  storeId: string;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  systemGuideEnabled: boolean;
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
};

export default function BankReconciliationPanel({
  storeId,
  accounts,
  entries,
  lines,
  systemGuideEnabled,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
}: Props) {
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const accountLabel = (account: LedgerAccount) =>
    isLebaneseCoa
      ? formatPcgAccountLabel(account, accountingLanguage, clientByGrabio)
      : `${account.code} — ${account.name}`;
  const sessionAccountLabel = (code: string) =>
    isLebaneseCoa ? displayPcgCode(code, clientByGrabio) : code;
  const bankAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive && BANK_REC_PHASE1_ACCOUNT_CODES.includes(a.code as (typeof BANK_REC_PHASE1_ACCOUNT_CODES)[number]))
        .sort((a, b) => compareLedgerAccountCode(a.code, b.code)),
    [accounts],
  );

  const [accountId, setAccountId] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<BankRecSession | null>(null);
  const [statementLines, setStatementLines] = useState<BankStatementLine[]>([]);
  const [matches, setMatches] = useState<BankRecMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchStmtId, setMatchStmtId] = useState("");
  const [matchBookId, setMatchBookId] = useState("");
  const [dateWindowDays, setDateWindowDays] = useState("3");
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [stmtOpeningInput, setStmtOpeningInput] = useState("");
  const [lockBusy, setLockBusy] = useState(false);

  const isLocked = session?.status === "locked";
  const [manualAmount, setManualAmount] = useState("");
  const [manualSide, setManualSide] = useState<"dr" | "cr">("dr");
  const [manualDesc, setManualDesc] = useState("");
  const [manualRef, setManualRef] = useState("");

  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === accountId) || null,
    [bankAccounts, accountId],
  );

  const bookLines = useMemo(() => {
    if (!accountId || !session) return [];
    return buildBookLinesForAccount(accountId, accounts, entries, lines, {
      startDate: session.startDate,
      endDate: session.endDate,
    });
  }, [accountId, session, accounts, entries, lines]);

  const summary = useMemo(
    () => buildBankRecPhase1Summary(bookLines, statementLines),
    [bookLines, statementLines],
  );

  const matchPartition = useMemo(
    () => partitionUnmatched(statementLines, bookLines, matches),
    [statementLines, bookLines, matches],
  );

  const matchedBookIds = useMemo(() => new Set(matches.map((m) => m.bookLineId)), [matches]);
  const matchedStmtIds = useMemo(() => new Set(matches.map((m) => m.statementLineId)), [matches]);

  const recReport = useMemo(() => {
    if (!session || !selectedAccount) return null;
    const opening = Number(stmtOpeningInput);
    const statementOpeningBalance = Number.isFinite(opening) ? opening : session.statementOpeningBalance ?? 0;
    return buildBankRecReport({
      account: selectedAccount,
      entries,
      lines,
      startDate: session.startDate,
      endDate: session.endDate,
      statementOpeningBalance,
      bookLines,
      statementLines,
      matches,
    });
  }, [session, selectedAccount, entries, lines, stmtOpeningInput, bookLines, statementLines, matches]);

  useEffect(() => {
    if (matchStmtId && !matchPartition.unmatchedStatement.some((s) => s.id === matchStmtId)) {
      setMatchStmtId("");
    }
    if (matchBookId && !matchPartition.unmatchedBook.some((b) => b.lineId === matchBookId)) {
      setMatchBookId("");
    }
  }, [matchPartition, matchStmtId, matchBookId]);

  const refreshSessionData = useCallback(
    async (sessionId: string) => {
      const [stm, m] = await Promise.all([
        loadStatementLines(storeId, sessionId),
        loadBankRecMatches(storeId, sessionId),
      ]);
      setStatementLines(stm);
      setMatches(m);
    },
    [storeId],
  );

  const loadSession = useCallback(async () => {
    if (!storeId || !selectedAccount) {
      toast.error("Select a bank account (105 or 106).");
      return;
    }
    if (startDate > endDate) {
      toast.error("Start date must be on or before end date.");
      return;
    }
    setLoading(true);
    try {
      const s = await loadOrCreateBankRecSession(storeId, selectedAccount, startDate, endDate);
      setSession(s);
      setStmtOpeningInput(String(s.statementOpeningBalance ?? ""));
      await refreshSessionData(s.id);
      toast.success(`Session loaded — ${sessionAccountLabel(s.accountCode)} (${s.startDate} → ${s.endDate})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [storeId, selectedAccount, startDate, endDate, refreshSessionData]);

  const handleSaveStatementOpening = async () => {
    if (!session || !storeId || isLocked) return;
    const val = Number(stmtOpeningInput);
    if (!Number.isFinite(val)) {
      toast.error("Enter a valid statement opening balance.");
      return;
    }
    try {
      await updateBankRecSession(storeId, session.id, { statementOpeningBalance: val });
      setSession({ ...session, statementOpeningBalance: val });
      toast.success("Statement opening balance saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleLockSession = async () => {
    if (!session || !storeId || isLocked) return;
    if (!window.confirm("Lock this reconciliation? Statement lines and matches cannot be changed after lock.")) {
      return;
    }
    setLockBusy(true);
    try {
      const opening = Number(stmtOpeningInput);
      if (Number.isFinite(opening)) {
        await updateBankRecSession(storeId, session.id, { statementOpeningBalance: opening });
      }
      const uid = getFinanceAuth().currentUser?.uid;
      const locked = await lockBankRecSession(storeId, session.id, uid);
      setSession(locked);
      toast.success("Reconciliation locked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lock failed");
    } finally {
      setLockBusy(false);
    }
  };

  const handleManualMatch = async () => {
    if (!session || !storeId || !matchStmtId || !matchBookId) {
      toast.error("Select one statement line and one book line.");
      return;
    }
    setMatchingBusy(true);
    try {
      const uid = getFinanceAuth().currentUser?.uid;
      await createBankRecMatch(storeId, session.id, {
        statementLineId: matchStmtId,
        bookLineId: matchBookId,
        matchType: "manual",
        matchedBy: uid,
      });
      await refreshSessionData(session.id);
      setMatchStmtId("");
      setMatchBookId("");
      toast.success("Lines matched.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Match failed");
    } finally {
      setMatchingBusy(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!session || !storeId) return;
    const windowDays = Math.max(0, Math.floor(Number(dateWindowDays) || 3));
    const suggestions = suggestAutoMatches(statementLines, bookLines, matches, {
      dateWindowDays: windowDays,
    });
    if (!suggestions.length) {
      toast.message("No new auto-matches found.");
      return;
    }
    setMatchingBusy(true);
    try {
      const uid = getFinanceAuth().currentUser?.uid;
      const n = await createBankRecMatchesBatch(storeId, session.id, suggestions, "auto", uid);
      await refreshSessionData(session.id);
      toast.success(`Auto-matched ${n} pair(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-match failed");
    } finally {
      setMatchingBusy(false);
    }
  };

  const handleUnmatch = async (matchId: string) => {
    if (!session || !storeId) return;
    setMatchingBusy(true);
    try {
      await deleteBankRecMatch(storeId, session.id, matchId);
      await refreshSessionData(session.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unmatch failed");
    } finally {
      setMatchingBusy(false);
    }
  };

  const handleAddManual = async () => {
    if (!session || !storeId) return;
    const amount = Number(manualAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive amount.");
      return;
    }
    const debit = manualSide === "dr" ? amount : 0;
    const credit = manualSide === "cr" ? amount : 0;
    try {
      const line = await addStatementLine(storeId, session.id, {
        lineDate: manualDate,
        debit,
        credit,
        description: manualDesc || "Manual statement line",
        reference: manualRef || undefined,
        source: "manual",
      });
      setStatementLines((prev) => [...prev, line].sort((a, b) => a.lineDate.localeCompare(b.lineDate)));
      setManualAmount("");
      setManualDesc("");
      setManualRef("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add line");
    }
  };

  const handleCsvFile = async (file: File | null) => {
    if (!file || !session || !storeId) return;
    const text = await file.text();
    const parsed = parseBankStatementCsv(text);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    if (parsed.warnings.length) {
      toast.message(`${parsed.warnings.length} row(s) skipped during import.`);
    }
    try {
      const n = await importStatementLines(storeId, session.id, parsed.rows);
      const stm = await loadStatementLines(storeId, session.id);
      setStatementLines(stm);
      toast.success(`Imported ${n} statement line(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!session || !storeId) return;
    try {
      await deleteStatementLine(storeId, session.id, lineId);
      setStatementLines((prev) => prev.filter((l) => l.id !== lineId));
      setMatches((prev) => prev.filter((m) => m.statementLineId !== lineId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Bank reconciliation
            <SystemGuideInfo
              enabled={systemGuideEnabled}
              label="Scope"
              title="Bank rec"
              content={[
                "Phase 1: statement capture + book side (accounts 105/106).",
                "Phase 2: 1:1 matching — auto by exact amount within a date window, or manual link.",
                "CSV: date, amount, description, ref — optional dr/cr or debit/credit columns.",
              ]}
            />
          </CardTitle>
          <CardDescription>
            Period and account · statement lines · posted GL book side · match pairs (Phase 2).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>GL account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="105 / 106" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Period start</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Period end</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => void loadSession()} disabled={loading || !accountId}>
                {loading ? "Loading…" : "Load session"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Account 102 (cash on hand) is planned for a later phase — use 106/105 for bank USD/LBP.
          </p>
        </CardContent>
      </Card>

      {session && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary (informational)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <span>
                Book lines: <strong>{summary.bookLineCount}</strong>
              </span>
              <span>
                Statement lines: <strong>{summary.statementLineCount}</strong>
              </span>
              <span>
                Book net (Dr−Cr): <strong>{formatCurrency(summary.bookNetDebit)}</strong>
              </span>
              <span>
                Statement net: <strong>{formatCurrency(summary.statementNetDebit)}</strong>
              </span>
              <Badge variant={summary.difference === 0 ? "outline" : "secondary"}>
                Difference {formatCurrency(summary.difference)}
              </Badge>
              <Badge variant="outline">
                Matched {matchPartition.matchedPairs.length} · Unmatched stmt{" "}
                {matchPartition.unmatchedStatement.length} · book {matchPartition.unmatchedBook.length}
              </Badge>
            </CardContent>
          </Card>

          {recReport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Reconciliation report (Phase 3)
                  {isLocked && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" /> Locked
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Book vs statement closing balances for this period.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Book opening</p>
                    <p className="font-semibold">{formatCurrency(recReport.openingBookBalance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Book closing</p>
                    <p className="font-semibold">{formatCurrency(recReport.closingBookBalance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Book period movement</p>
                    <p className="font-semibold">{formatCurrency(recReport.periodBookMovement)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Matched pairs</p>
                    <p className="font-semibold">
                      {recReport.matchedPairCount} · stmt {formatCurrency(recReport.matchedStatementNet)} · book{" "}
                      {formatCurrency(recReport.matchedBookNet)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Outstanding (unmatched stmt / book)</p>
                    <p className="font-semibold">
                      {formatCurrency(recReport.unmatchedStatementNet)} / {formatCurrency(recReport.unmatchedBookNet)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Closing variance (stmt − book)</p>
                    <p className="font-semibold">{formatCurrency(recReport.closingVariance)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-end max-w-md">
                  <div className="flex-1 min-w-[140px]">
                    <Label>Statement opening balance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={stmtOpeningInput}
                      onChange={(e) => setStmtOpeningInput(e.target.value)}
                      disabled={isLocked}
                    />
                  </div>
                  {!isLocked && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleSaveStatementOpening()}>
                        Save opening
                      </Button>
                      <Button type="button" size="sm" disabled={lockBusy} onClick={() => void handleLockSession()}>
                        <Lock className="h-4 w-4 mr-1" />
                        Lock reconciliation
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Statement closing = opening + period statement net ({formatCurrency(recReport.closingStatementBalance)}).
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Matching (Phase 2)
              </CardTitle>
              <CardDescription>
                Exact net amount (Dr−Cr), optional ± day window for auto-match.
                {isLocked && " Session is locked — matching is read-only."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label>Date window (days)</Label>
                  <Input
                    className="w-24"
                    type="number"
                    min="0"
                    value={dateWindowDays}
                    onChange={(e) => setDateWindowDays(e.target.value)}
                    disabled={isLocked}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={matchingBusy || isLocked}
                  onClick={() => void handleAutoMatch()}
                >
                  Auto-match
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Statement line</Label>
                  {isLocked ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground space-y-1">
                      {matchPartition.unmatchedStatement.length === 0 ? (
                        <p>All statement lines matched</p>
                      ) : (
                        matchPartition.unmatchedStatement.map((s) => (
                          <p key={s.id}>
                            {s.lineDate} · {formatCurrency(s.debit || s.credit)} · {s.description.slice(0, 48)}
                          </p>
                        ))
                      )}
                    </div>
                  ) : matchPartition.unmatchedStatement.length === 0 ? (
                    <p className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                      All statement lines matched
                    </p>
                  ) : (
                    <Select
                      value={matchStmtId || undefined}
                      onValueChange={setMatchStmtId}
                      disabled={matchingBusy}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose statement line" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {matchPartition.unmatchedStatement.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.lineDate} · {formatCurrency(s.debit || s.credit)} · {s.description.slice(0, 40)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Book line</Label>
                  {isLocked ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground space-y-1">
                      {matchPartition.unmatchedBook.length === 0 ? (
                        <p>All book lines matched</p>
                      ) : (
                        matchPartition.unmatchedBook.map((b) => (
                          <p key={b.lineId}>
                            {b.entryDate} · {formatCurrency(b.debit || b.credit)} · {b.memo.slice(0, 48)}
                          </p>
                        ))
                      )}
                    </div>
                  ) : matchPartition.unmatchedBook.length === 0 ? (
                    <p className="flex h-10 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                      All book lines matched
                    </p>
                  ) : (
                    <Select
                      value={matchBookId || undefined}
                      onValueChange={setMatchBookId}
                      disabled={matchingBusy}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose book line" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {matchPartition.unmatchedBook.map((b) => (
                          <SelectItem key={b.lineId} value={b.lineId}>
                            {b.entryDate} · {formatCurrency(b.debit || b.credit)} · {b.memo.slice(0, 40)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={matchingBusy || isLocked || !matchStmtId || !matchBookId}
                    onClick={() => void handleManualMatch()}
                  >
                    Match manually
                  </Button>
                </div>
              </div>
              {matchPartition.matchedPairs.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statement</TableHead>
                      <TableHead>Book (GL)</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchPartition.matchedPairs.map(({ statement, book, match }) => (
                      <TableRow key={match.id}>
                        <TableCell className="text-sm">
                          {statement.lineDate} · {statement.description}
                        </TableCell>
                        <TableCell className="text-sm">
                          {book.entryDate} · {book.memo.slice(0, 50)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{match.matchType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={matchingBusy || isLocked}
                            onClick={() => void handleUnmatch(match.id)}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Book side (posted GL)</CardTitle>
                <CardDescription>
                  {sessionAccountLabel(session.accountCode)} · {session.startDate} → {session.endDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="text-right">Dr</TableHead>
                      <TableHead className="text-right">Cr</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookLines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          No posted lines in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bookLines.map((row) => (
                        <TableRow key={row.lineId} className={matchedBookIds.has(row.lineId) ? "bg-muted/40" : undefined}>
                          <TableCell>{row.entryDate}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={row.memo}>
                            {matchedBookIds.has(row.lineId) && (
                              <Badge variant="outline" className="mr-1 text-xs">
                                matched
                              </Badge>
                            )}
                            {row.voucherNumber ? `${row.voucherNumber} · ` : ""}
                            {row.memo}
                          </TableCell>
                          <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : "—"}</TableCell>
                          <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bank statement lines</CardTitle>
                <CardDescription>Manual entry or CSV import</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Dr / Cr</Label>
                    <Select value={manualSide} onValueChange={(v) => setManualSide(v as "dr" | "cr")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dr">Debit (deposit)</SelectItem>
                        <SelectItem value="cr">Credit (payment)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reference</Label>
                    <Input value={manualRef} onChange={(e) => setManualRef(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Description</Label>
                    <Input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={isLocked} onClick={() => void handleAddManual()}>
                    Add line
                  </Button>
                  <Label className={`inline-flex items-center gap-2 ${isLocked ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Import CSV</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => void handleCsvFile(e.target.files?.[0] ?? null)}
                    />
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadSession()}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
                <div className="max-h-[280px] overflow-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Dr</TableHead>
                        <TableHead className="text-right">Cr</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statementLines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground">
                            No statement lines yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        statementLines.map((row) => (
                          <TableRow key={row.id} className={matchedStmtIds.has(row.id) ? "bg-muted/40" : undefined}>
                            <TableCell>{row.lineDate}</TableCell>
                            <TableCell className="max-w-[160px] truncate" title={row.description}>
                              {matchedStmtIds.has(row.id) && (
                                <Badge variant="outline" className="mr-1 text-xs">
                                  matched
                                </Badge>
                              )}
                              {row.description}
                              {row.reference ? ` (${row.reference})` : ""}
                            </TableCell>
                            <TableCell className="text-right">{row.debit ? formatCurrency(row.debit) : "—"}</TableCell>
                            <TableCell className="text-right">{row.credit ? formatCurrency(row.credit) : "—"}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={isLocked}
                                onClick={() => void handleDeleteLine(row.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
