import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LEBANESE_PCG_CHART, type LebanesePcgAccount } from "@/lib/ledger/lebanesePcgChart.generated";
import { mergeLedgerPartyRowsIntoPcgClients } from "@/lib/ledger/partySubaccountLedger";
import {
  buildPcgTree,
  collectPcgTreeNodeIds,
  filterPcgTree,
  pcgAddTargetFromNode,
  pcgClassSuffix,
  pcgNodeCanEdit,
  type PcgTreeNode,
} from "@/lib/ledger/lebanesePcgTree";
import { supportsArabicEntry, type AccountingLanguage } from "@/lib/grabio/accountingMode";
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from "@/types/generalLedger";
import PcgAccountMovementsSheet from "@/components/PcgAccountMovementsSheet";
import { cn } from "@/lib/utils";

import type { OpenVoucherEntryHandler } from "@/lib/accounting/accountingNavigation";

type Props = {
  activeLedgerAccounts?: LedgerAccount[];
  pcgClientAccounts?: PcgClientAccount[];
  entries?: JournalEntry[];
  lines?: JournalLine[];
  asOfDate?: string;
  accountingLanguage?: AccountingLanguage;
  onAddClientAccount?: (account: LebanesePcgAccount) => void;
  onEditClientAccount?: (account: PcgClientAccount) => void;
  onEditPcgAccount?: (node: PcgTreeNode) => void;
  onOpenEntry?: OpenVoucherEntryHandler;
  previewMode?: boolean;
};

