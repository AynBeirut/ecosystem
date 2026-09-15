import { useEffect, useMemo, useState } from 'react';
import { getFirestore } from 'firebase/firestore';
import AdminPanel from '@/components/admin/AdminPanel';
import ReportPeriodToolbar from '@/components/admin/ReportPeriodToolbar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { normalizeDateRange } from '@/lib/reportPeriodPresets';
import {
  loadOwnerPersonalWalletConfig,
  listOwnerWalletEntries,
  summarizeOwnerWallet,
  type OwnerWalletEntry,
  type OwnerWalletSource,
} from '@/lib/ownerPersonalWallet';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function kindLabel(kind: OwnerWalletSource['kind']) {
  if (kind === 'electrical') return 'Electrical';
  if (kind === 'yoga') return 'Yoga';
  return 'Dev / Grabio';
}

export default function OwnerPersonalWalletReport() {
  const { user } = useAuth();
  const storeId = getActualStoreId(user);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<OwnerWalletSource[]>([]);
  const [entries, setEntries] = useState<OwnerWalletEntry[]>([]);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    Promise.all([
      loadOwnerPersonalWalletConfig(getFirestore(), storeId),
      listOwnerWalletEntries(getFirestore(), storeId),
    ])
      .then(([config, ledger]) => {
        setSources(config.sources);
        setEntries(ledger);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  const period = useMemo(() => normalizeDateRange(startDate, endDate), [startDate, endDate]);
  const summary = useMemo(
    () => summarizeOwnerWallet(entries, sources, period.startDate, period.endDate),
    [entries, sources, period.startDate, period.endDate],
  );

  const incomeRows = useMemo(
    () =>
      entries.filter(
        (row) =>
          row.type === 'income' &&
          row.paymentDate >= period.startDate &&
          row.paymentDate <= period.endDate,
      ),
    [entries, period.startDate, period.endDate],
  );

  const feedRows = useMemo(
    () =>
      entries.filter(
        (row) =>
          row.type === 'company_feed' &&
          row.paymentDate >= period.startDate &&
          row.paymentDate <= period.endDate,
      ),
    [entries, period.startDate, period.endDate],
  );

  return (
    <AdminPanel>
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Personal wallet (owner)</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Your personal work cash (electrical, yoga, dev) lands here first. When the company needs money,
            Whish business spends are tracked as feeds from this wallet. Company books stay separate for now.
          </p>
        </div>

        <ReportPeriodToolbar
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading personal wallet…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-emerald-50/80 dark:bg-emerald-950/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Personal income in</p>
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{money(summary.incomeTotal)}</p>
              </div>
              <div className="rounded-lg border bg-amber-50/80 dark:bg-amber-950/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Fed to company</p>
                <p className="text-2xl font-semibold text-amber-700 dark:text-amber-300">{money(summary.companyFeedTotal)}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Wallet balance</p>
                <p className={`text-2xl font-semibold ${summary.balance < 0 ? 'text-red-600' : ''}`}>{money(summary.balance)}</p>
                <p className="text-xs text-muted-foreground mt-1">Income minus company feeds in period</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Personal income sources</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className={`rounded-lg border p-3 ${source.active ? '' : 'opacity-50 bg-muted/30'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{source.label}</p>
                      <Badge variant={source.active ? 'default' : 'secondary'}>{source.active ? kindLabel(source.kind) : 'Inactive'}</Badge>
                    </div>
                    <p className="text-xl font-semibold mt-1 tabular-nums">{money(summary.incomeBySource[source.id] || 0)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <h3 className="text-sm font-semibold p-3 pb-0">Monthly personal income</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    {sources.map((source) => (
                      <TableHead key={source.id} className="text-right">
                        {source.label.split(' ')[0]}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.incomeByMonth.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={sources.length + 2} className="text-center text-muted-foreground">
                        No personal income in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.incomeByMonth.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{row.label}</TableCell>
                        {sources.map((source) => (
                          <TableCell key={source.id} className="text-right tabular-nums">
                            {row.bySource[source.id] > 0 ? money(row.bySource[source.id]) : '—'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium tabular-nums">{money(row.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border overflow-x-auto max-h-[360px]">
                <h3 className="text-sm font-semibold p-3 pb-0">Income detail ({incomeRows.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.paymentDate}</TableCell>
                        <TableCell>{row.sourceLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border overflow-x-auto max-h-[360px]">
                <h3 className="text-sm font-semibold p-3 pb-0">Fed to company ({feedRows.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Expense</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.paymentDate}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={row.memo}>{row.memo || row.sourceLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminPanel>
  );
}
