import { useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { LEBANESE_PCG_CHART, type LebanesePcgAccount } from "@/lib/ledger/lebanesePcgChart.generated";
import { filterPcgChart, flattenPcgChart, kindLabel } from "@/lib/ledger/lebanesePcgTree";
import { buildClientByGrabioMap, buildClientByParentPcgMap, mapGrabioCodeToPcg, resolvePcgDisplay, displayPcgCodeForLedgerRow, displayGrabioCodeForLedgerRow } from "@/lib/ledger/grabioToPcgMap";
import { supportsArabicEntry, type AccountingLanguage } from "@/lib/grabio/accountingMode";
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from "@/types/generalLedger";
import SystemGuideInfo from "@/components/SystemGuideInfo";

type Props = {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  pcgClientAccounts: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  isLebaneseCoa: boolean;
  onAddClientAccount: (account: LebanesePcgAccount) => void;
  onOpenVouchers: () => void;
  onViewAccount?: (accountId: string, label: string) => void;
  onViewEntry?: (entryId: string) => void;
  systemGuideEnabled?: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function isPostedInRange(entry: JournalEntry) {
  return entry.status === "posted";
}

export default function AccountantWorkspacePanel({
  accounts,
  entries,
  lines,
  pcgClientAccounts,
  accountingLanguage,
  isLebaneseCoa,
  onAddClientAccount,
  onOpenVouchers,
  onViewAccount,
  onViewEntry,
  systemGuideEnabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedPcgCode, setSelectedPcgCode] = useState("");
  const clientByGrabio = useMemo(() => buildClientByGrabioMap(pcgClientAccounts), [pcgClientAccounts]);
  const clientByParentPcg = useMemo(() => buildClientByParentPcgMap(pcgClientAccounts), [pcgClientAccounts]);
  const arabicEntry = supportsArabicEntry(accountingLanguage);

  const pcgRows = useMemo(() => {
    const flat = flattenPcgChart(filterPcgChart(LEBANESE_PCG_CHART, query));
    return flat.slice(0, 150).map((row) => {
      const clientRows = clientByParentPcg.get(row.code);
      return {
        ...row,
        displayCode: clientRows?.length ? clientRows.map((c) => c.clientCode).join(", ") : row.code,
      };
    });
  }, [query, clientByParentPcg]);
  const selectedPcg = useMemo(
    () => LEBANESE_PCG_CHART.find((account) => account.code === selectedPcgCode) || pcgRows[0] || null,
    [pcgRows, selectedPcgCode],
  );

  const postedEntries = useMemo(() => new Map(entries.filter(isPostedInRange).map((entry) => [entry.id, entry])), [entries]);

  const linkedOperationalAccounts = useMemo(() => {
    if (!selectedPcg) return [];
    return accounts.filter((account) => {
      if (account.isPcgChart) return account.code === selectedPcg.code;
      const mapped = mapGrabioCodeToPcg(account.code);
      const client = clientByGrabio.get(account.code);
      return mapped === selectedPcg.code || client?.parentPcgCode === selectedPcg.code;
    });
  }, [accounts, clientByGrabio, selectedPcg]);

  const linkedAccountIds = useMemo(
    () => new Set(linkedOperationalAccounts.map((account) => account.id)),
    [linkedOperationalAccounts],
  );

  const activityRows = useMemo(() => {
    if (!linkedAccountIds.size) return [];
    return lines
      .filter((line) => linkedAccountIds.has(line.accountId))
      .map((line) => ({ line, entry: postedEntries.get(line.entryId) }))
      .filter((row): row is { line: JournalLine; entry: JournalEntry } => Boolean(row.entry))
      .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.entry.id.localeCompare(a.entry.id))
      .slice(0, 80);
  }, [lines, linkedAccountIds, postedEntries]);

  const movement = useMemo(
    () => ({
      debit: round2(activityRows.reduce((sum, row) => sum + (Number(row.line.debit) || 0), 0)),
      credit: round2(activityRows.reduce((sum, row) => sum + (Number(row.line.credit) || 0), 0)),
    }),
    [activityRows],
  );

  const displayForAccount = (account: LedgerAccount) => {
    if (!isLebaneseCoa) return { code: account.code, name: account.name, nameAr: account.nameAr, grabio: account.code };
    return {
      code: displayPcgCodeForLedgerRow(account, clientByGrabio, clientByParentPcg),
      name: resolvePcgDisplay(account.code, account.name, clientByGrabio)?.name || account.name,
      nameAr: resolvePcgDisplay(account.code, account.name, clientByGrabio)?.nameAr || account.nameAr,
      grabio: displayGrabioCodeForLedgerRow(account, clientByParentPcg),
    };
  };

  if (!isLebaneseCoa) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accountant workspace</CardTitle>
          <CardDescription>Switch the store to Lebanese accounting to use the PCG-first workspace.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            PCG chart workspace
            <SystemGuideInfo
              enabled={systemGuideEnabled}
              label="What the workspace does"
              title="Accountant workspace"
              content={[
                "Search the Lebanese PCG chart, pick an account, then review linked posting accounts and recent voucher activity without leaving this page.",
                "Use Add working number to create a client sub-account under the selected PCG code.",
              ]}
            />
          </CardTitle>
          <CardDescription>
            Search the Excel chart, select an account, then add a working number or review activity without changing
            pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code, name, Arabic…" />
          <div className="rounded-md border max-h-[520px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Account number</TableHead>
                  <TableHead className="w-[72px]">Grabio</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[60px]">M</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pcgRows.map((row) => (
                  <TableRow
                    key={row.code}
                    className={row.code === selectedPcg?.code ? "bg-teal-50/80 dark:bg-teal-950/20" : "cursor-pointer"}
                    onClick={() => setSelectedPcgCode(row.code)}
                  >
                    <TableCell className="font-mono text-xs tabular-nums" style={{ paddingLeft: 8 + row.depth * 12 }}>
                      {row.displayCode}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.kind === "G" ? "—" : mapGrabioCodeToPcg(row.code) ? displayGrabioCodeForLedgerRow({ code: row.code, isPcgChart: true }, clientByParentPcg) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className={row.kind === "G" ? "font-medium text-red-700 dark:text-red-400" : undefined}>
                        {row.name}
                      </div>
                      {arabicEntry && row.nameAr ? (
                        <div dir="rtl" className="text-xs text-muted-foreground text-right">
                          {row.nameAr}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.kind === "G" ? "secondary" : "outline"}>{kindLabel(row.kind)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {pcgRows.length} of {LEBANESE_PCG_CHART.length} PCG rows from the Excel chart.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selectedPcg ? `${selectedPcg.code} · ${selectedPcg.name}` : "Select a PCG account"}</CardTitle>
          <CardDescription>
            {selectedPcg?.nameAr ? <span dir="rtl">{selectedPcg.nameAr}</span> : "Select an account from the PCG chart."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {selectedPcg ? (
              <Button type="button" onClick={() => onAddClientAccount(selectedPcg)}>
                <Plus className="h-4 w-4 mr-1" /> Add working account here
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onOpenVouchers}>
              <FileText className="h-4 w-4 mr-1" /> Open voucher register
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Linked posting accounts</p>
              <p className="text-2xl font-semibold">{linkedOperationalAccounts.length}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Debit movement</p>
              <p className="text-lg font-semibold">{formatCurrency(movement.debit)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Credit movement</p>
              <p className="text-lg font-semibold">{formatCurrency(movement.credit)}</p>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Linked accounts</h3>
            {linkedOperationalAccounts.length ? (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account number</TableHead>
                      <TableHead className="w-[72px]">Grabio</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedOperationalAccounts.map((account) => {
                      const display = displayForAccount(account);
                      return (
                        <TableRow key={account.id}>
                          <TableCell className="font-mono text-xs tabular-nums">{display.code}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{display.grabio}</TableCell>
                          <TableCell>
                            <div>{display.name}</div>
                            {arabicEntry && display.nameAr ? (
                              <div dir="rtl" className="text-xs text-muted-foreground text-right">
                                {display.nameAr}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {onViewAccount ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onViewAccount(account.id, `${display.code} · ${display.name}`)}
                              >
                                Ledger
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No activity is linked yet. Add a working account here, or choose a PCG account that is mapped to a
                posting account.
              </p>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2">Recent activity</h3>
            <div className="rounded-md border max-h-80 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher / Memo</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityRows.map(({ entry, line }) => (
                    <TableRow
                      key={line.id}
                      className={onViewEntry ? "cursor-pointer hover:bg-muted/40" : undefined}
                      onClick={() => onViewEntry?.(entry.id)}
                    >
                      <TableCell>{entry.date.slice(0, 10)}</TableCell>
                      <TableCell>
                        <div>{entry.voucherNumber || entry.memo}</div>
                        <div className="text-xs text-muted-foreground">{entry.sourceType}</div>
                      </TableCell>
                      <TableCell>{line.description || "—"}</TableCell>
                      <TableCell className="text-right">{line.debit ? formatCurrency(line.debit) : "—"}</TableCell>
                      <TableCell className="text-right">{line.credit ? formatCurrency(line.credit) : "—"}</TableCell>
                      <TableCell>
                        {onViewEntry ? (
                          <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); onViewEntry(entry.id); }}>
                            Open
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!activityRows.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No posted activity for this PCG account yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