function PcgTreeNodeRow({
  node,
  depth,
  expanded,
  onToggle,
  onDrill,
  onAddClientAccount,
  onEditClientAccount,
  onEditPcgAccount,
  showArabic,
}: {
  node: PcgTreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onDrill: () => void;
  onAddClientAccount?: (account: LebanesePcgAccount) => void;
  onEditClientAccount?: (account: PcgClientAccount) => void;
  onEditPcgAccount?: (node: PcgTreeNode) => void;
  showArabic: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const suffix = pcgClassSuffix(node.code);
  const addTarget = pcgAddTargetFromNode(node);
  const canAdd = Boolean(onAddClientAccount && addTarget);
  const clientRow = node.kind === "client" ? node.clientAccount : undefined;
  const canEditClient = Boolean(onEditClientAccount && clientRow);
  const canEditPcg = Boolean(onEditPcgAccount && pcgNodeCanEdit(node));
  const canEdit = canEditClient || canEditPcg;

  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (addTarget) onAddClientAccount?.(addTarget);
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (clientRow) {
      onEditClientAccount?.(clientRow);
      return;
    }
    if (canEditPcg) onEditPcgAccount?.(node);
  };

  const row = (
    <div
      className={cn(
        "group flex min-h-[30px] items-start gap-1 rounded-sm px-1 py-0.5 hover:bg-muted/60",
        "border-l border-dotted border-border/70",
      )}
      style={{ marginLeft: depth * 18, paddingLeft: 8 }}
    >
      <button
        type="button"
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border bg-background text-muted-foreground",
          !hasChildren && "invisible",
        )}
        aria-label={expanded ? "Collapse" : "Expand"}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      </button>

      <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-sky-500/70 dark:bg-sky-400/70" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <button
            type="button"
            className="font-mono text-sm font-semibold tabular-nums text-primary underline-offset-2 hover:underline"
            onClick={onDrill}
          >
            {node.code}
          </button>
          <span className={cn("text-sm", node.pcgKind === "G" ? "font-semibold text-foreground" : "text-foreground/90")}>
            {node.name}
          </span>
          {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
          {node.kind === "client" ? (
            <Badge variant="outline" className="text-[10px] px-1.5">
              {node.clientAccount?.partyType === "supplier"
                ? "Supplier"
                : node.clientAccount?.partyType === "employee"
                  ? "Employee"
                : node.clientAccount?.partyType === "client"
                  ? "Client"
                  : "Working"}
            </Badge>
          ) : null}
        </div>
        {showArabic && node.nameAr ? (
          <div className="text-right text-xs text-muted-foreground" dir="rtl">
            {node.nameAr}
          </div>
        ) : null}
      </div>
      {canAdd ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs opacity-70 group-hover:opacity-100"
          onClick={handleAdd}
        >
          Add
        </Button>
      ) : null}
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs opacity-70 group-hover:opacity-100"
          onClick={handleEdit}
        >
          <Pencil className="mr-1 inline h-3 w-3" />
          Edit
        </Button>
      ) : null}
    </div>
  );

  if (canEdit || canAdd) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>
          {canEditClient && clientRow ? (
            <ContextMenuItem onClick={() => onEditClientAccount?.(clientRow)}>Edit working account</ContextMenuItem>
          ) : null}
          {canEditPcg ? (
            <ContextMenuItem onClick={() => onEditPcgAccount?.(node)}>Edit account</ContextMenuItem>
          ) : null}
          {canAdd ? (
            <ContextMenuItem onClick={() => addTarget && onAddClientAccount?.(addTarget)}>
              Add account here
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return row;
}

function PcgTreeBranch({
  nodes,
  depth,
  expandedIds,
  onToggle,
  onDrill,
  onAddClientAccount,
  onEditClientAccount,
  onEditPcgAccount,
  showArabic,
}: {
  nodes: PcgTreeNode[];
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onDrill: (node: PcgTreeNode) => void;
  onAddClientAccount?: (account: LebanesePcgAccount) => void;
  onEditClientAccount?: (account: PcgClientAccount) => void;
  onEditPcgAccount?: (node: PcgTreeNode) => void;
  showArabic: boolean;
}) {
  return (
    <>
      {nodes.map((node) => {
        const expanded = expandedIds.has(node.id);
        return (
          <div key={node.id}>
            <PcgTreeNodeRow
              node={node}
              depth={depth}
              expanded={expanded}
              onToggle={() => onToggle(node.id)}
              onDrill={() => onDrill(node)}
              onAddClientAccount={onAddClientAccount}
              onEditClientAccount={onEditClientAccount}
              onEditPcgAccount={onEditPcgAccount}
              showArabic={showArabic}
            />
            {expanded && node.children.length ? (
              <PcgTreeBranch
                nodes={node.children}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onDrill={onDrill}
                onAddClientAccount={onAddClientAccount}
                onEditClientAccount={onEditClientAccount}
                onEditPcgAccount={onEditPcgAccount}
                showArabic={showArabic}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export default function LebanesePcgCoaPanel({
  activeLedgerAccounts = [],
  pcgClientAccounts = [],
  entries = [],
  lines = [],
  asOfDate = new Date().toISOString().slice(0, 10),
  accountingLanguage,
  onAddClientAccount,
  onEditClientAccount,
  onEditPcgAccount,
  onOpenEntry,
  previewMode = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [drillNode, setDrillNode] = useState<PcgTreeNode | null>(null);
  const showArabic = supportsArabicEntry(accountingLanguage);

  const mergedClientAccounts = useMemo(
    () => mergeLedgerPartyRowsIntoPcgClients(activeLedgerAccounts, pcgClientAccounts),
    [activeLedgerAccounts, pcgClientAccounts],
  );

  const partyRows = useMemo(
    () => mergedClientAccounts.filter((row) => row.partyType && row.partyId),
    [mergedClientAccounts],
  );

  useEffect(() => {
    if (!partyRows.length) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add("class:6");
      next.add("class:7");
      next.add("class:4");
      next.add("pcg:7010");
      next.add("pcg:6111");
      next.add("pcg:4281");
      return next;
    });
  }, [partyRows.length]);

  const fullTree = useMemo(
    () => buildPcgTree(LEBANESE_PCG_CHART, mergedClientAccounts),
    [mergedClientAccounts],
  );

  const visibleTree = useMemo(() => filterPcgTree(fullTree, query), [fullTree, query]);

  const searchExpandedIds = useMemo(() => {
    if (!query.trim()) return null;
    return collectPcgTreeNodeIds(visibleTree);
  }, [visibleTree, query]);

  const effectiveExpanded = searchExpandedIds ?? expandedIds;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clientCount = mergedClientAccounts.length;
  const clientParties = partyRows.filter((row) => row.partyType === 'client');
  const supplierParties = partyRows.filter((row) => row.partyType === 'supplier');
  const employeeParties = partyRows.filter((row) => row.partyType === 'employee');

  return (
    <div className="space-y-3">
      {previewMode ? (
        <Alert>
          <AlertTitle>Preview — accountant tree layout</AlertTitle>
          <AlertDescription>
            Classic PCG navigation: expand classes, click an account number to open voucher movements. Balances appear
            only in the drawer. Feedback welcome before we retire the old table view.
          </AlertDescription>
        </Alert>
      ) : null}

      {partyRows.length ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold">
            Party subaccounts — {clientParties.length} clients · {supplierParties.length} suppliers
            {employeeParties.length ? ` · ${employeeParties.length} employee lines` : ''}
          </p>
          <p className="mt-1">
            In the tree: expand <strong>7 → 7010</strong> for sales clients, <strong>6 → 6111</strong> for suppliers
            {employeeParties.length ? (
              <>, and <strong>4 → 4281</strong> for payroll employee accounts (pay, transport, bonus, …).</>
            ) : (
              <>.</>
            )}
          </p>
        </div>
      ) : (
        <Alert>
          <AlertTitle>No party subaccounts yet</AlertTitle>
          <AlertDescription>
            Create clients and suppliers in CRM — each gets a numbered account under sales (7010…) or purchases (6111…).
            Refresh ledger after adding parties.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search code, English, or Arabic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {LEBANESE_PCG_CHART.length} PCG · {clientCount} working · {partyRows.length} party · click number to drill
        </span>
      </div>

      <div className="legacy-erp-shell overflow-hidden">
        <div className="legacy-erp-toolbar text-xs font-semibold normal-case tracking-normal">
          Chart of Accounts — expand a class, then click the account number for vouchers
        </div>
        <div className="legacy-erp-body max-h-[min(72vh,680px)] overflow-auto p-2 font-sans">
          {visibleTree.length ? (
            <PcgTreeBranch
              nodes={visibleTree}
              depth={0}
              expandedIds={effectiveExpanded}
              onToggle={toggleExpanded}
              onDrill={setDrillNode}
              onAddClientAccount={onAddClientAccount}
              onEditClientAccount={onEditClientAccount}
              onEditPcgAccount={onEditPcgAccount}
              showArabic={showArabic}
            />
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No accounts match your search.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        PCG and working accounts: click <strong>Edit</strong> (or right-click) to change labels. Click the account
        code for voucher movements ({activeLedgerAccounts.filter((a) => a.isActive).length} active accounts).
      </p>

      <PcgAccountMovementsSheet
        node={drillNode}
        open={Boolean(drillNode)}
        onOpenChange={(open) => !open && setDrillNode(null)}
        accounts={activeLedgerAccounts}
        entries={entries}
        lines={lines}
        asOfDate={asOfDate}
        pcgClientAccounts={mergedClientAccounts}
        accountingLanguage={accountingLanguage}
        isLebaneseCoa
        onOpenEntry={onOpenEntry}
      />
    </div>
  );
}
