import { cn } from '@/lib/utils';

/** Top module tabs (Quotation · Accounting · …) — sit on admin shell background. */
export function financeModuleTabClass(active: boolean) {
  return cn('finance-module-tab', active && 'finance-module-tab--active');
}

/** Inner hub cards (Reports, Settings, Accounting daily work). */
export function financeHubTabClass(active: boolean) {
  return cn('finance-hub-tab', active && 'finance-hub-tab--active');
}

/** Compact icon chips (JV/PV-style) for hub sub-navigation. */
export const FINANCE_HUB_ICON_COLORS = [
  'finance-accounting-tab__icon-wrap--teal',
  'finance-accounting-tab__icon-wrap--blue',
  'finance-accounting-tab__icon-wrap--violet',
  'finance-accounting-tab__icon-wrap--amber',
  'finance-accounting-tab__icon-wrap--emerald',
  'finance-accounting-tab__icon-wrap--orange',
  'finance-accounting-tab__icon-wrap--cyan',
  'finance-accounting-tab__icon-wrap--rose',
  'finance-accounting-tab__icon-wrap--indigo',
  'finance-accounting-tab__icon-wrap--sky',
  'finance-accounting-tab__icon-wrap--purple',
  'finance-accounting-tab__icon-wrap--green',
] as const;

export function financeHubIconColorClass(index: number): string {
  return FINANCE_HUB_ICON_COLORS[index % FINANCE_HUB_ICON_COLORS.length];
}

export function financeHubChipRowClass() {
  return 'finance-accounting-tabs-row finance-hub-chip-row';
}

export function financeHubChipClass(active: boolean) {
  return cn('finance-accounting-tab finance-hub-chip', active && 'finance-hub-chip--active');
}

export const financeTabLabelClass = 'finance-tab__label flex items-center gap-2 font-medium';
export const financeTabDescClass = 'finance-tab__desc text-xs font-normal';
export const financeTabIconClass = 'finance-tab__icon h-[18px] w-[18px] shrink-0';
