import { useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { LEBANESE_PCG_CHART, type LebanesePcgAccount } from "@/lib/ledger/lebanesePcgChart.generated";
import { filterPcgChart, flattenPcgChart, kindLabel } from "@/lib/ledger/lebanesePcgTree";
import {
  buildClientByGrabioMap,
  buildClientByParentPcgMap,
  mapGrabioCodeToPcg,
  resolvePcgDisplay,
  displayPcgCodeForLedgerRow,
  displayGrabioCodeForLedgerRow,
} from "@/lib/ledger/grabioToPcgMap";
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
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

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
      .map((line) => ({ line, entry: postedEntries.get(line.entryId), account: accountById.get(line.accountId) }))
      .filter((row): row is { line: JournalLine; entry: JournalEntry; account?: LedgerAccount } => Boolean(row.entry))
      .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.entry.id.localeCompare(a.entry.id))
      .slice(0, 80);
  }, [lines, linkedAccountIds, postedEntries, accountById]);

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
      <div className="legacy-erp-shell p-4 text-sm">
        Switch the store to Lebanese accounting to use the PCG-first workspace.
      </div>
    );
  }

  return (
    <div className="legacy-erp-shell overflow-hidden">
      <div className="legacy-erp-toolbar">
        <Search className="h-4 w-4" />
        Accountant workspace
        <SystemGuideInfo
          enabled={systemGuideEnabled}
          label="What the workspace does"
          title="Accountant workspace"
          content={[
            "Search the Lebanese PCG chart, pick an account, then review linked posting accounts and recent voucher activity without leaving this page.",
            "Use Add working number to create a client sub-account under the selected PCG code.",
          ]}
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search code, name, Arabic…"
          className="legacy-erp-input ml-auto h-8 max-w-sm"
        />
      </div>

      <div className="legacy-erp-body legacy-erp-split">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>Account list</span>
            <span>{pcgRows.length} / {LEBANESE_PCG_CHART.length}</span>
          </div>
          <div className="max-h-[520px] overflow-auto rounded-sm border border-slate-400 bg-white">
            <table className="legacy-erp-grid">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Account Name</th>
                  <th className="w-12">M</th>
                </tr>
              </thead>
              <tbody>
                {pcgRows.map((row) => (
                  <tr
                    key={row.code}
                    className={cn("cursor-pointer", row.code === selectedPcg?.code && "is-selected")}
                    onClick={() => setSelectedPcgCode(row.code)}
                  >
                    <td className="font-mono" style={{ paddingLeft: 8 + row.depth * 12 }}>
                      {row.displayCode}
                    </td>
                    <td>
                      <div className={row.kind === "G" ? "font-medium text-red-700 dark:text-red-400" : undefined}>
                        {row.name}
                      </div>
                      {arabicEntry && row.nameAr ? (
                        <div dir="rtl" className="text-[10px] text-muted-foreground">
                          {row.nameAr}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Badge variant={row.kind === "G" ? "secondary" : "outline"}>{kindLabel(row.kind)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-sm border border-slate-400 bg-[#f5f4ea] px-3 py-2">
            <p className="text-sm font-semibold">
              {selectedPcg ? `${selectedPcg.code} · ${selectedPcg.name}` : "Select a PCG account"}
            </p>
            {selectedPcg?.nameAr ? (
              <p dir="rtl" className="text-xs text-muted-foreground">
                {selectedPcg.nameAr}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedPcg ? (
              <Button type="button" size="sm" onClick={() => onAddClientAccount(selectedPcg)}>
                <Plus className="mr-1 h-4 w-4" /> Add working account
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={onOpenVouchers}>
              <FileText className="mr-1 h-4 w-4" /> Open vouchers
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-sm border border-slate-400 bg-white px-3 py-2 text-xs">
              <p className="text-muted-foreground">Linked accounts</p>
              <p className="text-xl font-semibold tabular-nums">{linkedOperationalAccounts.length}</p>
            </div>
            <div className="rounded-sm border border-slate-400 bg-white px-3 py-2 text-xs">
              <p className="text-muted-foreground">Total debit</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(movement.debit)}</p>
            </div>
            <div className="rounded-sm border border-slate-400 bg-white px-3 py-2 text-xs">
              <p className="text-muted-foreground">Total credit</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(movement.credit)}</p>
            </div>
          </div>

          {linkedOperationalAccounts.length ? (
            <div className="overflow-auto rounded-sm border border-slate-400 bg-white">
              <table className="legacy-erp-grid">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Account Name</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {linkedOperationalAccounts.map((account) => {
                    const display = displayForAccount(account);
                    return (
                      <tr key={account.id}>
                        <td className="font-mono">{display.code}</td>
                        <td>
                          <div>{display.name}</div>
                          {arabicEntry && display.nameAr ? (
                            <div dir="rtl" className="text-[10px] text-muted-foreground">
                              {display.nameAr}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-right">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-sm border border-dashed border-slate-400 bg-white p-4 text-sm text-muted-foreground">
              No linked posting accounts yet. Add a working account or pick another PCG row.
            </p>
          )}

          <div>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Journal activity</p>
            <div className="max-h-80 overflow-auto rounded-sm border border-slate-400 bg-white">
              <table className="legacy-erp-grid">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Account Name</th>
                    <th>Cur</th>
                    <th>Dept</th>
                    <th className="text-center">D/C</th>
                    <th className="text-right">Amount</th>
                    <th>Voucher</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map(({ entry, line, account }) => {
                    const display = account ? displayForAccount(account) : null;
                    const dc = Number(line.debit) > 0 ? "D" : "C";
                    const amount = Number(line.debit) > 0 ? line.debit : line.credit;
                    return (
                      <tr
                        key={line.id}
                        className={onViewEntry ? "cursor-pointer" : undefined}
                        onClick={() => onViewEntry?.(entry.id)}
                      >
                        <td>{entry.date.slice(0, 10)}</td>
                        <td className="font-mono">{display?.code || "—"}</td>
                        <td>{display?.name || line.description || "—"}</td>
                        <td>{line.transactionCurrency || "—"}</td>
                        <td>Default</td>
                        <td className="text-center font-semibold">{dc}</td>
                        <td className="text-right">{amount ? formatCurrency(amount) : "—"}</td>
                        <td>{entry.voucherNumber || entry.memo}</td>
                      </tr>
                    );
                  })}
                  {!activityRows.length ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        No posted activity for this PCG account yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
