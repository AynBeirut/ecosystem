import { useMemo, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEBANESE_PCG_CHART, type LebanesePcgAccount } from "@/lib/ledger/lebanesePcgChart.generated";
import { filterPcgChart, flattenPcgChart, kindLabel } from "@/lib/ledger/lebanesePcgTree";
import { mappedPcgCodes, mapGrabioCodeToPcg } from "@/lib/ledger/grabioToPcgMap";
import type { LedgerAccount, PcgClientAccount } from "@/types/generalLedger";

type PcgFilter = "all" | "mapped" | "client" | "unused";

type Props = {
  activeLedgerAccounts?: LedgerAccount[];
  pcgClientAccounts?: PcgClientAccount[];
  onAddClientAccount?: (account: LebanesePcgAccount) => void;
};

function kindVariant(kind: string): "default" | "secondary" | "outline" | "destructive" {
  if (kind === "G") return "secondary";
  if (kind === "D") return "default";
  if (kind === "C") return "outline";
  return "outline";
}

export default function LebanesePcgCoaPanel({
  activeLedgerAccounts = [],
  pcgClientAccounts = [],
  onAddClientAccount,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PcgFilter>("all");
  const activeCodes = useMemo(() => new Set(activeLedgerAccounts.map((a) => a.code)), [activeLedgerAccounts]);
  const mappedCodes = useMemo(() => mappedPcgCodes(), []);
  const clientPcgCodes = useMemo(
    () => new Set(pcgClientAccounts.map((a) => a.parentPcgCode || a.clientCode)),
    [pcgClientAccounts],
  );
  const grabioByPcg = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const account of activeLedgerAccounts) {
      const pcg = mapGrabioCodeToPcg(account.code);
      if (!pcg) continue;
      const list = out.get(pcg) || [];
      list.push(account.code);
      out.set(pcg, list);
    }
    return out;
  }, [activeLedgerAccounts]);

  const ledgerByCode = useMemo(
    () => new Map(activeLedgerAccounts.filter((a) => a.isPcgChart).map((a) => [a.code, a])),
    [activeLedgerAccounts],
  );

  const matchesFilter = useCallback(
    (row: LebanesePcgAccount) => {
      const isHeader = row.kind === "G";
      const isMapped = mappedCodes.has(row.code);
      const hasClient = clientPcgCodes.has(row.code) || pcgClientAccounts.some((c) => c.parentPcgCode === row.code);
      const hasLedger = ledgerByCode.has(row.code);
      const hasGrabio = Boolean(grabioByPcg.get(row.code)?.length);
      if (filter === "mapped") return isMapped || hasGrabio;
      if (filter === "client") return hasClient;
      if (filter === "unused") return !isHeader && !isMapped && !hasClient && !hasGrabio;
      return true;
    },
    [filter, mappedCodes, clientPcgCodes, pcgClientAccounts, grabioByPcg, ledgerByCode],
  );

  const rows = useMemo(() => {
    const filtered = filterPcgChart(LEBANESE_PCG_CHART, query).filter(matchesFilter);
    return flattenPcgChart(filtered);
  }, [query, matchesFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search code, English, or Arabic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as PcgFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="mapped">Mapped / posting</SelectItem>
            <SelectItem value="client">Client codes</SelectItem>
            <SelectItem value="unused">Unused detail</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {rows.length} / {LEBANESE_PCG_CHART.length} PCG · {ledgerByCode.size} in ledger
        </span>
      </div>

      <div className="rounded-md border max-h-[min(70vh,640px)] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[120px]">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="min-w-[180px]">ArabicNa</TableHead>
              <TableHead className="w-[56px] text-center">M</TableHead>
              <TableHead className="w-[56px]">Cur</TableHead>
              <TableHead className="w-[80px]">Ledger</TableHead>
              {onAddClientAccount ? <TableHead className="w-[150px] text-right">Action</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isHeader = row.kind === "G";
              const isMapped = mappedCodes.has(row.code);
              const grabioLinks = grabioByPcg.get(row.code);
              const inLedger = ledgerByCode.has(row.code);
              const hasClient = pcgClientAccounts.some((c) => c.parentPcgCode === row.code);
              return (
                <ContextMenu key={row.code}>
                  <ContextMenuTrigger asChild disabled={isHeader || !onAddClientAccount}>
                    <TableRow
                      className={
                        isMapped
                          ? "bg-teal-50/70 dark:bg-teal-950/20"
                          : isHeader
                            ? "bg-slate-50/90 font-medium"
                            : undefined
                      }
                    >
                      <TableCell className="font-mono text-xs" style={{ paddingLeft: 8 + row.depth * 14 }}>
                        {row.code}
                        {grabioLinks?.length ? (
                          <div className="text-[10px] text-teal-700 dark:text-teal-300 font-sans">
                            → Grabio {grabioLinks.join(", ")}
                          </div>
                        ) : null}
                        {hasClient ? (
                          <div className="text-[10px] text-violet-700 dark:text-violet-300 font-sans">Client sub-account</div>
                        ) : null}
                      </TableCell>
                      <TableCell className={isHeader ? "text-red-700 dark:text-red-400" : undefined}>{row.name}</TableCell>
                      <TableCell dir="rtl" className="text-right text-sm">
                        {row.nameAr || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={kindVariant(row.kind)} className="text-[10px] px-1.5">
                          {kindLabel(row.kind)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.currency}</TableCell>
                      <TableCell>
                        {inLedger ? (
                          <Badge variant="outline" className="text-[10px]">
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {onAddClientAccount ? (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isHeader}
                            onClick={() => onAddClientAccount(row)}
                          >
                            Add here
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  </ContextMenuTrigger>
                  {!isHeader && onAddClientAccount ? (
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => onAddClientAccount(row)}>Add working account here</ContextMenuItem>
                    </ContextMenuContent>
                  ) : null}
                </ContextMenu>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {activeLedgerAccounts.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Right-click a detail row or use Add here for client working numbers. Auto-posting prefers PCG ledger accounts
          when seeded ({[...activeCodes].slice(0, 6).join(", ")}
          {activeCodes.size > 6 ? ", …" : ""} operational fallback).
        </p>
      ) : null}
    </div>
  );
}
