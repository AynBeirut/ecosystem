import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SystemGuideInfo from '@/components/SystemGuideInfo';
import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import {
  computeNextRunDate,
  deleteRecurringVoucherTemplate,
  loadRecurringVoucherTemplates,
  saveRecurringVoucherTemplate,
} from '@/lib/firestore/recurringVouchersFirestore';
import type {
  JournalLineInput,
  LedgerAccount,
  PcgClientAccount,
  RecurringVoucherFrequency,
  RecurringVoucherTemplate,
  VoucherType,
} from '@/types/generalLedger';
import { type AccountingLanguage } from '@/lib/grabio/accountingMode';

type Props = {
  storeId: string;
  accounts: LedgerAccount[];
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  systemGuideEnabled?: boolean;
  onPostTemplate: (payload: {
    voucherType: VoucherType;
    date: string;
    memo: string;
    lines: JournalLineInput[];
  }) => Promise<void>;
};

export default function RecurringVouchersPanel({
  storeId,
  accounts,
  isLebaneseCoa,
  pcgClientAccounts = [],
  accountingLanguage,
  systemGuideEnabled = false,
  onPostTemplate,
}: Props) {
  const [templates, setTemplates] = useState<RecurringVoucherTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [frequency, setFrequency] = useState<RecurringVoucherFrequency>('monthly');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState('');

  const reload = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      setTemplates(await loadRecurringVoucherTemplates(storeId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const addTemplate = async () => {
    const amt = Number(amount) || 0;
    if (!storeId || !name.trim() || !debitAccountId || !creditAccountId || amt <= 0) {
      toast.error('Name, accounts, and amount are required.');
      return;
    }
    setSaving(true);
    try {
      await saveRecurringVoucherTemplate(storeId, {
        name: name.trim(),
        voucherType: 'JV',
        frequency,
        dayOfMonth: new Date().getDate(),
        nextRunDate: today,
        memo: memo.trim() || name.trim(),
        lines: [
          { accountId: debitAccountId, debit: amt, credit: 0 },
          { accountId: creditAccountId, debit: 0, credit: amt },
        ],
        isActive: true,
      });
      setName('');
      setMemo('');
      setAmount('');
      toast.success('Template saved');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const runTemplate = async (template: RecurringVoucherTemplate) => {
    setRunningId(template.id);
    try {
      await onPostTemplate({
        voucherType: template.voucherType,
        date: template.nextRunDate || today,
        memo: template.memo || template.name,
        lines: template.lines,
      });
      await saveRecurringVoucherTemplate(storeId, {
        ...template,
        lastRunDate: today,
        nextRunDate: computeNextRunDate(template.frequency, template.nextRunDate || today),
      });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunningId('');
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRecurringVoucherTemplate(storeId, id);
      toast.success('Deleted');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Recurring vouchers
          <SystemGuideInfo
            enabled={systemGuideEnabled}
            label="What recurring vouchers are"
            title="Automated JVs"
            content={[
              'Templates for rent, payroll accruals, loan interest — run manually or on schedule (Libra écritures récurrentes).',
              'Save a balanced JV template, then Run now to post and advance the next run date.',
            ]}
          />
        </CardTitle>
        <CardDescription>Journal voucher templates · manual run (scheduler = Phase 2)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 max-w-3xl">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office rent" />
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringVoucherFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Memo</Label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <div>
            <Label>Debit account</Label>
            <LedgerAccountCombobox
              accounts={accounts}
              value={debitAccountId}
              onValueChange={setDebitAccountId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
            />
          </div>
          <div>
            <Label>Credit account</Label>
            <LedgerAccountCombobox
              accounts={accounts}
              value={creditAccountId}
              onValueChange={setCreditAccountId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
            />
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void addTemplate()} disabled={saving || !storeId}>
              <Plus className="h-4 w-4 mr-1" /> Save template
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="capitalize">{t.frequency}</TableCell>
                <TableCell>{t.nextRunDate}</TableCell>
                <TableCell>
                  <Badge variant={t.isActive ? 'default' : 'secondary'}>{t.isActive ? 'Active' : 'Off'}</Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={runningId === t.id}
                    onClick={() => void runTemplate(t)}
                  >
                    <Play className="h-3 w-3 mr-1" /> Run
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void remove(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">No templates yet.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
