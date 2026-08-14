import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import {
  syncAccountPaymentReceiptAndGl,
  type AccountPaymentDoc,
} from '../services/paymentReceiptSync';

export const onAccountPaymentCreated = onDocumentCreated(
  'accountPayments/{paymentId}',
  async (event) => {
    const paymentId = event.params.paymentId;
    const data = event.data?.data();
    if (!data) return;

    const storeId = typeof data.storeId === 'string' ? data.storeId : '';
    if (!storeId) return;

    try {
      await syncAccountPaymentReceiptAndGl(paymentId, data as AccountPaymentDoc);
    } catch (err) {
      console.error('[onAccountPaymentCreated]', paymentId, err);
    }
  },
);
