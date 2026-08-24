import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Delete, ScanLine } from 'lucide-react';
import { useAuth } from '@/context/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money/format';
import { getActualStoreId } from '@/lib/storeUtils';
import {
  createVExpense,
  V_EXPENSE_CATEGORIES,
  type VExpenseCategory,
} from '@/lib/vExpense';
import type { OcrExpenseSave } from '@/features/ocr';

const OcrReceiptFlow = lazy(() =>
  import('@/features/ocr').then((m) => ({ default: m.OcrReceiptFlow })),
);

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

export default function AdminVExpense() {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user) || user?.storeId || '';

  const [amountRaw, setAmountRaw] = useState('0');
  const [category, setCategory] = useState<VExpenseCategory>('other');
  const [name, setName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'card'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add('vpos-fullscreen');
    return () => {
      document.documentElement.classList.remove('vpos-fullscreen');
    };
  }, []);

  const amount = Number(amountRaw) || 0;

  const pressKey = (key: (typeof KEYS)[number]) => {
    setAmountRaw((prev) => {
      if (key === 'back') {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      }
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return `${prev}.`;
      }
      if (prev === '0') return key;
      if (prev.includes('.') && prev.split('.')[1]?.length >= 2) return prev;
      if (prev.replace('.', '').length >= 9) return prev;
      return `${prev}${key}`;
    });
  };

  const reset = () => {
    setAmountRaw('0');
    setName('');
    setCategory('other');
    setPaymentMethod('cash');
  };

  const submit = async () => {
    if (!storeId || submittingRef.current) return;
    if (amount <= 0) {
      toast({ title: 'Enter amount', variant: 'destructive' });
      return;
    }
    const whatFor = name.trim();
    if (!whatFor) {
      toast({
        title: 'What for is required',
        description: 'Type a description or tap a category.',
        variant: 'destructive',
      });
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await createVExpense({
        storeId,
        name: whatFor,
        amount,
        category,
        paymentMethod,
      });
      toast({
        title: 'Expense saved',
        description: `${whatFor} · ${formatMoney(amount, { currency: 'USD' })}`,
      });
      reset();
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleOcrExpense = async (data: OcrExpenseSave) => {
    if (!storeId) throw new Error('No store');
    const known = V_EXPENSE_CATEGORIES.some((c) => c.id === data.category);
    await createVExpense({
      storeId,
      name: data.name,
      amount: data.amount,
      category: (known ? data.category : 'other') as VExpenseCategory,
      notes: data.notes,
      date: data.date,
    });
    toast({
      title: 'Expense saved from scan',
      description: `${data.name} · ${formatMoney(data.amount, { currency: 'USD' })}`,
    });
  };

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b bg-background px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" asChild>
            <Link to="/admin/invoice-manager/expenses" aria-label="Back to expenses">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          </Button>
          <h1 className="flex-1 text-center text-base font-semibold">V·Expense</h1>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => setOcrOpen(true)}
            aria-label="Scan receipt"
          >
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl border bg-card px-4 py-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
            {formatMoney(amount, { currency: 'USD' })}
          </p>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What for? *
          </label>
          <Input
            className="h-12 text-base"
            placeholder="Type a description…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Or pick a category
        </p>
        <div className="grid grid-cols-3 gap-2">
          {V_EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategory(c.id);
                setName((prev) => (prev.trim() ? prev : c.label));
              }}
              className={cn(
                'min-h-[3rem] rounded-xl border px-2 py-2 text-sm font-medium transition active:scale-[0.98]',
                category === c.id
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'bg-card',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pay with</p>
        <div className="grid grid-cols-3 gap-2">
          {(['cash', 'bank', 'card'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={cn(
                'h-11 rounded-xl border text-sm font-medium capitalize transition active:scale-[0.98]',
                paymentMethod === m ? 'border-teal-600 bg-teal-600 text-white' : 'bg-card',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-14 text-xl font-semibold"
              onClick={() => pressKey(key)}
            >
              {key === 'back' ? <Delete className="h-5 w-5" /> : key}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          className="mt-3 h-12 w-full bg-teal-600 text-base hover:bg-teal-700"
          disabled={amount <= 0 || !name.trim() || submitting}
          onClick={() => void submit()}
        >
          Save expense · {formatMoney(amount, { currency: 'USD' })}
        </Button>
      </div>

      {ocrOpen ? (
        <Suspense fallback={null}>
          <OcrReceiptFlow
            open={ocrOpen}
            onOpenChange={setOcrOpen}
            storeId={storeId}
            allowedDestinations={['expense']}
            onSaveExpense={handleOcrExpense}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
