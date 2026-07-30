import React from 'react';
import { Link } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import { Target, Heart, Zap, Globe, Layers, ArrowRight } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';

const VALUES = [
  {
    icon: Target,
    title: 'Built for real businesses',
    desc: 'We ship modules store owners actually use — invoicing, marketplace, CRM, mobile admin — not enterprise demos.',
  },
  {
    icon: Layers,
    title: 'Modular by design',
    desc: 'One shared core with installable modules. Turn on CRM, production, or AI tools when you need them — not before.',
  },
  {
    icon: Heart,
    title: 'Honest pricing',
    desc: 'Clear base plans plus optional add-ons. Core platform features included; extras billed separately — no surprise unlocks.',
  },
  {
    icon: Globe,
    title: 'Designed for diverse markets',
    desc: 'Dual-currency support, OMT and Stripe, and flexible configuration for markets Western-only tools ignore.',
  },
  {
    icon: Zap,
    title: 'Speed without compromise',
    desc: 'Web admin and Android owner app stay fast and in sync. Real-time data across devices — slow software is broken software.',
  },
];

const TIMELINE = [
  { year: '2022', event: 'Grabio started as a marketplace for local stores in Beirut.' },
  { year: '2023', event: 'Added inventory, invoicing, and web admin based on seller feedback.' },
  { year: '2024', event: 'Launched supplier management, production tracking, and analytics suite.' },
  { year: '2025', event: 'Finance module, multi-currency, Sales CRM add-on, and 500+ active stores.' },
  { year: '2026', event: 'Modular platform launch — Admin Android app on Google Play, AI growth tools, and installable module roadmap (POS, PSA, Web Builder).' },
];

const MODULE_HIGHLIGHTS = [
  { label: 'Platform', href: '/features#platform-features', desc: 'Invoicing, marketplace, CRM, inventory' },
  { label: 'Apps', href: '/features#apps-features', desc: 'Admin Android live; POS in development' },
  { label: 'AI Tools', href: '/features#ai-features', desc: 'In-account content, email, proposals' },
];

const About: React.FC = () => (
  <PublicPageShell
    title="About Grabio — Modular Business Platform"
    description="Grabio is a modular business platform for modern commerce — one sign-in, core platform features on every plan, optional modules and apps as you grow."
    url="/about"
    keywords={['about Grabio', 'modular business platform', 'commerce platform Lebanon']}
    eyebrow="Company"
    heroTitle="Built for businesses that keep getting ignored"
    heroDescription="Enterprise software is too complex. Consumer apps are too simple. Grabio is modular — serious tools you activate module by module."
    subnav={[
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Contact', href: '/contact' },
    ]}
  >
    <section className="public-panel">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Our mission</h2>
      <p className="text-slate-600 leading-relaxed mb-4">
        Most small businesses outgrow spreadsheets but cannot justify enterprise ERP. Grabio closes
        that gap with a unified core and installable modules — web admin, Android owner app, CRM,
        production, and in-account AI tools.
      </p>
      <p className="text-slate-600 leading-relaxed mb-4">
        Core platform features ship on every paid plan. Optional modules and add-ons let you customize
        your stack: Sales CRM for field teams, Factory for manufacturers, AI tools for growth — pay
        for extras only when you turn them on.
      </p>
      <p className="text-slate-600 leading-relaxed">
        Not a demo. Not a simplified afterthought. A platform built for businesses that want to run
        better operations on their terms.
      </p>
    </section>

    <section className="public-panel">
      <h2 className="text-lg font-bold text-slate-900 mb-5 text-center">What we build today</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {MODULE_HIGHLIGHTS.map(({ label, href, desc }) => (
          <Link
            key={label}
            to={href}
            className="block p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 hover:bg-teal-50/30 transition-all"
          >
            <p className="font-semibold text-teal-700 mb-1">{label}</p>
            <p className="text-sm text-slate-600">{desc}</p>
          </Link>
        ))}
      </div>
    </section>

    <section className="public-panel">
      <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">What we stand for</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {VALUES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="public-panel">
      <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">How we got here</h2>
      <div className="relative mx-auto max-w-2xl border-l-2 border-teal-200 pl-6 space-y-8">
        {TIMELINE.map(({ year, event }) => (
          <div key={year} className="relative">
            <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white bg-teal-500" />
            <p className="text-xs font-bold uppercase tracking-wider text-teal-600 mb-1">{year}</p>
            <p className="text-slate-700 leading-relaxed">{event}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="public-panel text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-3">Ready to work with us?</h2>
      <p className="text-slate-600 mb-6">Start with core platform features. Add modules when your business is ready.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <AuthCTA className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors" />
        <Link
          to="/pricing"
          className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:border-slate-400 transition-colors"
        >
          Build your package
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:border-slate-400 transition-colors"
        >
          Contact us <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  </PublicPageShell>
);

export default About;
