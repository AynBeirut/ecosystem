import React, { useRef, useState } from 'react';
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

type Props = {
  mod: PricingModule;
  items: string[];
  enabled: boolean;
  coreLocked?: boolean;
  onToggle?: (enabled: boolean) => void;
};

export default function HomeModuleCard({ mod, items, enabled, coreLocked, onToggle }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const { Icon, accent } = getModuleIcon(mod.id);
  const roadmap = isRoadmapModule(mod);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -4, y: px * 4 });
  };

  return (
    <article
      ref={cardRef}
      className={`group relative transition-transform duration-300 ease-out ${
        enabled ? 'opacity-100' : 'opacity-90'
      }`}
      style={{
        transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      }}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div
        className={`relative h-full rounded-2xl border bg-white/95 backdrop-blur-sm p-5 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] transition-all duration-300 group-hover:shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] group-hover:-translate-y-0.5 ${accent.glow} ${
          enabled ? 'border-teal-200/80 ring-1 ring-teal-100' : 'border-slate-200/80'
        } ${roadmap ? 'border-dashed' : ''}`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent.gradient} shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_16px_-6px_rgba(15,23,42,0.4)]`}
          >
            <Icon className={`h-6 w-6 ${accent.iconClass}`} strokeWidth={1.75} />
          </div>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${getStatusBadgeClass(mod.status)}`}
          >
            {getStatusLabel(mod.status)}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1">{mod.name}</h3>
        <p className="text-[11px] font-semibold text-teal-700/90 uppercase tracking-wide mb-2">
          {getBillingLabel(mod)}
        </p>
        <p className="text-sm text-slate-500 leading-relaxed mb-4 line-clamp-3">{mod.summary}</p>

        <ul className="space-y-1.5 mb-4 hidden sm:block">
          {items.slice(0, 3).map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-slate-600">
              <Check className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" strokeWidth={2.5} />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
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
      </div>
    </article>
  );
}
