import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { MarketingPackageContent } from '@/data/marketing/packageTypes';
import { demoStorePath } from '@/lib/marketingPackages';
import { trackDemoStart } from '@/lib/seoTracker';

type Props = {
  pkg: MarketingPackageContent;
  className?: string;
  onClick?: () => void;
};

const TryDemoButton: React.FC<Props> = ({ pkg, className = '', onClick }) => {
  const handleClick = () => {
    trackDemoStart({
      slug: pkg.slug,
      demoStoreSlug: pkg.demoStoreSlug,
      label: pkg.label,
    });
    onClick?.();
  };

  return (
    <Link
      to={demoStorePath(pkg)}
      onClick={handleClick}
      className={
        className ||
        'inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700'
      }
    >
      Try the demo
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
};

export default TryDemoButton;
