import React, { useEffect, useState } from 'react';
import AdminEmbedLoader from '@/components/admin/AdminEmbedLoader';
import AdminPanel from '@/components/admin/AdminPanel';
import {
  getCachedCrmPage,
  loadCrmPage,
  type CrmPageLoader,
} from '@/pages/admin/crm/crmEmbeddedLoaders';

type Props = {
  loader: CrmPageLoader;
};

function CrmTabFallback() {
  return <AdminEmbedLoader label="Opening CRM…" compact />;
}

export default function CrmEmbeddedPage({ loader }: Props) {
  const [Page, setPage] = useState<React.ComponentType | null>(() => getCachedCrmPage(loader) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCachedCrmPage(loader);
    if (cached) {
      setPage(() => cached);
      setError(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const component = await loadCrmPage(loader);
        if (!cancelled) {
          setPage(() => component);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load CRM view');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loader]);

  if (error) {
    return (
      <AdminPanel className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </AdminPanel>
    );
  }

  if (!Page) {
    return <CrmTabFallback />;
  }

  return <Page />;
}
