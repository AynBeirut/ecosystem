import * as admin from 'firebase-admin';

const db = admin.firestore();

type PaymentProvider = 'whish' | 'stripe' | 'square' | 'omt' | 'bob';

type NormalizedTier = 'trial' | 'starter' | 'pro' | 'business';

function normalizeTier(rawTier: unknown): NormalizedTier {
  if (typeof rawTier !== 'string') return 'starter';
  const tier = rawTier.toLowerCase();
  if (tier === 'premium') return 'starter';
  if (tier === 'trial' || tier === 'starter' || tier === 'pro' || tier === 'business') {
    return tier;
  }
  return 'starter';
}

function toMoney(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

export async function applyTrialRevenueShareIfNeeded(orderId: string, provider: PaymentProvider): Promise<void> {
  if (!orderId) {
    return;
  }

  await db.runTransaction(async (tx: unknown) => {
    const transaction = tx as {
      get: (ref: ReturnType<typeof db.collection> extends never ? never : FirebaseFirestore.DocumentReference) => Promise<{
        exists: boolean;
        data: () => Record<string, unknown>;
      }>;
      update: (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => void;
      set: (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }) => void;
    };
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      return;
    }

    const orderData = orderSnap.data() || {};
    if (orderData.trialRevenueShareAppliedAt) {
      return;
    }

    const storeId = String(orderData.storeId || '');
    if (!storeId) {
      return;
    }

    const storeRef = db.collection('storeProfiles').doc(storeId);
    const storeSnap = await transaction.get(storeRef);
    const storeData = storeSnap.exists ? (storeSnap.data() || {}) : {};

    const tier = normalizeTier(storeData.subscriptionTier);
    if (tier !== 'trial') {
      return;
    }

    const percentage = Number(storeData.revenueSharePercentage ?? storeData.revenue_share_percentage ?? 20);
    if (!Number.isFinite(percentage) || percentage <= 0) {
      return;
    }

    const paidAmount = toMoney(orderData.amountPaid ?? orderData.total);
    if (paidAmount <= 0) {
      return;
    }

    const shareAmount = toMoney((paidAmount * percentage) / 100);
    const nowIso = new Date().toISOString();

    transaction.update(orderRef, {
      trialRevenueShareAppliedAt: nowIso,
      trialRevenueShareAmount: shareAmount,
      trialRevenueSharePercentage: percentage,
      trialRevenueShareProvider: provider,
      updatedAt: nowIso,
    });

    transaction.set(
      storeRef,
      {
        trialRevenueShareTotal: admin.firestore.FieldValue.increment(shareAmount),
        trialRevenueShareLastAppliedAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  });
}
