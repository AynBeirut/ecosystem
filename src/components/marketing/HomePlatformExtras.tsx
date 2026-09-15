import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { HOME_PLATFORM_EXTRAS } from '@/lib/publicVenuePricing';
import { getModuleIcon } from '@/lib/moduleIcons';

const HomePlatformExtras: React.FC = () => (
  <section className="marketing-platform-band">
    <div className="marketing-section-head mb-6 md:mb-8">
      <p className="marketing-section-eyebrow">Apps &amp; AI</p>
      <h2 className="marketing-section-title text-xl md:text-2xl">Mobile admin, invoicing app, and in-account AI</h2>
      <p className="marketing-section-lead text-sm">
        Included or add-on with Live Kitchen — same account as floor CRM and POS.{' '}
        <Link to="/pricing" className="font-medium text-teal-700 hover:underline">Build your package</Link>
      </p>
    </div>
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
      {HOME_PLATFORM_EXTRAS.map((item) => {
        const { Icon, accent } = getModuleIcon(item.moduleId);
        return (
          <li key={item.moduleId}>
            <Link
              to={item.href}
              className="group flex h-full gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${accent.gradient}`}
              >
                <Icon className={`h-6 w-6 ${accent.iconClass}`} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-900">{item.title}</h3>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-teal-600" aria-hidden />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  </section>
);

export default HomePlatformExtras;
