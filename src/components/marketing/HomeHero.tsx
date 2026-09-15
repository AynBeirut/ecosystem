import React from 'react';
import { Link } from 'react-router-dom';
import PoweredByEmoove from '@/components/PoweredByEmoove';
import { HOME_HERO, HOME_HERO_CRM_HREF, HOME_HERO_PACKAGE_SLUGS, PHASE1_PACKAGES } from '@/lib/marketingPackages';

const HomeHero: React.FC = () => (
  <section className="marketing-hero">
    <div className="marketing-hero-inner">
      <p className="marketing-hero-eyebrow">Guest CRM &amp; fine dining venues</p>
      <h1 className="marketing-hero-title">{HOME_HERO.title}</h1>
      <p className="marketing-hero-lead">{HOME_HERO.subtitle}</p>
      <p className="mt-6">
        <PoweredByEmoove variant="onDark" />
      </p>
      <div className="marketing-hero-pills">
        <Link to={HOME_HERO_CRM_HREF} className="marketing-hero-pill marketing-hero-pill-accent">
          Guest CRM
        </Link>
        {PHASE1_PACKAGES.filter((pkg) =>
          (HOME_HERO_PACKAGE_SLUGS as readonly string[]).includes(pkg.slug),
        ).map((pkg) => (
          <Link key={pkg.slug} to={`/demo/${pkg.slug}`} className="marketing-hero-pill">
            {pkg.slug === 'restaurant' ? 'Fine dining demo' : pkg.label}
          </Link>
        ))}
        <Link to="/pricing" className="marketing-hero-pill">
          Live Kitchen plans
        </Link>
      </div>
    </div>
  </section>
);

export default HomeHero;
