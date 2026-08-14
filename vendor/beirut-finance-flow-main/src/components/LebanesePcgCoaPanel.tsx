import { useCallback, useMemo, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
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
import {
  buildPcgTree,
  collectPcgTreeNodeIds,
  filterPcgTree,
  pcgAddTargetFromNode,
  pcgClassSuffix,
  type PcgTreeNode,
} from "@/lib/ledger/lebanesePcgTree";
import { supportsArabicEntry, type AccountingLanguage } from "@/lib/grabio/accountingMode";
import type { JournalEntry, JournalLine, LedgerAccount, PcgClientAccount } from "@/types/generalLedger";
import PcgAccountMovementsSheet from "@/components/PcgAccountMovementsSheet";
import { cn } from "@/lib/utils";

type Props = {
  activeLedgerAccounts?: LedgerAccount[];
  pcgClientAccounts?: PcgClientAccount[];
  entries?: JournalEntry[];
  lines?: JournalLine[];
  asOfDate?: string;
  accountingLanguage?: AccountingLanguage;
  onAddClientAccount?: (account: LebanesePcgAccount) => void;
  previewMode?: boolean;
};

function PcgTreeNodeRow({
  node,
  depth,
  expanded,
  onToggle,
  onDrill,
  onAddClientAccount,
  showArabic,
}: {
  node: PcgTreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onDrill: () => void;
  onAddClientAccount?: (account: LebanesePcgAccount) => void;
  showArabic: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const suffix = pcgClassSuffix(node.code);
  const addTarget = pcgAddTargetFromNode(node);
  const canAdd = Boolean(onAddClientAccount && addTarget);

  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (addTarget) onAddClientAccount?.(addTarget);
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
              Client
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
    </div>
  );

  if (!canAdd) return row;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => addTarget && onAddClientAccount?.(addTarget)}>
          Add account here
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function PcgTreeBranch({
  nodes,
  depth,
  expandedIds,
  onToggle,
  onDrill,
  onAddClientAccount,
  showArabic,
}: {
  nodes: PcgTreeNode[];
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onDrill: (node: PcgTreeNode) => void;
  onAddClientAccount?: (account: LebanesePcgAccount) => void;
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
  previewMode = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [drillNode, setDrillNode] = useState<PcgTreeNode | null>(null);
  const showArabic = supportsArabicEntry(accountingLanguage);

  const fullTree = useMemo(
    () => buildPcgTree(LEBANESE_PCG_CHART, pcgClientAccounts),
    [pcgClientAccounts],
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

  const clientCount = pcgClientAccounts.length;

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
          {LEBANESE_PCG_CHART.length} PCG · {clientCount} client · click number to drill
        </span>
      </div>

      <div className="rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Chart of Accounts — expand a class, then click the account number for vouchers
        </div>
        <div className="max-h-[min(72vh,680px)] overflow-auto p-2 font-sans">
          {visibleTree.length ? (
            <PcgTreeBranch
              nodes={visibleTree}
              depth={0}
              expandedIds={effectiveExpanded}
              onToggle={toggleExpanded}
              onDrill={setDrillNode}
              onAddClientAccount={onAddClientAccount}
              showArabic={showArabic}
            />
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No accounts match your search.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Right-click a detail row to add a client working account under that PCG parent. Posting still uses linked Grabio
        operational accounts ({activeLedgerAccounts.filter((a) => a.isActive).length} active).
      </p>

      <PcgAccountMovementsSheet
        node={drillNode}
        open={Boolean(drillNode)}
        onOpenChange={(open) => !open && setDrillNode(null)}
        accounts={activeLedgerAccounts}
        entries={entries}
        lines={lines}
        asOfDate={asOfDate}
        pcgClientAccounts={pcgClientAccounts}
        accountingLanguage={accountingLanguage}
        isLebaneseCoa
      />
    </div>
  );
}
