import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { JournalLineInput, VoucherType } from '@/types/generalLedger';
import { saveDraftJournalEntry, validateBalancedLines } from '@/lib/ledger/postingService';
import type { LedgerAccount } from '@/types/generalLedger';
import { downloadCsvText } from '@/lib/csvExport';

const SAMPLE_CSV = `date,memo,voucherType,accountCode,debit,credit,description
2026-07-30,Sample JV,JV,5300,100,0,Cash debit
2026-07-30,Sample JV,JV,4111,0,100,AR credit`;

type Props = {
  storeId: string;
  accountsById: Map<string, LedgerAccount>;
  createdBy?: string;
  onSaved?: () => void;
};

function parseCsvRows(csvText: string): string[][] {
  return csvText
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((c) => c.trim()));
}

function isHeaderRow(cells: string[]): boolean {
  const first = (cells[0] || '').toLowerCase();
  return first === 'date' || first.includes('account');
}

/** CSV columns: date,memo,voucherType,accountCode,debit,credit,description */
export default function BulkVoucherImportPanel({ storeId, accountsById, createdBy, onSaved }: Props) {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const parseAndImport = async () => {
    if (!storeId) {
      toast.error('Store not loaded.');
      return;
    }

    const parsed = parseCsvRows(csvText);
    if (!parsed.length) {
      toast.error('Paste at least one CSV row.');
      return;
    }

    const dataRows = isHeaderRow(parsed[0]) ? parsed.slice(1) : parsed;
    if (!dataRows.length) {
      toast.error('No data rows found after header.');
      return;
    }

    const groups = new Map<string, { date: string; memo: string; voucherType: VoucherType; lines: JournalLineInput[] }>();

    for (const cells of dataRows) {
      const [date, memo, voucherType, accountCode, debit, credit, description] = cells;
      if (!date || !accountCode) continue;

      const account = [...accountsById.values()].find((a) => a.code === accountCode || a.id === accountCode);

      if (!account) {
        toast.error(`Unknown account code: ${accountCode}. Use ledger account codes from COA.`);
        return;
      }

      const key = `${date}|${memo || 'Bulk import'}|${voucherType || 'JV'}`;
      const group = groups.get(key) || {
        date,
        memo: memo || 'Bulk import',
        voucherType: (voucherType as VoucherType) || 'JV',
        lines: [],
      };
      group.lines.push({
        accountId: account.id,
        debit: Number(debit) || 0,
        credit: Number(credit) || 0,
        description: description || undefined,
      });
      groups.set(key, group);
    }

    if (!groups.size) {
      toast.error('No valid rows — check date and accountCode columns.');
      return;
    }

    for (const group of groups.values()) {
      const check = validateBalancedLines(group.lines);
      if (!check.valid) {
        toast.error(`${group.memo} (${group.date}): ${check.message || 'Out of balance'}`);
        return;
      }
    }

    setImporting(true);
    try {
      let count = 0;
      for (const group of groups.values()) {
        await saveDraftJournalEntry(
          {
            storeId,
            date: new Date(group.date).toISOString(),
            memo: group.memo,
            sourceType: 'manual',
            event: 'bulk-import-draft',
            voucherType: group.voucherType,
            createdBy,
            lines: group.lines,
          },
          accountsById,
        );
        count += 1;
      }
      toast.success(`Imported ${count} draft voucher(s). Post from Vouchers → register.`);
      setCsvText('');
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk voucher import</CardTitle>
        <CardDescription>
          CSV columns: date, memo, voucherType, accountCode, debit, credit, description. Each balanced voucher group becomes a draft.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setCsvText(SAMPLE_CSV)}>
            Load sample
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadCsvText('voucher-import-template.csv', SAMPLE_CSV)}
          >
            Download template
          </Button>
        </div>
        <div>
          <Label htmlFor="bulk-voucher-csv">CSV data</Label>
          <Textarea
            id="bulk-voucher-csv"
            className="min-h-[140px] font-mono text-xs mt-1"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={SAMPLE_CSV.split('\n').join('\n')}
          />
        </div>
        <Button type="button" disabled={importing || !storeId} onClick={() => void parseAndImport()}>
          {importing ? 'Importing…' : 'Import as drafts'}
        </Button>
      </CardContent>
    </Card>
  );
}
