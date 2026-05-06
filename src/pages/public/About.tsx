import React from 'react';
import { Link } from 'react-router-dom';
import { Target, Heart, Zap, Globe, ArrowRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';

const VALUES = [
  {
    icon: Target,
    title: 'Built for real businesses',
    desc: "We don't build for enterprise demos or VC pitch decks. Every feature exists because an actual small business owner needed it to run their operation.",
  },
  {
    icon: Zap,
    title: 'Speed without compromise',
    desc: "A POS that lags costs you sales. A report that takes minutes to load is a report nobody checks. We obsess over performance because slow software is broken software.",
  },
  {
    icon: Heart,
    title: 'Honest pricing',
    desc: 'No per-transaction fees. No feature unlocks buried behind paywalls. No surprises on your invoice. The price you see is what you pay.',
  },
  {
    icon: Globe,
    title: 'Designed for diverse markets',
    desc: 'Dual-currency support, local payment methods, and flexible configuration — because business tools built only for Western markets fail everywhere else.',
  },
];

const TIMELINE = [
  { year: '2022', event: 'Grabio started as a small marketplace for local stores in Beirut.' },
  { year: '2023', event: 'Added POS and inventory management based on direct feedback from sellers.' },
  { year: '2024', event: 'Launched invoicing, supplier management, and production batch tracking.' },
  { year: '2025', event: 'Released analytics suite, finance module, and multi-currency support. Crossed 500 active stores.' },
];

const About: React.FC = () => (
  <>
    <SEOHead
      title="About Grabio — Business Management Platform for Modern Commerce"
      description="Learn about Grabio — who we are, what we build, and why we built a business management platform for the businesses that existing tools keep ignoring."
      url="/about"
      keywords={['about Grabio', 'business management platform', 'commerce platform company']}
    />

    <div className="flex flex-col min-h-screen bg-white">
      <PublicNav />

      <main>
        {/* ── Hero ── */}
        <section className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-5">
              Built for the Businesses That Keep Getting Ignored
            </h1>
            <p className="text-xl text-teal-100 leading-relaxed">
              Enterprise software is too complex and too expensive. Consumer apps are too simple. Grabio fills the gap — serious tools, accessible to any business that needs them.
            </p>
          </div>
        </section>

        {/* ── Mission ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Mission</h2>
          <p className="text-lg text-gray-600 leading-relaxed mb-6">
            The gap between a spreadsheet and an enterprise ERP system is enormous — and most small businesses fall into it. They outgrow Excel but cannot justify (or afford) a six-figure software implementation.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed mb-6">
            Grabio exists to close that gap. We build integrated business management tools that give small and growing businesses the operational infrastructure they need to compete: real-time inventory, professional invoicing, multi-channel commerce, and analytics that actually make sense.
          </p>
          <p className="text-lg text-gray-600 leading-relaxed">
            Not a demo. Not a simplified version of something bigger. A platform built specifically for businesses that are serious about running better operations, without the complexity or cost that excludes them from the tools they deserve.
          </p>
        </section>

        {/* ── Values ── */}
        <section className="bg-gray-50 py-16 border-t border-b border-gray-100">
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

        {/* ── Timeline ── */}
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

        {/* ── CTA ── */}
        <section className="bg-gray-50 py-14 border-t border-gray-100">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to work with us?</h2>
            <p className="text-gray-500 mb-8">
              Start building your business on a platform that was made for businesses like yours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors">
                Get Started Free
              </Link>
              <Link to="/contact" className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-colors flex items-center gap-2">
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
