import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import { buildVatTransferPreview } from '@/lib/ledger/vatTransferEntries';
import type { VatFilingSummary } from '@/lib/ledger/vatFilingSummary';
import type { JournalLineInput, LedgerAccount } from '@/types/generalLedger';
import { formatCurrency } from '@/lib/utils';

type Props = {
  accounts: LedgerAccount[];
  filing: VatFilingSummary;
  systemGuideEnabled?: boolean;
  posting?: boolean;
  onPost: (payload: { date: string; memo: string; lines: JournalLineInput[] }) => void;
};

export default function VatTransferPanel({
  accounts,
  filing,
  systemGuideEnabled = false,
  posting = false,
  onPost,
}: Props) {
  const preview = useMemo(() => buildVatTransferPreview(accounts, filing), [accounts, filing]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Generate VAT transfer entries
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="Matrix GL160P"
            title="VAT transfer to GL"
            content={[
              'Posts a balancing JV from output VAT (220) and input VAT (140) for the filing period.',
              'Run after VAT figures are reviewed — same intent as Matrix Generate VAT Trsf. Entries.',
            ]}
          />
        </CardTitle>
        <CardDescription>
          Period {filing.startDate} → {filing.endDate} · Net {filing.netVatDueLabel}{' '}
          {formatCurrency(Math.abs(filing.netVatDue))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!preview.canPost ? (
          <p className="text-sm text-muted-foreground">{preview.blockReason || 'Nothing to post.'}</p>
        ) : (
          <ul className="text-sm space-y-1">
            {preview.lines.map((line, idx) => {
              const acct = accounts.find((row) => row.id === line.accountId);
              return (
                <li key={idx}>
                  {acct?.code} {acct?.name}: Dr {formatCurrency(line.debit)} Cr {formatCurrency(line.credit)}
                </li>
              );
            })}
          </ul>
        )}
        <Button
          type="button"
          disabled={!preview.canPost || posting}
          onClick={() =>
            onPost({
              date: filing.endDate,
              memo: preview.memo,
              lines: preview.lines,
            })
          }
        >
          {posting ? 'Posting…' : 'Post VAT transfer JV'}
        </Button>
      </CardContent>
    </Card>
  );
}
