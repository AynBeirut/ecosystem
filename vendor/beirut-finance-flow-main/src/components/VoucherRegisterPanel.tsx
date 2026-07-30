import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import VoucherDetailDialog from "@/components/VoucherDetailDialog";
import type { JournalEntry, JournalLine, PcgClientAccount } from "@/types/generalLedger";
import SystemGuideInfo from "@/components/SystemGuideInfo";

type RegisterFilter = "all" | "sales" | "manual" | "system";

type Props = {
  entries: JournalEntry[];
  lines: JournalLine[];
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: import("@/lib/grabio/accountingMode").AccountingLanguage;
  isLebaneseCoa?: boolean;
  systemGuideEnabled?: boolean;
  onPostDraft?: (entryId: string) => void;
  postingDraft?: boolean;
  onReverse?: (entryId: string) => void;
  reversing?: boolean;
};

function entryLabel(entry: JournalEntry) {
  if (entry.voucherNumber) return entry.voucherNumber;
  if (entry.sourceType === "order" && entry.event === "sale-recognized") return `Sales voucher · ${entry.memo}`;
  return entry.memo || entry.id;
}

function entryKind(entry: JournalEntry) {
  if (entry.sourceType === "order" && entry.event === "sale-recognized") return "Sales";
  if (entry.voucherType) return entry.voucherType;
  return entry.sourceType;
}

function matchesFilter(entry: JournalEntry, filter: RegisterFilter) {
  if (filter === "all") return true;
  if (filter === "sales") return entry.sourceType === "order" && entry.event === "sale-recognized";
  if (filter === "manual") return Boolean(entry.voucherType);
  return !entry.voucherType && !(entry.sourceType === "order" && entry.event === "sale-recognized");
}

export default function VoucherRegisterPanel({
  entries,
  lines,
  pcgClientAccounts = [],
  accountingLanguage,
  isLebaneseCoa,
  systemGuideEnabled = false,
  onPostDraft,
  postingDraft,
  onReverse,
  reversing,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RegisterFilter>("all");
  const [selectedEntryId, setSelectedEntryId] = useState("");

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
          return [entry.id, entry.memo, entry.sourceId, entry.sourceType, entry.event, entry.voucherNumber]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [entries, filter, query],
  );

  const selectedEntry = postedEntries.find((entry) => entry.id === selectedEntryId) || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Voucher register
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="What the voucher register is"
            title="Voucher register"
            content={[
              "Read-only list of posted journal entries: manual vouchers (JV/PV/RV/CV), POS sales, purchases, and system postings.",
              "Click a row to inspect lines and amounts. Nothing here reposts or edits the ledger.",
            ]}
          />
        </CardTitle>
        <CardDescription>
          Read-only register over posted vouchers and old sales. Opening a row does not repost or change accounting data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <Select value={filter} onValueChange={(value) => setFilter(value as RegisterFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entries</SelectItem>
              <SelectItem value="sales">Sales vouchers</SelectItem>
              <SelectItem value="manual">Manual vouchers</SelectItem>
              <SelectItem value="system">System entries</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search voucher, order, memo, source…"
          />
        </div>

        <div className="rounded-md border max-h-80 overflow-auto">
          {draftEntries.length > 0 ? (
            <div className="p-3 border-b bg-muted/30">
              <p className="text-sm font-medium mb-2">Drafts ({draftEntries.length})</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date.slice(0, 10)}</TableCell>
                      <TableCell>
                        {entry.voucherType || "JV"}
                        {entry.status === "pending_approval" ? (
                          <Badge variant="secondary" className="ml-2">Pending approval</Badge>
                        ) : (
                          <Badge variant="outline" className="ml-2">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>{entry.memo}</TableCell>
                      <TableCell className="text-right">
                        {onPostDraft ? (
                          <Button type="button" size="sm" disabled={postingDraft} onClick={() => onPostDraft(entry.id)}>
                            Post
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Voucher / Memo</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Lines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {postedEntries.slice(0, 250).map((entry) => {
                const entryLines = lines.filter((line) => line.entryId === entry.id);
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEntryId(entry.id)}
                  >
                    <TableCell>{entry.date.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.sourceType === "order" ? "secondary" : "outline"}>{entryKind(entry)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{entryLabel(entry)}</div>
                      <div className="text-xs text-muted-foreground">{entry.id}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.sourceType}
                      {entry.sourceId ? ` · ${entry.sourceId}` : ""}
                    </TableCell>
                    <TableCell className="text-right">{entryLines.length}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {Math.min(postedEntries.length, 250)} of {postedEntries.length} matching posted entries.
        </p>
      </CardContent>

      <VoucherDetailDialog
        entry={selectedEntry}
        lines={lines}
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => !open && setSelectedEntryId("")}
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
    </Card>
  );
}
