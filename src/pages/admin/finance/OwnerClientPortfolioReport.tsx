import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore } from 'firebase/firestore';
import { Briefcase, ExternalLink } from 'lucide-react';
import AdminPanel from '@/components/admin/AdminPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  buildOwnerClientPortfolioMetrics,
  formatContractAmount,
  getOwnerClientPortfolioCatalog,
  listPortfolioReceipts,
  summarizeOwnerClientPortfolio,
  type OwnerClientPortfolioMetrics,
  type OwnerClientReceiptRow,
} from '@/lib/ownerClientPortfolio';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function OwnerClientPortfolioReport() {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OwnerClientPortfolioMetrics[]>([]);
  const [receipts, setReceipts] = useState<OwnerClientReceiptRow[]>([]);

  const monthKey = currentMonthKey();
  const yearKey = monthKey.slice(0, 4);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const catalog = getOwnerClientPortfolioCatalog(storeId);
    void listPortfolioReceipts(getFirestore(), storeId, catalog)
      .then((rows) => {
        setReceipts(rows);
        setMetrics(buildOwnerClientPortfolioMetrics(catalog, rows, monthKey, yearKey));
      })
      .finally(() => setLoading(false));
  }, [storeId, monthKey, yearKey]);

  const summary = useMemo(() => summarizeOwnerClientPortfolio(metrics), [metrics]);

  return (
    <AdminPanel>
      <div className="p-4 space-y-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-market-primary" />
            Client portfolio
          </h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Your Grabio and agency clients — contract terms below. Cash received is pulled from posted receipt
            vouchers only (Whish / manual RVs).
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading clients…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active clients</p>
                <p className="text-2xl font-semibold">{summary.clientCount}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recurring (contract / mo)</p>
                <p className="text-2xl font-semibold tabular-nums">{money(summary.contractMonthlyUsd)}</p>
              </div>
              <div className="rounded-lg border bg-emerald-50/80 dark:bg-emerald-950/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Received this month</p>
                <p className="text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {summary.receivedMonthUsd > 0 ? money(summary.receivedMonthUsd) : 'not measured'}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Received YTD {yearKey}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {summary.receivedYtdUsd > 0 ? money(summary.receivedYtdUsd) : 'not measured'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {metrics.map((row) => (
                <div key={row.entry.id} className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-base">{row.entry.clientName}</h3>
                        {row.entry.contactName ? (
                          <span className="text-sm text-muted-foreground">· {row.entry.contactName}</span>
                        ) : null}
                        <Badge variant={row.entry.billingModel === 'project' ? 'secondary' : 'default'}>
                          {row.entry.billingModel === 'project' ? 'Project-based' : 'Recurring'}
                        </Badge>
                      </div>
                      {row.entry.grabioAccount ? (
                        <p className="text-sm text-muted-foreground mt-1">{row.entry.grabioAccount}</p>
                      ) : null}
                      {row.entry.billingNote ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{row.entry.billingNote}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Payment</p>
                      <p className="font-medium">{row.entry.paymentMethod}</p>
                      {row.entry.financeClientIds?.[0] ? (
                        <Button asChild variant="link" size="sm" className="h-auto p-0 mt-1">
                          <Link
                            to={`/admin/customers/${row.entry.financeClientIds[0]}/statement?type=customer&name=${encodeURIComponent(row.entry.contactName || row.entry.clientName)}`}
                          >
                            Statement <ExternalLink className="h-3 w-3 ml-1 inline" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="px-4 py-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Contract</TableHead>
                          <TableHead className="hidden sm:table-cell">Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {row.entry.contracts.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.label}</TableCell>
                            <TableCell className="font-medium tabular-nums">{formatContractAmount(line)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                              {line.note || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="rounded-lg border bg-muted/20 p-3 min-w-[200px] space-y-2 text-sm">
                      {row.expectedMonthlyUsd != null ? (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Expected / mo</span>
                          <span className="font-semibold tabular-nums">{money(row.expectedMonthlyUsd)}</span>
                        </div>
                      ) : null}
                      {row.expectedYearlyUsd != null && row.entry.billingModel === 'recurring' ? (
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Expected / yr</span>
                          <span className="font-semibold tabular-nums">{money(row.expectedYearlyUsd)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">This month</span>
                        <span className="font-semibold tabular-nums">
                          {row.receivedMonthUsd > 0 ? money(row.receivedMonthUsd) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">YTD {yearKey}</span>
                        <span className="font-semibold tabular-nums">
                          {row.receivedYtdUsd > 0 ? money(row.receivedYtdUsd) : '—'}
                        </span>
                      </div>
                      {row.lastPaymentDate ? (
                        <p className="text-xs text-muted-foreground pt-1 border-t">
                          Last payment {row.lastPaymentDate}
                        </p>
                      ) : row.entry.financeClientIds?.length ? (
                        <p className="text-xs text-muted-foreground pt-1 border-t">No RV linked yet</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {receipts.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold mb-2">Linked receipts ({receipts.length})</h3>
                <div className="rounded-lg border overflow-x-auto max-h-[360px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Voucher</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.paymentDate}</TableCell>
                          <TableCell>{r.clientName}</TableCell>
                          <TableCell>{r.voucherNumber}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AdminPanel>
  );
}
