import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import ReportAmountCell from '@/components/ReportAmountCell';
import {
  defaultReportCurrencyMode,
  normalizeLedgerCurrency,
  type ReportCurrencyMode,
} from '@/lib/ledger/formatLedgerAmount';

export type VoucherSaleTotals = {
  grossRevenue: number;
  discountAmount: number;
  netTotal: number;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
};

type Props = {
  totals: VoucherSaleTotals;
  isLebaneseCoa?: boolean;
  storeCurrency?: string;
  usdToLbp?: number;
  className?: string;
};

export function parseSaleTotalsFromMeta(
  meta: Record<string, unknown> | undefined | null,
): VoucherSaleTotals | null {
  if (!meta) return null;
  const discount = Number(meta.discountAmount);
  if (!Number.isFinite(discount) || discount <= 0) return null;
  const gross = Number(meta.grossRevenue);
  const net = Number(meta.netTotal);
  const discountType = meta.discountType === 'percentage' ? 'percentage' : 'fixed';
  const discountValue = Number(meta.discountValue);
  return {
    grossRevenue: Number.isFinite(gross) && gross > 0 ? gross : 0,
    discountAmount: discount,
    netTotal: Number.isFinite(net) && net > 0 ? net : 0,
    discountType,
    discountValue: Number.isFinite(discountValue) && discountValue > 0 ? discountValue : undefined,
  };
}

export function isSalesDiscountLedgerLine(line: {
  accountCode?: string;
  accountId?: string;
  description?: string;
}): boolean {
  const code = String(line.accountCode || '').trim();
  if (code === '410' || code === '7090') return true;
  if (line.accountId === 'acct-410' || line.accountId === 'acct-7090') return true;
  return /sales discount|reverse sales discount|حسومات/i.test(String(line.description || ''));
}

export default function VoucherSaleTotalsBand({
  totals,
  isLebaneseCoa,
  storeCurrency = 'USD',
  usdToLbp,
  className,
}: Props) {
  if (totals.discountAmount <= 0) return null;

  const discountLabel =
    totals.discountType === 'percentage' && totals.discountValue
      ? `Discount (7090) — ${totals.discountValue}%`
      : 'Discount (7090)';

  const amountMode: ReportCurrencyMode =
    normalizeLedgerCurrency(storeCurrency) === 'LBP' ? 'LBP' : defaultReportCurrencyMode(storeCurrency);

  const renderAmount = (amount: number) => (
    <ReportAmountCell amount={amount} storeCurrency={storeCurrency} mode={amountMode} usdToLbp={usdToLbp} />
  );

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-3 rounded-md border px-3 py-2 text-sm',
        isLebaneseCoa
          ? 'border-slate-500 bg-[#e8e6dc] text-slate-900'
          : 'border-border bg-muted/40 text-foreground',
        className,
      )}
    >
      <div>
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide',
            isLebaneseCoa ? 'text-slate-700' : 'text-muted-foreground',
          )}
        >
          Subtotal (gross)
        </p>
        <p className="font-semibold">{renderAmount(totals.grossRevenue)}</p>
      </div>
      <div>
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide',
            isLebaneseCoa ? 'text-slate-700' : 'text-muted-foreground',
          )}
        >
          {discountLabel}
        </p>
        <p className="font-semibold text-red-800">−{formatCurrency(totals.discountAmount)}</p>
      </div>
      <div>
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide',
            isLebaneseCoa ? 'text-slate-700' : 'text-muted-foreground',
          )}
        >
          Net received
        </p>
        <p className="font-semibold">{renderAmount(totals.netTotal)}</p>
      </div>
    </div>
  );
}
