import { useCallback, useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { FinanceCollectionKey } from '@/lib/firestore/paths';
import {
  listStoreCollection,
  removeStoreDoc,
  upsertStoreDoc,
} from '@/lib/firestore/storeCollection';
import { db } from '@/integrations/firebase/client';
import { FINANCE_COLLECTIONS } from '@/lib/firestore/paths';

const nowIso = () => new Date().toISOString();

/** Firestore CRUD for store-scoped finance subcollections (replaces useSupabaseTable). */
export function useFinanceTable<T extends { id: string }>(collectionKey: FinanceCollectionKey) {
  const { activeOrganizationId: storeId } = useAppContext();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!storeId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listStoreCollection<T>(storeId, collectionKey);
      setData(rows);
    } catch (err) {
      console.error(`[${collectionKey}] fetch error:`, err);
      toast({
        title: 'Error',
        description: `Failed to load ${FINANCE_COLLECTIONS[collectionKey]}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, collectionKey, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const insert = async (row: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
    if (!storeId) {
      toast({ title: 'Error', description: 'No store selected', variant: 'destructive' });
      return null;
    }
    const id = doc(
      db,
      'stores',
      storeId,
      FINANCE_COLLECTIONS[collectionKey],
    ).id;
    const ts = nowIso();
    const payload = {
      ...(row as Record<string, unknown>),
      created_at: ts,
      updated_at: ts,
    };
    try {
      await upsertStoreDoc(storeId, collectionKey, id, payload);
      const result = { id, ...payload } as unknown as T;
      setData((prev) => [result, ...prev]);
      return result;
    } catch (err) {
      console.error(`[${collectionKey}] insert error:`, err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create record',
        variant: 'destructive',
      });
      return null;
    }
  };

  const update = async (id: string, updates: Partial<T>) => {
    if (!storeId) return false;
    const safeUpdates = { ...(updates as Record<string, unknown>), updated_at: nowIso() };
    try {
      await upsertStoreDoc(storeId, collectionKey, id, safeUpdates);
      setData((prev) => prev.map((item) => (item.id === id ? { ...item, ...safeUpdates } : item)));
      return true;
    } catch (err) {
      console.error(`[${collectionKey}] update error:`, err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update record',
        variant: 'destructive',
      });
      return false;
    }
  };

  const remove = async (id: string) => {
    if (!storeId) return false;
    try {
      await removeStoreDoc(storeId, collectionKey, id);
      setData((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (err) {
      console.error(`[${collectionKey}] delete error:`, err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete record',
        variant: 'destructive',
      });
      return false;
    }
  };

  return { data, loading, fetchData, insert, update, remove, setData, storeId };
}
