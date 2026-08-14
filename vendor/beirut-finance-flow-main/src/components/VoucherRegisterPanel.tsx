import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import VoucherDetailDialog from "@/components/VoucherDetailDialog";
import type { JournalEntry, JournalLine, PcgClientAccount } from "@/types/generalLedger";
import SystemGuideInfo from "@/components/SystemGuideInfo";
import { cn, formatCurrency } from "@/lib/utils";

export type RegisterFilter =
  | "all"
  | "jv"
  | "pv"
  | "rv"
  | "cv"
  | "sales"
  | "purchase"
  | "returns"
  | "manual"
  | "system";

type Props = {
  entries: JournalEntry[];
  lines: JournalLine[];
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: import("@/lib/grabio/accountingMode").AccountingLanguage;
  isLebaneseCoa?: boolean;
  systemGuideEnabled?: boolean;
  defaultOpen?: boolean;
  initialFilter?: RegisterFilter;
  lockFilter?: boolean;
  onPostDraft?: (entryId: string) => void;
  postingDraft?: boolean;
  onReverse?: (entryId: string) => void;
  reversing?: boolean;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function voucherMeta(entry: JournalEntry): Record<string, unknown> | undefined {
  return entry.voucherMeta as Record<string, unknown> | undefined;
}

function entryTypeLabel(entry: JournalEntry): string {
  if (entry.voucherType) return entry.voucherType;
  if (entry.voucherNumber?.startsWith("RV-")) return "RV";
  if (entry.voucherNumber?.startsWith("PV-")) return "PV";
  if (entry.voucherNumber?.startsWith("JV-")) return "JV";
  if (entry.voucherNumber?.startsWith("CV-")) return "CV";
  if (entry.sourceType === "order") return "Sale";
  if (entry.sourceType === "purchase") return "Purchase";
  return "System";
}

function entryVoucherNo(entry: JournalEntry): string {
  if (entry.voucherNumber) return entry.voucherNumber;
  if (entry.sourceType === "order" && entry.memo) {
    const cleaned = entry.memo.replace(/^Order\s+/i, "").trim();
    return cleaned || "POS sale";
  }
  return "—";
}

function entryDescription(entry: JournalEntry): string {
  const memo = entry.memo?.trim();
  const meta = voucherMeta(entry);
  if (entry.voucherType === "PV" && meta?.payee) return String(meta.payee);
  if (entry.voucherType === "RV" && meta?.payer) return String(meta.payer);
  if (entry.sourceType === "order" && memo) {
    const stripped = memo.replace(/^Order\s+/i, "").trim();
    return stripped ? `Sale · ${stripped}` : memo;
  }
  return memo || "—";
}

function entryReference(entry: JournalEntry): string {
  const meta = voucherMeta(entry);
  if (typeof meta?.paymentRef === "string" && meta.paymentRef.trim()) return meta.paymentRef.trim();
  if (typeof meta?.receiptRef === "string" && meta.receiptRef.trim()) return meta.receiptRef.trim();
  if (entry.sourceType === "order") return "POS";
  if (entry.sourceType === "purchase") return "Purchase";
  if (entry.sourceType === "manual") return "Manual";
  if (entry.sourceType === "expense") return "Expense";
  return "Ledger";
}

function typeBadgeClass(type: string): string {
  if (type === "RV" || type === "Sale") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (type === "PV") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (type === "JV") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (type === "CV") return "bg-violet-50 text-violet-700 ring-violet-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function matchesFilter(entry: JournalEntry, filter: RegisterFilter) {
  if (filter === "all") return true;
  if (filter === "jv") return entry.voucherType === "JV";
  if (filter === "pv") return entry.voucherType === "PV";
  if (filter === "rv") return entry.voucherType === "RV" || entry.voucherNumber?.startsWith("RV-");
  if (filter === "cv") return entry.voucherType === "CV";
  if (filter === "sales") {
    return entry.sourceType === "order" && (entry.event === "sale-recognized" || entry.event === "paid");
  }
  if (filter === "purchase") return entry.sourceType === "purchase";
  if (filter === "returns") {
    return entry.event === "reversal" || String(entry.memo || "").toLowerCase().includes("return");
  }
  if (filter === "manual") return Boolean(entry.voucherType);
  return !entry.voucherType && !(entry.sourceType === "order" && entry.event === "sale-recognized");
}

function filterTitle(filter: RegisterFilter): string {
  switch (filter) {
    case "jv":
      return "Journal vouchers (JV)";
    case "pv":
      return "Payment vouchers (PV)";
    case "rv":
      return "Receipt vouchers (RV)";
    case "cv":
      return "Contra vouchers (CV)";
    case "sales":
      return "Sales invoices";
    case "purchase":
      return "Purchase vouchers";
    case "returns":
      return "Returns";
    case "manual":
      return "Manual vouchers";
    case "system":
      return "System entries";
    default:
      return "All voucher types";
  }
}

export default function VoucherRegisterPanel({
  entries,
  lines,
  pcgClientAccounts = [],
  accountingLanguage,
  isLebaneseCoa,
  systemGuideEnabled = false,
  defaultOpen = false,
  initialFilter = "all",
  lockFilter = false,
  onPostDraft,
  postingDraft,
  onReverse,
  reversing,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RegisterFilter>(initialFilter);
  const [selectedEntryId, setSelectedEntryId] = useState("");

  useEffect(() => {
    if (lockFilter) setFilter(initialFilter);
  }, [initialFilter, lockFilter]);

  const lineTotalsByEntry = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      const debit = Number(line.debit) || 0;
      if (debit <= 0) continue;
      map.set(line.entryId, round2((map.get(line.entryId) || 0) + debit));
    }
    return map;
  }, [lines]);

  const draftEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.status === "draft" || entry.status === "pending_approval")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [entries],
  );

  const postedEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.status === "posted")
        .filter((entry) => matchesFilter(entry, filter))
        .filter((entry) => {
          const needle = query.trim().toLowerCase();
          if (!needle) return true;
          return [
            entry.voucherNumber,
            entry.memo,
            entryDescription(entry),
            entryReference(entry),
            entryTypeLabel(entry),
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [entries, filter, query],
  );

  const selectedEntry = postedEntries.find((entry) => entry.id === selectedEntryId) || null;
  const visibleCount = Math.min(postedEntries.length, 250);
  const scopeTitle = filterTitle(filter);
  const countLabel = postedEntries.length.toLocaleString();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50/80 sm:items-center"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-slate-900">Voucher register</span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                  {countLabel}
                </span>
                {draftEntries.length ? (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                    {draftEntries.length} draft
                  </span>
                ) : null}
                <SystemGuideInfo
                  enabled={systemGuideEnabled}
                  label="What the voucher register is"
                  title="Voucher register"
                  content={[
                    "Read-only list of posted journal entries: manual vouchers (JV/PV/RV/CV), POS sales, purchases, and system postings.",
                    "Click a row to inspect lines and amounts. Nothing here reposts or edits the ledger.",
                  ]}
                />
              </div>
              <p className="pl-10 text-xs leading-relaxed text-slate-500 sm:pl-0">
                {scopeTitle} · {countLabel} posted · read-only history
              </p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              {open ? "Collapse" : "Expand"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!lockFilter ? (
                <Select value={filter} onValueChange={(value) => setFilter(value as RegisterFilter)}>
                  <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs sm:w-[11rem]">
                    <SelectValue placeholder="Filter type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entries</SelectItem>
                    <SelectItem value="jv">JV — Journal</SelectItem>
                    <SelectItem value="pv">PV — Payment</SelectItem>
                    <SelectItem value="rv">RV — Receipt</SelectItem>
                    <SelectItem value="cv">CV — Contra</SelectItem>
                    <SelectItem value="sales">Sales invoices</SelectItem>
                    <SelectItem value="purchase">Purchases</SelectItem>
                    <SelectItem value="returns">Returns</SelectItem>
                    <SelectItem value="manual">Manual vouchers</SelectItem>
                    <SelectItem value="system">System entries</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}

              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search voucher no., client, memo…"
                  className="h-9 rounded-lg border-slate-200 bg-white pl-9 text-sm shadow-sm"
                />
              </div>
            </div>

            {draftEntries.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Drafts ({draftEntries.length})
                </p>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-9 text-xs">Date</TableHead>
                        <TableHead className="h-9 text-xs">Type</TableHead>
                        <TableHead className="h-9 text-xs">Description</TableHead>
                        <TableHead className="h-9 w-20 text-xs" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="py-2 text-xs">{entry.date.slice(0, 10)}</TableCell>
                          <TableCell className="py-2 text-xs">{entry.voucherType || "JV"}</TableCell>
                          <TableCell className="py-2 text-xs">{entry.memo}</TableCell>
                          <TableCell className="py-2 text-right">
                            {onPostDraft ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={postingDraft}
                                onClick={() => onPostDraft(entry.id)}
                              >
                                Post
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="max-h-[22rem] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-800">
                    <TableRow className="border-slate-700 hover:bg-slate-800">
                      <TableHead className="h-10 whitespace-nowrap text-xs font-semibold text-white">Date</TableHead>
                      <TableHead className="h-10 w-16 text-xs font-semibold text-white">Type</TableHead>
                      <TableHead className="h-10 w-36 text-xs font-semibold text-white">Voucher no.</TableHead>
                      <TableHead className="h-10 text-xs font-semibold text-white">Description</TableHead>
                      <TableHead className="h-10 w-24 text-right text-xs font-semibold text-white">Amount</TableHead>
                      <TableHead className="h-10 w-16 text-xs font-semibold text-white">Ref</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postedEntries.slice(0, 250).map((entry, index) => {
                      const type = entryTypeLabel(entry);
                      const amount = lineTotalsByEntry.get(entry.id) || 0;
                      return (
                        <TableRow
                          key={entry.id}
                          className={cn(
                            "cursor-pointer border-slate-100",
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/70",
                            "hover:bg-teal-50/60",
                          )}
                          onClick={() => setSelectedEntryId(entry.id)}
                        >
                          <TableCell className="whitespace-nowrap py-2.5 text-xs tabular-nums text-slate-600">
                            {entry.date.slice(0, 10)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span
                              className={cn(
                                "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                                typeBadgeClass(type),
                              )}
                            >
                              {type}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 font-mono text-xs font-medium text-slate-800">
                            {entryVoucherNo(entry)}
                          </TableCell>
                          <TableCell className="max-w-[16rem] truncate py-2.5 text-sm text-slate-800">
                            {entryDescription(entry)}
                          </TableCell>
                          <TableCell className="py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                            {amount ? formatCurrency(amount) : "—"}
                          </TableCell>
                          <TableCell className="py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            {entryReference(entry)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!postedEntries.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-500">
                          No posted vouchers match this filter.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-500">
              Showing {visibleCount.toLocaleString()} of {postedEntries.length.toLocaleString()} entries · click a row
              for full detail
            </p>
          </div>
        </CollapsibleContent>
      </div>

      <VoucherDetailDialog
        entry={selectedEntry}
        lines={lines}
        open={Boolean(selectedEntry)}
        onOpenChange={(openDialog) => !openDialog && setSelectedEntryId("")}
        isLebaneseCoa={isLebaneseCoa}
        pcgClientAccounts={pcgClientAccounts}
        accountingLanguage={accountingLanguage}
        canReverse={Boolean(onReverse)}
        reversing={reversing}
        onReverse={(id) => {
          onReverse?.(id);
          setSelectedEntryId("");
        }}
      />
    </Collapsible>
  );
}
