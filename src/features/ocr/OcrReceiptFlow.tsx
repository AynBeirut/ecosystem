import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronLeft, FileImage, Loader2, Plus, ScanLine, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { fileToOcrPayload } from './fileToOcrPayload';
import { scanReceiptOcr } from './ocrApi';
import type { OcrDestination, OcrDraft, OcrLineItem } from './types';

export type OcrCatalogSupplier = { id: string; name: string };
export type OcrCatalogMaterial = { id: string; name: string; sku?: string; unit?: string };

export type OcrExpenseSave = {
  name: string;
  amount: number;
  date: string;
  category: string;
  notes: string;
  currency: string;
  vendorName: string;
};

export type OcrPurchaseSave = {
  supplierId: string;
  orderDate: string;
  notes: string;
  currency: string;
  total: number;
  items: Array<{
    materialId: string;
    materialName: string;
    sku: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Lock destination to the page that opened OCR (purchase / expense / both). */
  allowedDestinations: OcrDestination[];
  suppliers?: OcrCatalogSupplier[];
  materials?: OcrCatalogMaterial[];
  /** Find-or-create supplier from invoice vendor name (purchase context). */
  onEnsureSupplier?: (name: string) => Promise<OcrCatalogSupplier>;
  /** Find-or-create raw material from a line description (purchase context). */
  onEnsureMaterial?: (name: string, unitCost: number) => Promise<OcrCatalogMaterial>;
  onSaveExpense?: (data: OcrExpenseSave) => Promise<void> | void;
  onSavePurchase?: (data: OcrPurchaseSave) => Promise<void> | void;
};

const EXPENSE_CATEGORIES = [
  'rent',
  'utilities',
  'fuel',
  'internet',
  'maintenance',
  'office_supplies',
  'marketing',
  'insurance',
  'legal',
  'travel',
  'meals',
  'payroll',
  'other',
] as const;

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, '');
}

function tokens(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter((t) => t.length > 2);
}

export function fuzzyMatchSupplier(
  vendor: string,
  suppliers: OcrCatalogSupplier[],
): OcrCatalogSupplier | undefined {
  const n = fold(vendor);
  if (!n || n.length < 2) return undefined;

  const exact = suppliers.find((s) => fold(s.name) === n);
  if (exact) return exact;

  const contains = suppliers.find((s) => {
    const sn = fold(s.name);
    return sn.includes(n) || n.includes(sn);
  });
  if (contains) return contains;

  const vTokens = tokens(vendor);
  if (!vTokens.length) return undefined;

  let best: { s: OcrCatalogSupplier; score: number } | undefined;
  for (const s of suppliers) {
    const sTokens = tokens(s.name);
    if (!sTokens.length) continue;
    const overlap = vTokens.filter((t) => sTokens.some((st) => st.includes(t) || t.includes(st))).length;
    const score = overlap / Math.max(vTokens.length, sTokens.length);
    if (score >= 0.5 && (!best || score > best.score)) best = { s, score };
  }
  return best?.s;
}

function fuzzyMatchMaterial(
  description: string,
  materials: OcrCatalogMaterial[],
): OcrCatalogMaterial | undefined {
  const n = fold(description);
  if (!n) return undefined;
  const exact = materials.find((m) => fold(m.name) === n);
  if (exact) return exact;
  return materials.find((m) => {
    const mn = fold(m.name);
    return mn.includes(n) || n.includes(mn);
  });
}

function guessExpenseCategory(text: string): string {
  const t = text.toLowerCase();
  if (/rent|إيجار/.test(t)) return 'rent';
  if (/electric|water|utility|كهرباء|ماء/.test(t)) return 'utilities';
  if (/fuel|gas|وقود/.test(t)) return 'fuel';
  if (/internet|انترنت/.test(t)) return 'internet';
  if (/salary|payroll|راتب/.test(t)) return 'payroll';
  if (/insurance|تأمين/.test(t)) return 'insurance';
  return 'other';
}

function seedLineFromTotal(total: number, vendor: string): OcrLineItem[] {
  const amount = Number(total) || 0;
  if (amount <= 0) {
    return [{ description: '', quantity: 1, unitPrice: 0, total: 0 }];
  }
  return [
    {
      description: vendor.trim() ? `${vendor.trim()} — receipt` : 'Receipt total',
      quantity: 1,
      unitPrice: amount,
      total: amount,
    },
  ];
}

