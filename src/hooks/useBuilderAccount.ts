import { useCallback, useEffect, useState } from 'react';
import { getBuilderAccount, listDemoStores } from '@/lib/builderService';
import type { BuilderAccount, BuilderDemoStore } from '@/types/builder';

export function useBuilderAccount(builderUid: string | undefined) {
  const [account, setAccount] = useState<BuilderAccount | null>(null);
  const [demos, setDemos] = useState<BuilderDemoStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!builderUid) {
      setAccount(null);
      setDemos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [acct, demoList] = await Promise.all([
        getBuilderAccount(builderUid),
        listDemoStores(builderUid),
      ]);
      setAccount(acct);
      setDemos(demoList);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load builder account');
    } finally {
      setLoading(false);
    }
  }, [builderUid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { account, demos, loading, error, refresh };
}
