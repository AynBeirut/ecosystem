import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Globe, Layers, Palette, Users } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';

const TRACKS = [
  {
    id: 'designer_builder',
    title: 'Designer / Web Builder',
    icon: Palette,
    accent: 'from-violet-500 to-indigo-600',
    summary:
      'Build demo storefronts for clients, hand off to store owners, and stay on as web maintenance.',
    perks: [
      'Browse store profiles and templates',
      'Create products and up to 3 demo websites',
      'Showcase demos as portfolio models',
      'Transfer a demo to a client when they go live',
      'Join client stores as web maintenance sub-account',
    ],
    applyHref: '/careers/apply/designer_builder',
  },
  {
    id: 'accounting',
    title: 'Accounting Freelancer',
    icon: Calculator,
    accent: 'from-emerald-500 to-teal-600',
    summary:
      'Test finance workflows across Grabio, then support store owners as an accounting sub-account.',
    perks: [
      'Explore the full finance and operations stack',
      'Spin up 3 isolated accounting test sandboxes',
      'Practice purchases, GL, invoicing, and reporting',
      'Support multiple client stores as sub-account',
      'See all assigned clients after sign-in',
    ],
    applyHref: '/careers/apply/accounting',
  },
] as const;

const Careers: React.FC = () => (
  <PublicPageShell
    title="Careers — Join the Grabio Team"
    description="Apply as a designer/web builder or accounting freelancer. Work with multiple clients on Grabio."
    url="/careers"
    eyebrow="Careers"
    heroTitle="Freelance with Grabio"
    heroDescription="Builder freelancers create demo websites; accounting freelancers test finance workflows — both can support multiple clients as sub-accounts."
    heroActions={
      <>
        <Link
          to="/careers/apply/designer_builder"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
        >
          Apply as Builder
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/careers/apply/accounting"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Apply as Accounting
        </Link>
      </>
    }
  >
    <div className="grid gap-6 md:grid-cols-2">
      {TRACKS.map((track) => {
        const Icon = track.icon;
        return (
          <article key={track.id} className="public-panel">
            <div
              className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${track.accent} text-white shadow-lg`}
            >
              <Icon className="h-7 w-7" strokeWidth={1.6} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{track.title}</h2>
            <p className="mt-2 text-slate-600">{track.summary}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {track.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span className="text-teal-600 mt-0.5">•</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <Link
              to={track.applyHref}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Apply for this track
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        );
      })}
    </div>

    <section className="public-panel grid gap-6 md:grid-cols-3">
      <div className="flex gap-4">
        <Users className="h-8 w-8 text-teal-600 shrink-0" />
        <div>
          <h3 className="font-semibold text-slate-900">Multiple clients</h3>
          <p className="mt-1 text-sm text-slate-600">
            One freelancer login. After store owners add you, your client list appears on sign-in.
          </p>
        </div>
      </div>
      <div className="flex gap-4">
        <Globe className="h-8 w-8 text-teal-600 shrink-0" />
        <div>
          <h3 className="font-semibold text-slate-900">Demo to live handoff</h3>
          <p className="mt-1 text-sm text-slate-600">
            Builders transfer finished demos to store owners and can stay on for web care.
          </p>
        </div>
      </div>
      <div className="flex gap-4">
        <Layers className="h-8 w-8 text-teal-600 shrink-0" />
        <div>
          <h3 className="font-semibold text-slate-900">Real system access</h3>
          <p className="mt-1 text-sm text-slate-600">
            Accounting freelancers get sandbox stores to test operations before client work.
          </p>
        </div>
      </div>
    </section>

    <section className="public-panel text-center">
      <h2 className="text-2xl font-bold text-slate-900">Already applied?</h2>
      <p className="mt-2 text-slate-600">Sign in to open your freelancer workspace and client list.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/login?next=/freelancer"
          className="inline-flex items-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Freelancer sign in
        </Link>
        <Link
          to="/login?tab=signup&next=/onboarding/freelancer"
          className="inline-flex items-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
        >
          Create account
        </Link>
      </div>
    </section>
  </PublicPageShell>
);

export default Careers;
