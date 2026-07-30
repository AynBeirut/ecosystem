import React, { Suspense, useEffect, useState } from 'react';
import { wireFinanceFirebaseFromGrabio } from '@/embed/financeFirebaseBridge';
import FinanceEmbedFallback from '@/pages/admin/finance/FinanceEmbedFallback';
import {
  getCachedFinancePage,
  loadFinancePage,
  type FinancePageLoader,
} from '@/pages/admin/finance/financeEmbeddedLoaders';

type FinanceEmbeddedPageProps = {
  loader: FinancePageLoader;
};

export default function FinanceEmbeddedPage({ loader }: FinanceEmbeddedPageProps) {
  const [Page, setPage] = useState<React.ComponentType | null>(() => getCachedFinancePage(loader) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedFinancePage(loader);
    if (cached) {
      setPage(() => cached);
      setError(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const component = await loadFinancePage(loader);
        if (!cancelled) {
          setPage(() => component);
          setError(null);
        }
      } catch (err) {
        console.error('[FinanceEmbeddedPage]', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Invoice Manager');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loader]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!Page) {
    return <FinanceEmbedFallback />;
  }

  return (
    <Suspense fallback={<FinanceEmbedFallback />}>
      <Page />
    </Suspense>
  );
}
