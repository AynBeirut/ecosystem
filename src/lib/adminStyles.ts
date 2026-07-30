import { cn } from '@/lib/utils';

/** White elevated surfaces — light tokens scoped inside (obsidian shell safe) */
export const adminSurfaceClass = 'admin-surface';
export const adminPanelClass = 'admin-panel';
export const adminPanelInteractiveClass = 'admin-panel-interactive';
export const adminSectionLabelClass = 'admin-section-label';
export const adminListItemClass = 'admin-list-item';
export const adminStatTileClass = 'admin-stat-tile';
export const adminStatTileInteractiveClass = 'admin-stat-tile-interactive';
export const adminStatLabelClass = 'admin-stat-label';
export const adminStatValueClass = 'admin-stat-value';
export const adminHeadingClass = 'admin-heading';
export const adminPageHeadingClass = 'admin-page-heading';
export const adminSubnavLinkClass = 'admin-subnav-link';
export const adminSubnavLinkActiveClass = 'admin-subnav-link--active';

/** @deprecated aliases — same as admin* classes */
export const adminDashboardStatTileClass = adminStatTileClass;
export const adminDashboardStatTileInteractiveClass = adminStatTileInteractiveClass;
export const adminDashboardSurfaceClass = adminPanelClass;
export const adminDashboardStatLabelClass = adminStatLabelClass;
export const adminDashboardStatValueClass = adminStatValueClass;
export const adminDashboardSectionLabelClass = adminSectionLabelClass;
export const adminDashboardHeadingClass = adminHeadingClass;
export const adminDashboardListItemClass = adminListItemClass;

export function adminPanel(...extra: (string | undefined | false)[]) {
  return cn(adminPanelClass, ...extra);
}

export function adminSubnavLink(active: boolean, ...extra: (string | undefined | false)[]) {
  return cn(adminSubnavLinkClass, active && adminSubnavLinkActiveClass, ...extra);
}

/** Outline buttons on white admin surfaces */
export const adminOutlineButtonClass =
  'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900';
