import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import ReconciliationVarianceSheet from '@/components/ReconciliationVarianceSheet';
import { formatCurrency } from '@/lib/utils';
import {
  buildReconciliationReport,
  reconciliationToCsv,
  type ReconciliationGroup,
  type ReconciliationRow,
  type ReconciliationSubledgerInput,
} from '@/lib/ledger/reconciliation';
import {
  clearExternalReconciliationImport,
  externalBalanceMap,
  loadExternalReconciliationImports,
  parseExternalReconciliationCsv,
  saveExternalReconciliationImport,
} from '@/lib/ledger/reconciliationExternal';
import { buildVarianceDetail } from '@/lib/ledger/reconciliationVarianceDetail';
import type {
  AgedPayablesReport,
  AgedReceivablesReport,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';

const GROUP_LABELS: Record<ReconciliationGroup, string> = {
  cash: 'Cash',
  bank: 'Bank accounts',
  online: 'Online payment',
  clients: 'Clients (AR)',
  suppliers: 'Suppliers (AP)',
};

type Props = {
  storeId: string;
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  asOfDate: string;
  subledger: ReconciliationSubledgerInput;
  isLebaneseCoa?: boolean;
  arAging: AgedReceivablesReport;
  apAging: AgedPayablesReport;
  onRefresh: () => void | Promise<void>;
  loading?: boolean;
  systemGuideEnabled?: boolean;
};

export default function ReconciliationPanel({
  storeId,
  accounts,
  entries,
  lines,
  asOfDate,
  subledger,
  isLebaneseCoa,
  arAging,
  apAging,
  onRefresh,
  loading,
  systemGuideEnabled,
}: Props) {
  const [externalImports, setExternalImports] = useState(() => loadExternalReconciliationImports(storeId));
  const [selectedRow, setSelectedRow] = useState<ReconciliationRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importAccountRef = useRef<{ accountId: string; accountCode: string } | null>(null);

  useEffect(() => {
    setExternalImports(loadExternalReconciliationImports(storeId));
  }, [storeId]);

  const externalByAccountId = useMemo(() => externalBalanceMap(externalImports), [externalImports]);

  const report = useMemo(
    () =>
      buildReconciliationReport(accounts, entries, lines, asOfDate, subledger, {
        lebaneseCoa: isLebaneseCoa,
        externalByAccountId,
      }),
    [accounts, entries, lines, asOfDate, subledger, isLebaneseCoa, externalByAccountId],
  );

  const groups: ReconciliationGroup[] = ['cash', 'bank', 'online', 'clients', 'suppliers'];

  const varianceDetail = useMemo(() => {
    if (!selectedRow) return null;
    return buildVarianceDetail({
      row: selectedRow,
      accounts,
      entries,
      lines,
      asOfDate,
      arAging,
      apAging,
      externalImport: selectedRow.accountId ? externalImports[selectedRow.accountId] : undefined,
    });
  }, [selectedRow, accounts, entries, lines, asOfDate, arAging, apAging, externalImports]);

  const openRowDetail = (row: ReconciliationRow) => {
    if (row.isPartyDetail) return;
    setSelectedRow(row);
    setSheetOpen(true);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      setExternalImports(loadExternalReconciliationImports(storeId));
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, storeId]);

  const triggerImport = (row: ReconciliationRow) => {
    if (!row.accountId) return;
    importAccountRef.current = { accountId: row.accountId, accountCode: row.accountCode || '' };
    fileInputRef.current?.click();
  };

  const onFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const target = importAccountRef.current;
    if (!file || !target || !storeId) return;

    try {
      const text = await file.text();
      const parsed = parseExternalReconciliationCsv(text);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      if (parsed.warnings.length) {
        toast.message(`Imported with ${parsed.warnings.length} warning(s)`);
      }
      const next = saveExternalReconciliationImport(storeId, {
        accountId: target.accountId,
        accountCode: target.accountCode,
        balance: parsed.balance,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        lines: parsed.lines,
        source: parsed.source,
      });
      setExternalImports(next);
      toast.success(`External balance ${formatCurrency(parsed.balance)} imported for ${target.accountCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const clearImport = (accountId: string) => {
    const next = clearExternalReconciliationImport(storeId, accountId);
    setExternalImports(next);
    toast.success('External import cleared');
  };

  const downloadCsv = () => {
    const blob = new Blob([reconciliationToCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${report.asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFilePicked}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                Account reconciliation
                <SystemGuideInfo
                  enabled={systemGuideEnabled}
                  label="What reconciliation checks"
                  title="Account reconciliation"
                  content={[
                    'Compares GL to subledgers or imported external CSV balances per bank/cash/online account.',
                    'Click a variance row for GL vs subledger line detail. After fixes, Refresh recalculates.',
                  ]}
                />
              </CardTitle>
              <CardDescription>
                As of {report.asOfDate} — import CSV for external accounts; click variance rows for detail.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={loading || refreshing} onClick={() => void handleRefresh()}>
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing || loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={downloadCsv}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {groups.map((group) => {
            const groupRows = report.rows.filter((r) => r.group === group);
            if (groupRows.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="text-sm font-semibold mb-2">{GROUP_LABELS[group]}</h3>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">GL</TableHead>
                        <TableHead className="text-right">Subledger</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupRows.map((r) => (
                        <TableRow
                          key={r.rowKey}
                          className={[
                            r.isPartyDetail ? 'bg-muted/30' : r.isTotal ? 'bg-muted/50 font-medium' : '',
                            !r.isPartyDetail && !r.matched ? 'cursor-pointer hover:bg-red-50/50' : '',
                            !r.isPartyDetail && r.matched ? 'cursor-pointer hover:bg-muted/40' : '',
                          ].join(' ')}
                          onClick={() => openRowDetail(r)}
                        >
                          <TableCell className={r.isPartyDetail ? 'pl-8 text-sm' : ''}>
                            {r.isPartyDetail ? `↳ ${r.label}` : r.label}
                            {r.externalImported && (
                              <Badge variant="outline" className="ml-2 text-xs">External CSV</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.isPartyDetail ? '—' : formatCurrency(r.glAmount)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(r.subledgerAmount)}</TableCell>
                          <TableCell className="text-right">
                            {r.isPartyDetail ? '—' : formatCurrency(r.variance)}
                          </TableCell>
                          <TableCell>
                            {r.isPartyDetail ? (
                              <Badge variant="outline" className="text-muted-foreground">Detail</Badge>
                            ) : r.matched ? (
                              <Badge variant="outline" className="text-green-700">Matched</Badge>
                            ) : (
                              <Badge variant="destructive">Variance</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {r.supportsExternalImport && r.accountId && (
                              <div className="flex justify-end gap-1">
                                <Button type="button" size="sm" variant="ghost" onClick={() => triggerImport(r)}>
                                  <Upload className="h-3.5 w-3.5 mr-1" /> CSV
                                </Button>
                                {r.externalImported && (
                                  <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => clearImport(r.accountId!)}>
                                    Clear
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {report.allMatched
              ? 'All control accounts match. Click a row to inspect lines.'
              : 'Click variance rows for GL vs subledger detail. Import external CSV for outside bank/wallet accounts, then Refresh.'}
          </p>
        </CardContent>
      </Card>

      <ReconciliationVarianceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detail={varianceDetail}
        onRefresh={handleRefresh}
        refreshing={refreshing || loading}
      />
    </>
  );
}
