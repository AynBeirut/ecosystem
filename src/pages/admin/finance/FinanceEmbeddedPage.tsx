import React, { Suspense, useEffect, useState } from 'react';
import { wireFinanceFirebaseFromGrabio } from '@/embed/financeFirebaseBridge';
import FinanceAppBridge from '@/embed/FinanceAppBridge';
import AdminPageFallback from '@/components/admin/AdminPageFallback';

type FinanceEmbeddedPageProps = {
  loader: () => Promise<{ default: React.ComponentType }>;
};

export default function FinanceEmbeddedPage({ loader }: FinanceEmbeddedPageProps) {
  const [Page, setPage] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        wireFinanceFirebaseFromGrabio();
        const mod = await loader();
        if (!cancelled) {
          setPage(() => mod.default);
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
    return <AdminPageFallback />;
  }

  return (
    <FinanceAppBridge>
      <Suspense fallback={<AdminPageFallback />}>
        <Page />
      </Suspense>
    </FinanceAppBridge>
  );
}
