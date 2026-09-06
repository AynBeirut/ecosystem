import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import {
  createGlPresentationContext,
  resolveVoucherParty,
  type InvoiceLookupRow,
} from '@/lib/ledger/glEntryPresentation';
import type { JournalEntry } from '@/types/generalLedger';

type InvoiceLike = {
  id: string;
  invoiceNumber?: string;
  clientName: string;
  clientId?: string;
  amount?: number;
  paymentMethod?: string;
};

export function useVoucherParty(entry: JournalEntry | null, invoices: InvoiceLike[] = []) {
  const invoiceLookup = useMemo(() => {
    const map = new Map<string, InvoiceLookupRow>();
    for (const inv of invoices) {
      map.set(inv.id, {
        invoiceNumber: inv.invoiceNumber || inv.id,
        clientName: inv.clientName || '',
        amount: inv.amount,
        paymentMethod: inv.paymentMethod,
      });
    }
    return map;
  }, [invoices]);

  const [party, setParty] = useState(() =>
    entry ? resolveVoucherParty(entry, { invoiceLookup }) : { kind: '' as const, name: '' },
  );

  useEffect(() => {
    if (!entry) {
      setParty({ kind: '', name: '' });
      return;
    }

    const immediate = resolveVoucherParty(entry, { invoiceLookup });
    if (immediate.name) {
      setParty(immediate);
      return;
    }

    if (entry.sourceType !== 'order' || !entry.sourceId) {
      setParty(immediate);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(getFinanceDb(), 'orders', entry.sourceId));
        if (cancelled) return;
        if (!snap.exists()) {
          setParty(immediate);
          return;
        }
        const data = snap.data() || {};
        const resolved = resolveVoucherParty(entry, { invoiceLookup }, {
          clientId:
            data.customerId != null
              ? String(data.customerId)
              : data.clientId != null
                ? String(data.clientId)
                : undefined,
          clientName: String(data.customerName || data.clientName || ''),
        });
        setParty(resolved);
      } catch {
        if (!cancelled) setParty(immediate);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entry, entry?.id, entry?.sourceId, entry?.sourceType, entry?.memo, invoiceLookup]);

  return party;
}

export function useGlPresentationFromInvoices(
  invoices: InvoiceLike[],
  purchaseOrders: Parameters<typeof createGlPresentationContext>[0] = [],
  paymentOrders: Parameters<typeof createGlPresentationContext>[1] = [],
  expenses: Parameters<typeof createGlPresentationContext>[3] = [],
  accounts: Parameters<typeof createGlPresentationContext>[4] = [],
) {
  return useMemo(
    () => createGlPresentationContext(purchaseOrders, paymentOrders, invoices, expenses, accounts),
    [accounts, expenses, invoices, paymentOrders, purchaseOrders],
  );
}
