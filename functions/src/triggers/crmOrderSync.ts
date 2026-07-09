import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { syncOrderToCrm, type OrderCrmPayload } from '../services/crmOrderSync';

/**
 * Mirror salesperson orders into Sales CRM (activities + client timeline).
 */
export const onOrderCreatedCrmSync = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data() as OrderCrmPayload | undefined;
    if (!data) return;

    try {
      await syncOrderToCrm(event.params.orderId, data);
    } catch (err) {
      console.error('[crmOrderSync] failed for order', event.params.orderId, err);
    }
  },
);
