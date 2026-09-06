import { splitLedgerAmountForMode, type ReportCurrencyMode } from '@/lib/ledger/formatLedgerAmount';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = {
  amount: number;
  storeCurrency: string;
  mode: ReportCurrencyMode;
  usdToLbp?: number;
  empty?: string;
  className?: string;
};

type AmountParts = { primary: string; secondary?: string };

function stopRowActivation(e: React.MouseEvent) {
  e.stopPropagation();
}

function AmountStack({
  parts,
  compact,
  className,
}: {
  parts: AmountParts;
  compact?: boolean;
  className?: string;
}) {
  const primaryLong = parts.primary.length > 12;
  return (
    <div className={cn('text-right leading-tight tabular-nums', className)}>
      <div
        className={cn(
          'text-[11px]',
          compact && !parts.secondary && primaryLong && 'truncate max-w-[5.25rem] ml-auto',
        )}
      >
        {parts.primary}
      </div>
      {parts.secondary ? (
        <div
          className={cn(
            'text-[9px] font-normal text-muted-foreground',
            compact && 'truncate max-w-[4.75rem] ml-auto',
          )}
        >
          ≈ {parts.secondary}
        </div>
      ) : null}
    </div>
  );
}

/** Table-safe amount: stacks USD + LBP in "both" mode; click for full digits (no K/M). */
export default function ReportAmountCell({
  amount,
  storeCurrency,
  mode,
  usdToLbp,
  empty = '—',
  className,
}: Props) {
  if (!amount) return <span className={className}>{empty}</span>;

  const parts = splitLedgerAmountForMode(amount, storeCurrency, mode, usdToLbp);
  const expandable = Boolean(parts.secondary) || parts.primary.length > 12;

  if (!expandable) {
    return <span className={cn('tabular-nums', className)}>{parts.primary}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full rounded px-0.5 -mx-0.5 text-right',
            'cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
          onClick={stopRowActivation}
          onDoubleClick={stopRowActivation}
          aria-label="Show full amount"
          title="Click for full amount"
        >
          <AmountStack parts={parts} compact />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-none whitespace-nowrap p-2.5 text-sm" align="end" side="top">
        <AmountStack parts={parts} />
      </PopoverContent>
    </Popover>
  );
}
