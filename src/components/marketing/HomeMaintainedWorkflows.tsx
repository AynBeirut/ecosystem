import React from 'react';
import { Link } from 'react-router-dom';
import {
  HOME_INDUSTRY_CARDS_MAINTAINED,
  type HomeIndustryCard,
  type HomeIndustryCardSlug,
} from '@/data/marketing/homeIndustryCards';
import IndustryCard from '@/components/marketing/HomeIndustryCard';

const HomeMaintainedWorkflows: React.FC = () => (
  <section id="other-workflows" className="marketing-platform-band scroll-mt-24">
    <div className="marketing-section-head">
      <p className="marketing-section-eyebrow">Also on Grabio</p>
      <h2 className="marketing-section-title text-lg md:text-xl">Retail, factory &amp; e-commerce</h2>
      <p className="marketing-section-lead text-sm">
        Retail, production, and online sales on the same platform — for teams already running shop, factory, or
        storefront workflows on Grabio.
      </p>
    </div>
    <div className="marketing-package-grid">
      {HOME_INDUSTRY_CARDS_MAINTAINED.map((card) => (
        <IndustryCard key={card.slug} card={card} />
      ))}
    </div>
    <p className="mt-4 text-center text-xs text-slate-500">
      NGO, freelancer, and custom stacks — see{' '}
      <Link to="/pricing" className="font-medium text-teal-700 hover:underline">Pricing</Link> or talk to us.
    </p>
  </section>
);

export default HomeMaintainedWorkflows;
