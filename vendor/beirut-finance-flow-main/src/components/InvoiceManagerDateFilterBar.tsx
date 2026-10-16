import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { InvoiceManagerDatePreset } from '@/lib/invoiceManagerDateFilter';
import { useInvoiceManagerDateFilter } from '@/context/InvoiceManagerDateFilterContext';

const PRESETS: { id: InvoiceManagerDatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

export default function InvoiceManagerDateFilterBar() {
  const {
    preset,
    setPreset,
    customStart,
    customEnd,
    setCustomStart,
    setCustomEnd,
    range,
  } = useInvoiceManagerDateFilter();

  return (
    <div className="finance-compact-nav flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <span className="text-[11px] font-medium text-slate-500 shrink-0">Period</span>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
              preset === item.id
                ? 'bg-[var(--finance-accent,#38B2AC)] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
            onClick={() => setPreset(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            type="date"
            aria-label="From date"
            className="h-7 w-[9.5rem] text-xs"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span className="text-xs text-slate-400">–</span>
          <Input
            type="date"
            aria-label="To date"
            className="h-7 w-[9.5rem] text-xs"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
        </div>
      ) : (
        <span className="text-[11px] text-slate-500 tabular-nums">
          {range.start === range.end ? range.start : `${range.start} → ${range.end}`}
        </span>
      )}
    </div>
  );
}
