import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import { buildYearEndClosePreview } from '@/lib/ledger/yearEndClose';
import type { JournalEntry, JournalLine, JournalLineInput, LedgerAccount } from '@/types/generalLedger';
import { formatCurrency } from '@/lib/utils';

type Props = {
  accounts: LedgerAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  systemGuideEnabled?: boolean;
  posting?: boolean;
  periodLocked?: boolean;
  onPost: (payload: { date: string; memo: string; lines: JournalLineInput[]; sourceId: string; event: string }) => void;
  onExportPack?: () => void;
};

export default function YearEndClosePanel({
  accounts,
  entries,
  lines,
  systemGuideEnabled = false,
  posting = false,
  periodLocked = false,
  onPost,
  onExportPack,
}: Props) {
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const preview = useMemo(
    () => buildYearEndClosePreview(accounts, entries, lines, endDate),
    [accounts, entries, lines, endDate],
  );

  const postClose = () => {
    if (!preview.canPost) return;
    onPost({
      date: endDate,
      memo: `Year-end close to ${preview.retainedEarningsCode}`,
      lines: preview.lines,
      sourceId: `year-end-close-${endDate.slice(0, 4)}`,
      event: 'year_end_close',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Year-end close
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="What year-end close does"
            title="Close to retained earnings"
            content={[
              'Zeroes revenue and expense accounts and transfers net income to retained earnings (304) — standard Libra/Odoo fiscal close.',
              'Run after P&L review. Period must be open for the close date.',
            ]}
          />
        </CardTitle>
        <CardDescription>Transfer P&L to retained earnings · idempotent per fiscal year</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground border rounded-md p-3">
          <li className={periodLocked ? 'text-amber-700' : 'text-green-700'}>
            Period lock check {periodLocked ? '— close period first or pick open date' : '— OK'}
          </li>
          <li>Run FX revaluation (FX Reval tab) for monetary AR/AP/bank balances</li>
          <li>Post year-end close JV below (P&amp;L → retained earnings)</li>
          <li>
            Export reporting pack (TB, P&amp;L, VAT){' '}
            {onExportPack ? (
              <Button type="button" variant="link" className="h-auto p-0" onClick={onExportPack}>
                Export CSV pack
              </Button>
            ) : null}
          </li>
        </ol>
        <div className="max-w-xs">
          <Label>Close as of</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Net income: <strong>{formatCurrency(preview.netIncome)}</strong></span>
          <span>Revenue accounts: <strong>{preview.revenueAccountsClosed}</strong></span>
          <span>Expense accounts: <strong>{preview.expenseAccountsClosed}</strong></span>
          <span>Target: <strong>{preview.retainedEarningsCode || '—'}</strong></span>
        </div>
        {!preview.canPost && preview.blockReason ? (
          <p className="text-sm text-muted-foreground">{preview.blockReason}</p>
        ) : null}
        <Button type="button" disabled={!preview.canPost || posting} onClick={postClose}>
          {posting ? 'Posting…' : 'Post year-end close JV'}
        </Button>
      </CardContent>
    </Card>
  );
}
