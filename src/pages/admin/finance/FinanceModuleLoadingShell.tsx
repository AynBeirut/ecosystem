import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useFinanceStoreLabel } from '@/pages/admin/finance/useFinanceStoreLabel';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';

type Props = {
  variant?: 'finance' | 'invoice';
  message?: string;
};

export default function FinanceModuleLoadingShell({
  variant = 'finance',
  message,
}: Props) {
  const storeName = useFinanceStoreLabel();
  const title = variant === 'invoice' ? 'Invoice Manager' : 'Business Finance';
  const loaderLabel =
    message ?? (variant === 'invoice' ? 'Opening Invoice Manager…' : 'Opening Business Finance…');

  return (
    <div className="finance-embed-theme finance-module-shell space-y-2">
      {storeName ? (
        <div className="finance-store-topbar" aria-label="Current store">
          <span className="finance-store-topbar__label">Store</span>
          <span className="finance-store-topbar__name">{storeName}</span>
        </div>
      ) : null}
      <div className="finance-compact-nav">
        <Link
          to="/admin/dashboard"
          title="Back to dashboard"
          aria-label="Back to dashboard"
          className="finance-compact-nav__back"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        </Link>

        <div className="finance-compact-nav__context">
          <span className="finance-compact-nav__title">{title}</span>
        </div>

        <span className="finance-compact-nav__sep" aria-hidden />

        <div className="finance-compact-nav__controls">
          <div className="finance-compact-nav__skeleton finance-compact-nav__skeleton--module" />
          <div className="finance-compact-nav__skeleton finance-compact-nav__skeleton--page" />
        </div>
      </div>

      <div className="finance-module-loading-panel">
        <AdminEmbedLoader label={loaderLabel} compact inline />
      </div>
    </div>
  );
}
