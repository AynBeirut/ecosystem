import { cn } from '@/lib/utils';

/** Shared surface styles — match AdminDashboard stat tiles & panels */
export const adminPanelClass =
  'rounded-2xl border-white/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5';

export const adminPanelInteractiveClass =
  'cursor-pointer hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300';

export const adminSectionLabelClass =
  'text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400';

export const adminListItemClass =
  'rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all';

export function adminPanel(...extra: (string | undefined | false)[]) {
  return cn(adminPanelClass, ...extra);
}
