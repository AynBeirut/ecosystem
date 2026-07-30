import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import { buildFxRevaluationPreview } from '@/lib/ledger/fxRevaluation';
import type { JournalEntry, JournalLine, JournalLineInput, LedgerAccount } from '@/types/generalLedger';
import { formatCurrency } from '@/lib/utils';

type Props = {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  asOfDate: string;
  mainCurrency?: string;
  defaultPreviousRate?: number;
  systemGuideEnabled?: boolean;
  posting?: boolean;
  onPost: (payload: { date: string; memo: string; lines: JournalLineInput[]; sourceId: string; event: string }) => void;
};

export default function FxRevaluationPanel({
  accounts,
  entries,
  lines,
  asOfDate,
  mainCurrency,
  defaultPreviousRate,
  systemGuideEnabled = false,
  posting = false,
  onPost,
}: Props) {
  const [previousRate, setPreviousRate] = useState(String(defaultPreviousRate || 89500));
  const [newRate, setNewRate] = useState(String(defaultPreviousRate || 89500));
  const [runDate, setRunDate] = useState(asOfDate.slice(0, 10));

  const preview = useMemo(
    () =>
      buildFxRevaluationPreview(accounts, entries, lines, {
        asOfDate: runDate,
        previousRate: Number(previousRate) || 0,
        newRate: Number(newRate) || 0,
        mainCurrency,
      }),
    [accounts, entries, lines, runDate, previousRate, newRate, mainCurrency],
  );

  const postReval = () => {
    if (!preview.canPost) return;
    onPost({
      date: runDate,
      memo: `FX revaluation ${preview.previousRate} → ${preview.newRate}`,
      lines: preview.journalLines,
      sourceId: `fx-reval-${runDate.slice(0, 7)}`,
      event: 'fx_revaluation',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          FX revaluation
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="What FX reval does"
            title="Month-end FX"
            content={[
              'Revalues foreign-currency bank balances at a new rate vs the prior book rate.',
              'Posts gain to 7751 or loss to 6751 (Lebanese PCG). Uses store exchange rate from Admin Profile as default.',
            ]}
          />
        </CardTitle>
        <CardDescription>
          Functional: {preview.mainCurrency} · Foreign: {preview.foreignCurrency}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label>As of</Label>
            <Input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label>Previous rate</Label>
            <Input value={previousRate} onChange={(e) => setPreviousRate(e.target.value)} className="w-[140px]" />
          </div>
          <div>
            <Label>New rate</Label>
            <Input value={newRate} onChange={(e) => setNewRate(e.target.value)} className="w-[140px]" />
          </div>
        </div>
        {preview.lines.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Foreign bal.</TableHead>
                <TableHead className="text-right">Adjustment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.lines.map((row) => (
                <TableRow key={row.accountId}>
                  <TableCell>{row.accountCode} · {row.accountName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.foreignBalance)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.adjustment)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{preview.blockReason || 'No balances to revalue.'}</p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm">Total adjustment: <strong>{formatCurrency(preview.totalAdjustment)}</strong></span>
          <Button type="button" disabled={!preview.canPost || posting} onClick={postReval}>
            {posting ? 'Posting…' : 'Post FX revaluation JV'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
