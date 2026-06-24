import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
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
  index: number;
};

export default function FeatureModuleCard({ mod, items, index }: Props) {
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
    setTilt({ x: py * -6, y: px * 6 });
  };

  const handleLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <article
      ref={cardRef}
      id={mod.id}
      className="group relative scroll-mt-28 transition-transform duration-300 ease-out"
      style={{
        transitionDelay: `${Math.min(index * 30, 180)}ms`,
        transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div
        className={`relative h-full rounded-2xl border bg-white/90 backdrop-blur-sm p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 group-hover:shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18),0_8px_16px_-8px_rgba(15,23,42,0.1)] group-hover:-translate-y-1 ${accent.glow} ${
          roadmap ? 'border-dashed border-slate-200/90' : 'border-slate-200/80'
        }`}
      >
        {/* depth highlight */}
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80"
          aria-hidden
        />

        <div className="flex items-start justify-between gap-4 mb-5">
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent.gradient} shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_20px_-8px_rgba(15,23,42,0.45)] transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-0.5`}
          >
            <div
              className="absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
            <Icon className={`h-7 w-7 ${accent.iconClass} drop-shadow-sm`} strokeWidth={1.75} />
          </div>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${getStatusBadgeClass(mod.status)}`}
          >
            {getStatusLabel(mod.status)}
          </span>
        </div>

        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1.5">{mod.name}</h3>
        <p className="text-xs font-semibold text-teal-700/90 uppercase tracking-wide mb-3">
          {getBillingLabel(mod)}
        </p>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">{mod.summary}</p>

        <ul className="space-y-2 mb-5">
          {items.slice(0, 4).map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-600">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>

        {!roadmap ? (
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          >
            View pricing
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <p className="text-xs font-medium text-slate-400">Roadmap — not yet in checkout</p>
        )}
      </div>
    </article>
  );
}
