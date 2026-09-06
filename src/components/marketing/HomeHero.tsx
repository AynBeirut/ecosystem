import React from 'react';
import { Link } from 'react-router-dom';
import PoweredByEmoove from '@/components/PoweredByEmoove';
import { HOME_HERO, PHASE1_PACKAGES } from '@/lib/marketingPackages';

const HomeHero: React.FC = () => (
  <section className="marketing-hero">
    <div className="marketing-hero-inner">
      <p className="marketing-hero-eyebrow">Grabio platform</p>
      <h1 className="marketing-hero-title">{HOME_HERO.title}</h1>
      <p className="marketing-hero-lead">{HOME_HERO.subtitle}</p>
      <p className="mt-6">
        <PoweredByEmoove variant="onDark" />
      </p>
      <div className="marketing-hero-pills">
        {PHASE1_PACKAGES.map((pkg) => (
          <Link key={pkg.slug} to={`/demo/${pkg.slug}`} className="marketing-hero-pill">
            {pkg.label}
          </Link>
        ))}
      </div>
    </div>
  </section>
);

export default HomeHero;
