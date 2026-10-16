import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function allocateQuoteNumber(storeId: string): Promise<string> {
  const serialRef = doc(db, 'stores', storeId, 'travelSettings', 'quoteSerial');
  const day = todayKey();
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(serialRef);
    const data = snap.data() || {};
    const counters = (data.counters as Record<string, number>) || {};
    const next = (counters[day] || 0) + 1;
    const quoteNumber = `QT-${day}-${String(next).padStart(3, '0')}`;
    tx.set(
      serialRef,
      {
        counters: { ...counters, [day]: next },
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return quoteNumber;
  });
}
