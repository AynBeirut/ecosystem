import { cn } from '@/lib/utils';

/** Shared Card / table classes for Lebanese PCG reports (matches voucher legacy shell). */
export function legacyReportCardClass(isLebaneseCoa: boolean | undefined, extra?: string) {
  return cn(
    isLebaneseCoa
      ? 'legacy-erp-shell border-slate-300 bg-transparent shadow-sm'
      : 'border-slate-200 bg-white shadow-sm',
    extra,
  );
}

export function legacyReportHeaderClass(isLebaneseCoa: boolean | undefined, extra?: string) {
  return cn(
    'shrink-0 border-b pb-4',
    isLebaneseCoa ? 'legacy-erp-toolbar border-b-0 pb-2' : 'bg-slate-50/80',
    extra,
  );
}

export function legacyReportBodyClass(isLebaneseCoa: boolean | undefined, extra?: string) {
  return cn('space-y-4 pt-4', isLebaneseCoa && 'legacy-erp-body', extra);
}

export function legacyReportTableClass(isLebaneseCoa: boolean | undefined, extra?: string) {
  return cn(extra, isLebaneseCoa && 'legacy-erp-grid');
}

export function legacyReportInputClass(isLebaneseCoa: boolean | undefined, extra?: string) {
  return cn(isLebaneseCoa ? 'legacy-erp-input' : 'bg-white', extra);
}

/** Lebanese embed: nav already names the page — skip title/subtitle bands. */
export function legacyReportOmitTitleBand(isLebaneseCoa: boolean | undefined): boolean {
  return Boolean(isLebaneseCoa);
}

/** Matrix blue sticky column header (#316ac5) — same as JV line grid / GL register. */
export function legacyReportThClass(isLebaneseCoa: boolean | undefined, extra?: string) {
  return cn(
    isLebaneseCoa
      ? 'sticky top-0 z-10 border border-[#2a5dad] bg-[#316ac5] px-2 py-1.5 text-left text-[11px] font-semibold !text-white hover:!bg-[#316ac5] hover:!text-white'
      : 'sticky top-0 z-10 bg-background px-1.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b shadow-[inset_0_-1px_0_0_hsl(var(--border))]',
    extra,
  );
}

/** shadcn TableHead inside legacy-erp-grid — white on blue band. */
export function legacyReportTableHeadClass(isLebaneseCoa: boolean | undefined, extra?: string) {
  return cn(
    isLebaneseCoa ? 'h-9 bg-[#316ac5] text-xs font-semibold !text-white hover:!bg-[#316ac5] hover:!text-white' : undefined,
    extra,
  );
}

/** shadcn header row — block muted hover wash on blue band. */
export function legacyReportTableHeaderRowClass(isLebaneseCoa: boolean | undefined) {
  return isLebaneseCoa ? 'border-[#2a5dad] hover:!bg-[#316ac5]' : undefined;
}

export function legacyReportTableHeaderShellClass(isLebaneseCoa: boolean | undefined) {
  return isLebaneseCoa ? 'sticky top-0 z-10 bg-[#316ac5]' : 'sticky top-0 z-10 bg-background';
}
