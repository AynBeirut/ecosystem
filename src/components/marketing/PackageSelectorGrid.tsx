import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  Briefcase,
  Coffee,
  Factory,
  HandHeart,
  Layers,
  Newspaper,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { HOME_INDUSTRY_CARDS, type HomeIndustryCardSlug } from '@/data/marketing/homeIndustryCards';

const ICONS: Record<HomeIndustryCardSlug, LucideIcon> = {
  shop: Store,
  cafe: Coffee,
  restaurant: UtensilsCrossed,
  manufacturing: Factory,
  ecommerce: ShoppingBag,
  ngo: HandHeart,
  freelancer: Briefcase,
  publisher: Newspaper,
  custom: Layers,
};

const ACCENT_BAR: Record<HomeIndustryCardSlug, string> = {
  shop: 'from-teal-500 to-emerald-600',
  cafe: 'from-amber-500 to-orange-700',
  restaurant: 'from-rose-500 to-rose-800',
  manufacturing: 'from-slate-500 to-slate-800',
  ecommerce: 'from-violet-500 to-indigo-700',
  ngo: 'from-sky-500 to-blue-700',
  freelancer: 'from-cyan-500 to-teal-700',
  publisher: 'from-fuchsia-500 to-purple-700',
  custom: 'from-zinc-500 to-zinc-800',
};

const ICON_BOX: Record<HomeIndustryCardSlug, string> = {
  shop: 'bg-gradient-to-br from-teal-500 to-emerald-700 shadow-teal-600/30',
  cafe: 'bg-gradient-to-br from-amber-500 to-orange-800 shadow-amber-600/30',
  restaurant: 'bg-gradient-to-br from-rose-500 to-rose-900 shadow-rose-600/30',
  manufacturing: 'bg-gradient-to-br from-slate-500 to-slate-900 shadow-slate-600/30',
  ecommerce: 'bg-gradient-to-br from-violet-500 to-indigo-800 shadow-violet-600/30',
  ngo: 'bg-gradient-to-br from-sky-500 to-blue-800 shadow-sky-600/30',
  freelancer: 'bg-gradient-to-br from-cyan-500 to-teal-800 shadow-cyan-600/30',
  publisher: 'bg-gradient-to-br from-fuchsia-500 to-purple-800 shadow-fuchsia-600/30',
  custom: 'bg-gradient-to-br from-zinc-500 to-zinc-900 shadow-zinc-600/30',
};

const PackageSelectorGrid: React.FC = () => (
  <section id="industries" className="marketing-industries scroll-mt-24">
    <div className="marketing-industries-inner">
      <div className="marketing-section-head">
        <p className="marketing-section-eyebrow">Industries</p>
        <h2 className="marketing-section-title">Pick your business type</h2>
        <p className="marketing-section-lead">
          Nine ways to run on Grabio — explore live demos or start with NGO, freelancer, publisher, and custom
          packages.
        </p>
      </div>
      <div className="marketing-package-grid">
        {HOME_INDUSTRY_CARDS.map((card) => {
          const Icon = ICONS[card.slug];
          return (
            <Link key={card.slug} to={card.href} className="marketing-package-card group">
              <span
                className={`marketing-package-accent bg-gradient-to-r ${ACCENT_BAR[card.slug]}`}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg ${ICON_BOX[card.slug]}`}
                >
                  <Icon size={28} strokeWidth={2.25} color="#ffffff" aria-hidden />
                </div>
                <ArrowUpRight
                  className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-teal-600"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900 group-hover:text-teal-900">
                    {card.label}
                  </h3>
                  {card.phase === 2 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      Start now
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {card.shortLabel}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.cardDescription}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  </section>
);

export default PackageSelectorGrid;
