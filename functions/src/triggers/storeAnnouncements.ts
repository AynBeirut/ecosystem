import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Firestore trigger: fires when a new announcement is created under a store.
 * Path: storeAnnouncements/{announcementId}
 * Sends FCM push to all customers who have that store in their favorites.
 */
export const onStoreAnnouncement = onDocumentCreated(
  {
    document: 'storeAnnouncements/{announcementId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const storeId: string = data.storeId || '';
    const title: string = data.title || '📢 Store Announcement';
    const message: string = data.message || '';
    if (!storeId || !message) return;

    // Get all users who favorited this store
    const favSnap = await db
      .collectionGroup('favorites')
      .where('storeId', '==', storeId)
      .get();

    if (favSnap.empty) return;

    // Collect unique user IDs (path: users/{userId}/favorites/{storeId})
    const userIds = new Set<string>();
    favSnap.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const pathParts = d.ref.path.split('/');
      // path = users/{userId}/favorites/{docId}
      if (pathParts.length >= 4 && pathParts[0] === 'users') {
        userIds.add(pathParts[1]);
      }
    });

    if (userIds.size === 0) return;

    // Gather all FCM tokens
    const allTokens: string[] = [];
    for (const uid of userIds) {
      const fcmSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
      fcmSnap.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (d.id) allTokens.push(d.id);
      });
    }

    if (allTokens.length === 0) return;

    // Send in batches of 500 (FCM multicast limit)
    for (let i = 0; i < allTokens.length; i += 500) {
      const batch = allTokens.slice(i, i + 500);
      try {
        await admin.messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title, body: message },
          data: { type: 'store_announcement', storeId },
          android: { priority: 'normal' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      } catch (err) {
        console.warn('FCM announcement batch failed:', err);
      }
    }

    console.log(`Store announcement sent to ${allTokens.length} device(s) for store ${storeId}`);
  },
);
