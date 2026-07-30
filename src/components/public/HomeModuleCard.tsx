import React from 'react';
import { Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { PricingModule } from '@/lib/pricingDisplay';
import { isRoadmapModule } from '@/lib/pricingDisplay';
import { getModuleIcon } from '@/lib/moduleIcons';
import {
  getBillingLabel,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/publicModulesContent';
import { cn } from '@/lib/utils';
import {
  adminListItemClass,
  adminPanelInteractiveClass,
  adminSectionLabelClass,
} from '@/lib/adminStyles';

type Props = {
  mod: PricingModule;
  items: string[];
  enabled: boolean;
  coreLocked?: boolean;
  onToggle?: (enabled: boolean) => void;
};

export default function HomeModuleCard({ mod, items, enabled, coreLocked, onToggle }: Props) {
  const { Icon, accent } = getModuleIcon(mod.id);
  const roadmap = isRoadmapModule(mod);

  return (
    <article
      className={cn(
        adminPanelInteractiveClass,
        'group relative flex h-full flex-col p-4 md:p-5 transition-all duration-300 hover:-translate-y-0.5',
        enabled ? 'ring-1 ring-teal-500/15' : 'opacity-95',
        roadmap && 'border-dashed',
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className={cn(
            'home-feature-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_20px_-8px_rgba(15,23,42,0.45)] transition-transform duration-300 group-hover:scale-105',
            accent.gradient,
            accent.glow,
          )}
        >
          <Icon className={cn('h-7 w-7', accent.iconClass)} strokeWidth={1.65} />
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
            getStatusBadgeClass(mod.status),
          )}
        >
          {getStatusLabel(mod.status)}
        </span>
      </div>

      <p className={cn(adminSectionLabelClass, 'mb-1 normal-case tracking-normal text-teal-700')}>
        {getBillingLabel(mod)}
      </p>
      <h3 className="mb-2 text-base font-semibold tracking-tight text-slate-900">{mod.name}</h3>
      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-slate-500">{mod.summary}</p>

      <ul className="mb-4 hidden space-y-1.5 sm:block">
        {items.slice(0, 3).map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-slate-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" strokeWidth={2.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-500">
          {coreLocked ? 'Always included' : enabled ? (roadmap ? 'Preview' : 'Active') : roadmap ? 'Roadmap' : 'Optional'}
        </span>
        {coreLocked ? (
          <span className="text-xs font-bold text-teal-600">Core</span>
        ) : (
          <Switch
            checked={enabled}
            onCheckedChange={(v) => onToggle?.(Boolean(v))}
            aria-label={`Toggle ${mod.name}`}
          />
        )}
      </div>
    </article>
  );
}
