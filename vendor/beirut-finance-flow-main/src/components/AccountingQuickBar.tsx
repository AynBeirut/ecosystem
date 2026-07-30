import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Scale,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  Landmark,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import SystemGuideInfo from "@/components/SystemGuideInfo";

type QuickBarTotals = {
  cashOnHand: number;
  bankBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
};

type Props = {
  totals: QuickBarTotals;
  balanced: boolean;
  asOfDate: string;
  loading?: boolean;
  systemGuideEnabled?: boolean;
  onNavigate: (tab: string) => void;
  onOpenSearch: () => void;
};

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  onClick?: () => void;
};

function StatCard({ label, value, icon: Icon, tone, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`finance-accounting-stat text-left rounded-xl border bg-card p-3 transition-colors ${
        onClick ? "hover:bg-muted/60 cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{value}</p>
        </div>
        <span className={`finance-accounting-stat__icon finance-accounting-stat__icon--${tone}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </button>
  );
}

export default function AccountingQuickBar({
  totals,
  balanced,
  asOfDate,
  loading,
  systemGuideEnabled = false,
  onNavigate,
  onOpenSearch,
}: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">At a glance</span>
            <SystemGuideInfo
              enabled={systemGuideEnabled}
              label="What At a glance shows"
              title="Accounting dashboard"
              content={[
                "These cards summarize cash, bank, receivables, payables, and whether the books balance as of the date above.",
                "Click a card to jump to the related report. Use Search (Ctrl+K) to find accounts or vouchers quickly.",
              ]}
            />
            <span className="text-xs text-muted-foreground">as of {asOfDate}</span>
            {loading ? (
              <Badge variant="secondary">Loading…</Badge>
            ) : balanced ? (
              <Badge className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Books balanced
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Out of balance
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onOpenSearch}>
              <Search className="h-4 w-4 mr-1" />
              Search
              <kbd className="ml-2 hidden sm:inline rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Ctrl K
              </kbd>
            </Button>
            <Button size="sm" onClick={() => onNavigate("vouchers")}>
              <FileText className="h-4 w-4 mr-1" />
              New voucher
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onNavigate("trial-balance")}>
              <Scale className="h-4 w-4 mr-1" />
              Trial balance
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="Cash on hand"
            value={formatCurrency(totals.cashOnHand)}
            icon={Wallet}
            tone="emerald"
            onClick={() => onNavigate("reconciliation")}
          />
          <StatCard
            label="Bank"
            value={formatCurrency(totals.bankBalance)}
            icon={Landmark}
            tone="cyan"
            onClick={() => onNavigate("bank-rec")}
          />
          <StatCard
            label="Receivables"
            value={formatCurrency(totals.accountsReceivable)}
            icon={TrendingUp}
            tone="blue"
            onClick={() => onNavigate("ar-aging")}
          />
          <StatCard
            label="Payables"
            value={formatCurrency(totals.accountsPayable)}
            icon={TrendingDown}
            tone="orange"
            onClick={() => onNavigate("ap-aging")}
          />
          <StatCard
            label="Books"
            value={balanced ? "Balanced" : "Review TB"}
            icon={Scale}
            tone={balanced ? "indigo" : "rose"}
            onClick={() => onNavigate("trial-balance")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
