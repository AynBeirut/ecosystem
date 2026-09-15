import React from 'react';
import { HOME_INDUSTRY_CARDS_PRIMARY } from '@/data/marketing/homeIndustryCards';
import IndustryCard from '@/components/marketing/HomeIndustryCard';

/** One row: fine dining · café · guest CRM */
const HOME_TOP_ROW = HOME_INDUSTRY_CARDS_PRIMARY.filter((c) =>
  ['restaurant', 'cafe', 'guest_crm'].includes(c.slug),
);

const PackageSelectorGrid: React.FC = () => (
  <section id="industries" className="marketing-industries scroll-mt-24">
    <div className="marketing-industries-inner">
      <div className="marketing-section-head">
        <p className="marketing-section-eyebrow">Start here</p>
        <h2 className="marketing-section-title">Guest CRM, then your venue model</h2>
        <p className="marketing-section-lead">
          CRM is core — not an add-on. Pick fine dining or café, explore the live demo, or start a Live Kitchen
          workspace.
        </p>
      </div>
      <div className="marketing-package-grid lg:grid-cols-3">
        {HOME_TOP_ROW.map((card) => (
          <IndustryCard key={card.slug} card={card} prominent={card.slug === 'guest_crm'} />
        ))}
      </div>
    </div>
  </section>
);

export default PackageSelectorGrid;
