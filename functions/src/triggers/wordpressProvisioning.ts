import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import {
  provisionWordPressRequest,
  type WordPressRequestDoc,
} from '../services/wordpressProvisioningService';

export const onWordPressProvisioningRequestCreated = onDocumentCreated(
  'wordpressProvisioningRequests/{requestId}',
  async (event) => {
    const requestId = event.params.requestId;
    const data = event.data?.data();
    if (!data) return;

    try {
      await provisionWordPressRequest(requestId, data as WordPressRequestDoc);
    } catch (err) {
      console.error('[onWordPressProvisioningRequestCreated]', requestId, err);
    }
  },
);