export function OcrReceiptFlow({
  open,
  onOpenChange,
  storeId,
  allowedDestinations,
  suppliers = [],
  materials = [],
  onEnsureSupplier,
  onEnsureMaterial,
  onSaveExpense,
  onSavePurchase,
}: Props) {
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'capture' | 'confirm'>('capture');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<OcrDraft | null>(null);
  const [destination, setDestination] = useState<OcrDestination | ''>('');
  const [vendorName, setVendorName] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<OcrLineItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [expenseCategory, setExpenseCategory] = useState('other');
  const [localSuppliers, setLocalSuppliers] = useState<OcrCatalogSupplier[]>([]);
  const [localMaterials, setLocalMaterials] = useState<OcrCatalogMaterial[]>([]);

  const allSuppliers = useMemo(() => {
    const map = new Map<string, OcrCatalogSupplier>();
    [...suppliers, ...localSuppliers].forEach((s) => map.set(s.id, s));
    return [...map.values()];
  }, [suppliers, localSuppliers]);

  const allMaterials = useMemo(() => {
    const map = new Map<string, OcrCatalogMaterial>();
    [...materials, ...localMaterials].forEach((m) => map.set(m.id, m));
    return [...map.values()];
  }, [materials, localMaterials]);

  const matchedSupplier = useMemo(
    () => fuzzyMatchSupplier(vendorName, allSuppliers),
    [vendorName, allSuppliers],
  );

  const contextLabel =
    allowedDestinations.length === 1
      ? allowedDestinations[0] === 'purchase'
        ? 'Purchases'
        : 'Expenses'
      : null;

  const reset = () => {
    setStep('capture');
    setScanning(false);
    setSaving(false);
    setDraft(null);
    setDestination('');
    setVendorName('');
    setDate('');
    setTotal('');
    setCurrency('USD');
    setNotes('');
    setLineItems([]);
    setSupplierId('');
    setMaterialIds([]);
    setExpenseCategory('other');
    setLocalSuppliers([]);
    setLocalMaterials([]);
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Keep supplierId in sync when vendor name matches an existing supplier.
  useEffect(() => {
    if (step !== 'confirm' || destination !== 'purchase') return;
    if (matchedSupplier) {
      setSupplierId(matchedSupplier.id);
    }
  }, [matchedSupplier, step, destination]);

  const applyDraft = (d: OcrDraft) => {
    const locked =
      allowedDestinations.length === 1
        ? allowedDestinations[0]
        : d.suggestedDestination !== 'ambiguous' &&
            allowedDestinations.includes(d.suggestedDestination)
          ? d.suggestedDestination
          : '';

    setDraft(d);
    setVendorName(d.vendorName);
    setDate(d.date);
    setTotal(String(d.total || ''));
    setCurrency(d.currency || 'USD');
    setNotes(d.rawText.slice(0, 2000));
    setExpenseCategory(guessExpenseCategory(d.rawText + ' ' + d.vendorName));
    setDestination(locked);

    const lines =
      d.lineItems.length > 0
        ? d.lineItems
        : locked === 'purchase' || allowedDestinations.includes('purchase')
          ? seedLineFromTotal(d.total, d.vendorName)
          : [];
    setLineItems(lines);

    const matched = fuzzyMatchSupplier(d.vendorName, suppliers);
    setSupplierId(matched?.id || '');

    const ids = lines.map((li) => fuzzyMatchMaterial(li.description, materials)?.id || '');
    setMaterialIds(ids);
    setStep('confirm');
  };

  const handleFile = async (file: File | null) => {
    if (!file || !storeId) return;
    setScanning(true);
    try {
      const { base64, mimeType } = await fileToOcrPayload(file);
      const result = await scanReceiptOcr(storeId, base64, mimeType);
      applyDraft(result);
    } catch (err) {
      toast({
        title: 'OCR failed',
        description: err instanceof Error ? err.message : 'Could not read receipt',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const updateLine = (index: number, patch: Partial<OcrLineItem>) => {
    setLineItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (patch.quantity != null || patch.unitPrice != null) {
          next.total = Number((next.quantity * next.unitPrice).toFixed(2));
        }
        return next;
      }),
    );
  };

  const addLine = () => {
    const amount = Number(total) || 0;
    setLineItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unitPrice: prev.length === 0 ? amount : 0,
        total: prev.length === 0 ? amount : 0,
      },
    ]);
    setMaterialIds((prev) => [...prev, '']);
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setMaterialIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!destination) {
      toast({
        title: 'Pick destination',
        description: 'Choose Purchase or Expense before saving.',
        variant: 'destructive',
      });
      return;
    }

    const amount = Number(total);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Invalid total', description: 'Enter a valid total amount.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (destination === 'expense') {
        if (!onSaveExpense) throw new Error('Expense save not available here');
        const expenseName = vendorName.trim() || 'Scanned expense';
        await onSaveExpense({
          name: expenseName,
          amount,
          date: date || new Date().toISOString().slice(0, 10),
          category: expenseCategory,
          notes: notes.trim(),
          currency,
          vendorName: vendorName.trim(),
        });
      } else {
        if (!onSavePurchase) throw new Error('Purchase save not available here');

        let resolvedSupplierId = supplierId || matchedSupplier?.id || '';
        const vendor = vendorName.trim();
        if (!resolvedSupplierId) {
          if (!vendor) {
            toast({
              title: 'Supplier name needed',
              description: 'Enter the vendor name from the invoice.',
              variant: 'destructive',
            });
            setSaving(false);
            return;
          }
          if (!onEnsureSupplier) {
            toast({
              title: 'Select supplier',
              description: 'Pick an existing supplier or open Purchases to add one.',
              variant: 'destructive',
            });
            setSaving(false);
            return;
          }
          const created = await onEnsureSupplier(vendor);
          setLocalSuppliers((prev) => [...prev, created]);
          resolvedSupplierId = created.id;
          setSupplierId(created.id);
        }

        let workingLines = lineItems;
        if (!workingLines.length) {
          workingLines = seedLineFromTotal(amount, vendor);
          setLineItems(workingLines);
        }

        const items: OcrPurchaseSave['items'] = [];
        for (let i = 0; i < workingLines.length; i++) {
          const li = workingLines[i];
          const qty = Number(li.quantity) || 1;
          const unitPrice = Number(li.unitPrice) || 0;
          if (qty <= 0 && unitPrice <= 0) continue;

          let materialId = materialIds[i] || '';
          let mat = allMaterials.find((m) => m.id === materialId);
          if (!mat) {
            const desc = li.description.trim() || vendor || 'OCR item';
            const auto = fuzzyMatchMaterial(desc, allMaterials);
            if (auto) {
              mat = auto;
              materialId = auto.id;
            } else if (onEnsureMaterial) {
              mat = await onEnsureMaterial(desc, unitPrice || amount);
              setLocalMaterials((prev) => [...prev, mat!]);
              materialId = mat.id;
            }
          }
          if (!mat || !materialId) continue;
          items.push({
            materialId,
            materialName: mat.name,
            sku: mat.sku || '',
            unit: mat.unit || 'piece',
            quantity: qty,
            unitPrice: unitPrice || amount,
          });
        }

        if (!items.length) {
          toast({
            title: 'Add at least one item',
            description: 'Fill qty/price on a line, or pick/create a material.',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }

        await onSavePurchase({
          supplierId: resolvedSupplierId,
          orderDate: date || new Date().toISOString().slice(0, 10),
          notes: notes.trim(),
          currency,
          total: amount,
          items,
        });
      }

      toast({
        title: 'Saved',
        description:
          destination === 'expense' ? 'Expense created from scan.' : 'Purchase draft created from scan.',
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const supplierHint =
    destination === 'purchase'
      ? matchedSupplier
        ? `Matched supplier: ${matchedSupplier.name}`
        : vendorName.trim()
          ? onEnsureSupplier
            ? `Will create supplier: ${vendorName.trim()}`
            : 'Select a supplier below'
          : 'Enter vendor name to match or create supplier'
      : null;

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-receipt-title"
    >
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => onOpenChange(false)}
          aria-label="Close scan"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h2 id="ocr-receipt-title" className="flex flex-1 items-center gap-2 text-base font-semibold">
          <ScanLine className="h-5 w-5" />
          Scan receipt
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
        <p className="mb-3 text-xs text-muted-foreground">
          Photo is read with OCR then discarded — nothing is stored in Storage.
        </p>

        {step === 'capture' && (
          <div className="space-y-3 py-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] || null)}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              className="h-12 w-full"
              disabled={scanning || !storeId}
              onClick={() => cameraInputRef.current?.click()}
            >
              {scanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reading…
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Take photo
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full"
              disabled={scanning || !storeId}
              onClick={() => galleryInputRef.current?.click()}
            >
              <FileImage className="mr-2 h-4 w-4" />
              Gallery / PDF file
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {contextLabel
                ? `Opened from ${contextLabel} — will save as ${allowedDestinations[0]}.`
                : 'Photo, gallery image, or PDF invoice.'}
            </p>
          </div>
        )}

        {step === 'confirm' && draft && (
          <div className="space-y-4 py-1">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {contextLabel ? (
                <>
                  From <span className="font-medium text-foreground">{contextLabel}</span>
                  {destination === 'purchase'
                    ? ' — invoice name is treated as supplier.'
                    : ' — invoice name is treated as expense name.'}{' '}
                </>
              ) : null}
              {draft.suggestionReason}
            </div>

            {allowedDestinations.length > 1 && (
              <div>
                <Label>Save as *</Label>
                <Select
                  value={destination || undefined}
                  onValueChange={(v) => setDestination(v as OcrDestination)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Purchase or Expense" />
                  </SelectTrigger>
                  <SelectContent className="z-[210]">
                    {allowedDestinations.includes('purchase') && (
                      <SelectItem value="purchase">Purchase</SelectItem>
                    )}
                    {allowedDestinations.includes('expense') && (
                      <SelectItem value="expense">Expense</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>
                  {destination === 'expense' ? 'Expense / vendor name' : 'Supplier name (from invoice)'}
                </Label>
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder={destination === 'purchase' ? 'Supplier on invoice' : 'Who / what'}
                />
                {supplierHint ? (
                  <p className="mt-1 text-xs text-teal-700 dark:text-teal-400">{supplierHint}</p>
                ) : null}
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Total *</Label>
                <Input
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTotal(v);
                    const n = Number(v);
                    if (Number.isFinite(n) && n > 0 && lineItems.length === 1) {
                      updateLine(0, { unitPrice: n, quantity: 1 });
                    }
                  }}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[210]">
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LBP">LBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {destination === 'expense' && (
              <div>
                <Label>Category</Label>
                <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[210]">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {destination === 'purchase' && (
              <div className="space-y-3">
                {!matchedSupplier && allSuppliers.length > 0 ? (
                  <div>
                    <Label>Or pick existing supplier</Label>
                    <Select value={supplierId || undefined} onValueChange={setSupplierId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional override" />
                      </SelectTrigger>
                      <SelectContent className="z-[210]">
                        {allSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add item
                  </Button>
                </div>

                {lineItems.map((li, i) => (
                  <div key={i} className="space-y-2 rounded-md border p-3">
                    <div className="flex gap-2">
                      <Input
                        className="flex-1"
                        value={li.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        placeholder="Item description"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive"
                        onClick={() => removeLine(i)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        inputMode="decimal"
                        value={String(li.quantity)}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })}
                        placeholder="Qty"
                      />
                      <Input
                        inputMode="decimal"
                        value={String(li.unitPrice)}
                        onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) || 0 })}
                        placeholder="Price"
                      />
                      <Input value={String(li.total)} readOnly />
                    </div>
                    <Select
                      value={materialIds[i] || undefined}
                      onValueChange={(v) =>
                        setMaterialIds((prev) => {
                          const next = [...prev];
                          next[i] = v;
                          return next;
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            onEnsureMaterial
                              ? 'Material (auto-create if empty)'
                              : 'Match raw material *'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="z-[210]">
                        {allMaterials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Notes / OCR text</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {step === 'confirm' ? (
        <div className="flex shrink-0 gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            onClick={() => setStep('capture')}
            disabled={saving}
          >
            Rescan
          </Button>
          <Button
            type="button"
            className="h-12 flex-1"
            onClick={() => void handleConfirm()}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Confirm & save'
            )}
          </Button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
