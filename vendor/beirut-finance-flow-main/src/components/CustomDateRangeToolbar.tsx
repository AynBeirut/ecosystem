import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { normalizeDateRange } from '@/lib/reportPeriodPresets';
import { quarterBounds, VAT_QUARTER_SHORT, type VatQuarter } from '@/lib/ledger/lebanonVatQuarterPeriod';

export type DateRangeShortcut = {
  label: string;
  startDate: string;
  endDate: string;
};

type Props = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  shortcuts?: DateRangeShortcut[];
  showVatQuarters?: boolean;
  quarterYear?: number;
  className?: string;
  compact?: boolean;
};

export default function CustomDateRangeToolbar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  shortcuts = [],
  showVatQuarters,
  quarterYear = new Date().getFullYear(),
  className,
  compact,
}: Props) {
  const period = normalizeDateRange(startDate, endDate);

  const applyQuarter = (q: VatQuarter) => {
    const bounds = quarterBounds(quarterYear, q);
    onStartDateChange(bounds.startDate);
    onEndDateChange(bounds.endDate);
  };

  return (
    <div className={cn('flex flex-wrap items-end gap-2', className)}>
      <div>
        <Label className={cn('text-xs', compact && 'sr-only')}>From</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className={cn('h-9', compact ? 'w-[130px]' : 'w-[150px]')}
          aria-label="Period start date"
        />
      </div>
      <div>
        <Label className={cn('text-xs', compact && 'sr-only')}>To</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className={cn('h-9', compact ? 'w-[130px]' : 'w-[150px]')}
          aria-label="Period end date"
        />
      </div>
      {showVatQuarters && (
        <div className="flex flex-wrap gap-1 pb-0.5">
          {([1, 2, 3, 4] as VatQuarter[]).map((q) => (
            <Button key={q} type="button" size="sm" variant="outline" onClick={() => applyQuarter(q)}>
              {VAT_QUARTER_SHORT[q]}
            </Button>
          ))}
        </div>
      )}
      {shortcuts.map((s) => (
        <Button
          key={s.label}
          type="button"
          size="sm"
          variant="outline"
          className="pb-0.5"
          onClick={() => {
            onStartDateChange(s.startDate);
            onEndDateChange(s.endDate);
          }}
        >
          {s.label}
        </Button>
      ))}
      {!compact && (
        <p className="text-xs text-muted-foreground pb-1">
          {period.startDate} → {period.endDate}
        </p>
      )}
    </div>
  );
}
