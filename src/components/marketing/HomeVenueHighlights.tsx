import React from 'react';
import { CalendarDays, ChefHat, Smartphone, Users, UtensilsCrossed } from 'lucide-react';
import { HOME_VENUE_HIGHLIGHTS } from '@/lib/marketingPackages';

const ICONS = {
  floor: UtensilsCrossed,
  guests: Users,
  kitchen: ChefHat,
  owner: Smartphone,
  reservations: CalendarDays,
} as const;

const HomeVenueHighlights: React.FC = () => (
  <section className="marketing-platform-band">
    <div className="marketing-section-head mb-6 md:mb-8">
      <p className="marketing-section-eyebrow">On a busy service</p>
      <h2 className="marketing-section-title">Front of house, kitchen, and ownership in sync</h2>
      <p className="marketing-section-lead">
        One workspace for the room, the pass, and guest relationships — add recipes, stock, and finance when the
        operation needs more depth.
      </p>
    </div>
    <ul className="grid gap-4 sm:grid-cols-2 list-none m-0 p-0">
      {HOME_VENUE_HIGHLIGHTS.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <li
            key={item.title}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-teal-200/80"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-900 text-white shadow-md">
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.desc}</p>
          </li>
        );
      })}
    </ul>
  </section>
);

export default HomeVenueHighlights;
