import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LedgerAccountCombobox } from '@/components/LedgerAccountCombobox';
import { createLedgerAccount } from '@/lib/firestore/ledgerFirestore';
import { inferSiblingSuffixDigits, nextSiblingAccountCode } from '@/lib/ledger/nextSiblingAccountCode';
import type { AccountingLanguage } from '@/lib/grabio/accountingMode';
import type { LedgerAccount, LedgerAccountType, PcgClientAccount } from '@/types/generalLedger';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  accounts: LedgerAccount[];
  isLebaneseCoa?: boolean;
  pcgClientAccounts?: PcgClientAccount[];
  accountingLanguage?: AccountingLanguage;
  onCreated?: () => Promise<void> | void;
};

const TYPES: LedgerAccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export default function AddLedgerAccountDialog({
  open,
  onOpenChange,
  storeId,
  accounts,
  isLebaneseCoa,
  pcgClientAccounts,
  accountingLanguage,
  onCreated,
}: Props) {
  const parents = useMemo(
    () =>
      accounts
        .filter((account) => account.isActive)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts],
  );
  const [parentId, setParentId] = useState('');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [type, setType] = useState<LedgerAccountType>('asset');
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const parent = parents.find((account) => account.id === parentId);

  const autoCode = useMemo(() => {
    if (!parent) return '';
    try {
      const digits = isLebaneseCoa ? 4 : inferSiblingSuffixDigits(parent.code, accounts.map((a) => a.code), 2);
      return nextSiblingAccountCode(parent.code, accounts.map((a) => a.code), digits);
    } catch {
      return '';
    }
  }, [parent, accounts, isLebaneseCoa]);

  useEffect(() => {
    if (!open) return;
    setParentId('');
    setName('');
    setNameAr('');
    setType('asset');
    setManual(!isLebaneseCoa);
    setCode('');
    setSaving(false);
  }, [open, isLebaneseCoa]);

  useEffect(() => {
    if (!manual) setCode(autoCode);
  }, [autoCode, manual]);

  const submit = async () => {
    if (!storeId) {
      toast.error('Store not loaded.');
      return;
    }
    if (isLebaneseCoa && !parent) {
      toast.error('Lebanese accounts must be a detail (D) under a parent.');
      return;
    }
    const finalCode = (manual ? code : autoCode).trim();
    if (!finalCode || !name.trim()) {
      toast.error('Name and code are required.');
      return;
    }
    if (manual && isLebaneseCoa && parent && !finalCode.startsWith(parent.code)) {
      toast.error(`Manual detail code must start with parent ${parent.code}.`);
      return;
    }
    setSaving(true);
    try {
      await createLedgerAccount(storeId, {
        code: finalCode,
        name: name.trim(),
        nameAr: nameAr.trim() || undefined,
        type: parent?.type || type,
        normalBalance: parent?.normalBalance,
        parentCode: parent?.code,
        pcgKind: isLebaneseCoa ? 'D' : undefined,
        currency: parent?.currency,
      });
      toast.success(`Account ${finalCode} created.`);
      onOpenChange(false);
      await onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add ledger account</DialogTitle>
          <DialogDescription>
            {isLebaneseCoa
              ? 'Creates a detail (D) account under the selected parent. Code is the next free sibling; override allowed on D only.'
              : 'Creates a posting account. Auto code is the next free sibling under the parent.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Parent</Label>
            <LedgerAccountCombobox
              accounts={parents}
              value={parentId}
              onValueChange={setParentId}
              isLebaneseCoa={isLebaneseCoa}
              pcgClientAccounts={pcgClientAccounts}
              accountingLanguage={accountingLanguage}
              placeholder="Search parent account…"
            />
          </div>
          {!isLebaneseCoa ? (
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as LedgerAccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((row) => (
                    <SelectItem key={row} value={row} className="capitalize">{row}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Kind: detail (D) · type inherited from parent</p>
          )}
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Name (Arabic)</Label>
            <Input dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Code</Label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
                Manual override
              </label>
            </div>
            <Input
              className="font-mono"
              value={manual ? code : autoCode}
              disabled={!manual}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
