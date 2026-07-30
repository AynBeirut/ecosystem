import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import SEOHead from '@/components/SEOHead';
import PublicNav from '@/components/public/PublicNav';
import PublicFooter from '@/components/public/PublicFooter';

export type PublicSubnavItem = {
  label: string;
  href: string;
  external?: boolean;
};

type PublicPageShellProps = {
  title: string;
  description: string;
  url?: string;
  keywords?: string[];
  eyebrow?: string;
  heroTitle: string;
  heroDescription?: string;
  heroActions?: React.ReactNode;
  subnav?: PublicSubnavItem[];
  children: React.ReactNode;
  className?: string;
};

const PublicPageShell: React.FC<PublicPageShellProps> = ({
  title,
  description,
  url,
  keywords,
  eyebrow,
  heroTitle,
  heroDescription,
  heroActions,
  subnav,
  children,
  className,
}) => (
  <>
    <SEOHead title={title} description={description} url={url} keywords={keywords} />
    <div className={cn('public-page-shell', className)}>
      <PublicNav />
      <main className="flex-1">
        <section className="public-page-hero">
          <div className="public-page-hero-card">
            {eyebrow && <p className="public-page-eyebrow">{eyebrow}</p>}
            <h1 className="public-page-title">{heroTitle}</h1>
            {heroDescription && <p className="public-page-lead">{heroDescription}</p>}
            {heroActions && <div className="public-page-hero-actions">{heroActions}</div>}
            {subnav && subnav.length > 0 && (
              <div className="public-subnav mt-5">
                {subnav.map((item) =>
                  item.external ? (
                    <a key={item.href} href={item.href} className="public-subnav-link">
                      {item.label}
                    </a>
                  ) : (
                    <Link key={item.href} to={item.href} className="public-subnav-link">
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
        </section>
        <div className="public-page-main">{children}</div>
      </main>
      <PublicFooter />
    </div>
  </>
);

export default PublicPageShell;
