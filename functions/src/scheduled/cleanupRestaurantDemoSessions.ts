import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/scheduler';

const db = admin.firestore();

const ENTITY_COLLECTIONS = ['products', 'guests', 'reservations', 'orders', 'documents', 'crmTasks'];

async function deleteSessionTree(sessionId: string): Promise<void> {
  for (const col of ENTITY_COLLECTIONS) {
    const snap = await db.collection('demoRestaurantSessions').doc(sessionId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
  await db.collection('demoRestaurantSessions').doc(sessionId).delete();
}

export const cleanupRestaurantDemoSessions = functions.scheduler.onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Beirut',
  },
  async () => {
    const nowIso = new Date().toISOString();
    const snap = await db
      .collection('demoRestaurantSessions')
      .where('expiresAt', '<=', nowIso)
      .limit(50)
      .get();

    for (const docSnap of snap.docs) {
      await deleteSessionTree(docSnap.id);
    }
  },
);
