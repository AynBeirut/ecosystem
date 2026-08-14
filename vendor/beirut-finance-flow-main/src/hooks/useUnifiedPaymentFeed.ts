import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useGrabioStore } from '@/hooks/useGrabioStore';
import {
  fetchGrabioPaymentSources,
  mergeUnifiedPaymentFeed,
  type UnifiedPaymentDirection,
  type UnifiedPaymentRow,
} from '@/lib/grabio/unifiedPaymentFeed';

import type { Receipt } from '@/types';

function mergeReceiptLists(
  contextReceipts: Receipt[],
  storeReceipts: Array<Record<string, unknown> & { id: string }>,
) {
  const byId = new Map<string, Record<string, unknown> & { id: string }>();
  for (const receipt of storeReceipts) {
    byId.set(receipt.id, receipt);
  }
  for (const receipt of contextReceipts) {
    if (!byId.has(receipt.id)) {
      byId.set(receipt.id, receipt as Record<string, unknown> & { id: string });
    }
  }
  return [...byId.values()];
}

export function useUnifiedPaymentFeed() {
  const { receipts, payments, paymentOrders } = useAppContext();
  const { storeId, profile, loading: storeLoading } = useGrabioStore();
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [accountPayments, setAccountPayments] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [storeReceipts, setStoreReceipts] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!storeId) {
      setAccountPayments([]);
      setStoreReceipts([]);
      setRemoteLoading(false);
      return;
    }
    setRemoteLoading(true);
    setError(null);
    try {
      const data = await fetchGrabioPaymentSources(storeId);
      setAccountPayments(data.accountPayments);
      setStoreReceipts(data.storeReceipts);
    } catch (err) {
      console.error('[useUnifiedPaymentFeed]', err);
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setRemoteLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mergedReceipts = useMemo(
    () => mergeReceiptLists(receipts, storeReceipts),
    [receipts, storeReceipts],
  );

  const rows = useMemo(
    () =>
      mergeUnifiedPaymentFeed({
        storeId: storeId || '',
        currency: profile?.mainCurrency || 'USD',
        receipts: mergedReceipts as Parameters<typeof mergeUnifiedPaymentFeed>[0]['receipts'],
        invoicePayments: payments,
        paymentOrders,
        accountPayments,
      }),
    [storeId, profile?.mainCurrency, mergedReceipts, payments, paymentOrders, accountPayments],
  );

  const byDirection = useCallback(
    (direction: UnifiedPaymentDirection) => rows.filter((row) => row.direction === direction),
    [rows],
  );

  return {
    rows,
    moneyIn: useMemo(() => byDirection('in'), [byDirection]),
    moneyOut: useMemo(() => byDirection('out'), [byDirection]),
    loading: storeLoading || remoteLoading,
    error,
    reload,
  };
}

export type { UnifiedPaymentRow };
