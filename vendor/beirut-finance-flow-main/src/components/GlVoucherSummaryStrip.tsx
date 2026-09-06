import { Badge } from '@/components/ui/badge';

export type GlVoucherSummary = {
  typeLabel?: string;
  party?: string;
  category?: string;
  description?: string;
  reference?: string;
  grossRevenue?: number;
  discountAmount?: number;
  netTotal?: number;
};

type Props = {
  summary: GlVoucherSummary | null | undefined;
};

function cell(label: string, value: string | undefined) {
  const text = value?.trim() || '—';
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm" title={text}>
        {text}
      </p>
    </div>
  );
}

export default function GlVoucherSummaryStrip({ summary }: Props) {
  if (!summary) return null;

  return (
    <div className="rounded-md border bg-slate-50/80 p-3 space-y-3">
      {summary.typeLabel ? (
        <Badge variant="outline" className="text-[10px] font-semibold uppercase">
          {summary.typeLabel}
        </Badge>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cell('Party', summary.party)}
        {cell('Category', summary.category)}
        {cell('Details', summary.description)}
        {cell('Ref', summary.reference)}
      </div>
    </div>
  );
}
