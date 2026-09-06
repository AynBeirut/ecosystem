import firestore from '@react-native-firebase/firestore';

export type ClientBalanceRow = {
  id: string;
  name: string;
  phone?: string;
  totalPurchases: number;
  totalPaid: number;
  balance: number;
  currency: string;
};

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function countsTowardClientBalance(status?: string): boolean {
  if (!status) return false;
  if (status === 'cancelled' || status === 'returned') return false;
  return ['delivered', 'paid', 'completed', 'confirmed', 'processing', 'ready'].includes(status);
}

export async function fetchClientBalances(storeId: string): Promise<ClientBalanceRow[]> {
  const snap = await firestore()
    .collection('orders')
    .where('storeId', '==', storeId)
    .get();

  const byKey = new Map<string, ClientBalanceRow>();

  snap.docs.forEach((doc) => {
    const order = doc.data();
    if (!countsTowardClientBalance(String(order.status || ''))) return;

    const customerId = String(order.customerId || order.customerName || doc.id).trim() || 'walk-in';
    const customerName = String(order.customerName || 'Walk-in customer').trim();
    const phone = order.customerPhone ? String(order.customerPhone) : undefined;
    const total = round2(Number(order.total) || 0);
    const paid =
      order.paymentStatus === 'paid'
        ? Math.max(total, round2(Number(order.amountPaid) || 0))
        : round2(Number(order.amountPaid) || 0);
    const currency = String(order.currency || 'USD');

    const key = customerId.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        id: customerId,
        name: customerName,
        phone,
        totalPurchases: total,
        totalPaid: paid,
        balance: round2(total - paid),
        currency,
      });
      return;
    }

    existing.totalPurchases = round2(existing.totalPurchases + total);
    existing.totalPaid = round2(existing.totalPaid + paid);
    existing.balance = round2(existing.totalPurchases - existing.totalPaid);
    if (!existing.phone && phone) existing.phone = phone;
  });

  return [...byKey.values()]
    .filter((r) => r.balance > 0.005)
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}
