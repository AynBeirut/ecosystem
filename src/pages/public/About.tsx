import React from 'react';
import { Link } from 'react-router-dom';
import AuthCTA from '@/components/public/AuthCTA';
import { Target, Heart, Zap, Globe, Layers, ArrowRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';

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
  <>
    <SEOHead
      title="About Grabio — Modular Business Platform"
      description="Grabio is a modular business platform for modern commerce — one sign-in, core platform features on every plan, optional modules and apps as you grow."
      url="/about"
      keywords={['about Grabio', 'modular business platform', 'commerce platform Lebanon']}
    />

    <div className="flex flex-col min-h-screen bg-white">
      <PublicNav />

      <main>
        <section className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-5">
              Built for Businesses That Keep Getting Ignored
            </h1>
            <p className="text-xl text-teal-100 leading-relaxed mb-2">
              One sign-in — all your data in one place.
            </p>
            <p className="text-teal-200/90 leading-relaxed">
              Enterprise software is too complex. Consumer apps are too simple. Grabio is a modular
              platform — serious tools you activate module by module, without six-figure implementations.
            </p>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Mission</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-6">
            Most small businesses outgrow spreadsheets but cannot justify enterprise ERP. Grabio closes
            that gap with a unified core and installable modules — web admin, Android owner app, CRM,
            production, and in-account AI tools.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed mb-6">
            Core platform features ship on every paid plan. Optional modules and add-ons let you customize
            your stack: Sales CRM for field teams, Factory for manufacturers, AI tools for growth — pay
            for extras only when you turn them on.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed">
            Not a demo. Not a simplified afterthought. A platform built for businesses that want to run
            better operations on their terms.
          </p>
        </section>

        <section className="bg-gray-50 py-12 border-y border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6 text-center">What we build today</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {MODULE_HIGHLIGHTS.map(({ label, href, desc }) => (
                <Link
                  key={label}
                  to={href}
                  className="block p-5 bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-sm transition-all"
                >
                  <p className="font-semibold text-teal-700 mb-1">{label}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gray-50 py-16 border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">What We Stand For</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {VALUES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white p-6 rounded-2xl border border-gray-200">
                  <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-10 text-center">How We Got Here</h2>
          <div className="relative border-l-2 border-teal-200 pl-6 space-y-8">
            {TIMELINE.map(({ year, event }) => (
              <div key={year} className="relative">
                <div className="absolute -left-[31px] w-4 h-4 bg-teal-500 rounded-full border-2 border-white top-1" />
                <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">{year}</p>
                <p className="text-gray-700 leading-relaxed">{event}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-50 py-14 border-t border-gray-100">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to work with us?</h2>
            <p className="text-gray-500 mb-8">
              Start with core platform features. Add modules when your business is ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <AuthCTA className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors" />
              <Link
                to="/pricing"
                className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-colors"
              >
                Build your package
              </Link>
              <Link
                to="/contact"
                className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                Contact Us <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  </>
);

export default About;
