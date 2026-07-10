import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { isPlatformOrderCod } from '@/lib/salesRules';
import { glPostDeliveryWalletSettlement } from '@/lib/platformGl';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type PlatformDeliveryOrder = {
  id: string;
  storeId: string;
  invoiceNumber?: string;
  customerName?: string;
  total?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  amountPaid?: number;
  assignedDeliveryPerson?: string;
  assignedDeliveryPersonName?: string;
};

function personsCol(storeId: string) {
  return collection(getFirestore(), 'stores', storeId, 'deliveryPersons');
}

function ordersCol(storeId: string) {
  return collection(getFirestore(), 'stores', storeId, 'deliveryOrders');
}

function collectionsCol(storeId: string) {
  return collection(getFirestore(), 'stores', storeId, 'cashCollections');
}

function cashBalanceRef(storeId: string) {
  return doc(getFirestore(), 'stores', storeId, 'cashBalance', 'current');
}

const UNASSIGNED_PERSON_ID = 'unassigned-cod';

async function ensureUnassignedCourier(storeId: string) {
  const ref = doc(personsCol(storeId), UNASSIGNED_PERSON_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const now = new Date().toISOString();
  await setDoc(ref, {
    id: UNASSIGNED_PERSON_ID,
    name: 'Unassigned COD',
    phone: '—',
    walletBalance: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

/** Record COD cash with courier when Admin marks order delivered (GL already posted via sale-recognized). */
export async function syncCodOrderToDeliveryWallet(
  storeId: string,
  order: PlatformDeliveryOrder,
): Promise<void> {
  if (!isPlatformOrderCod(order)) return;

  const amount = round2(Number(order.total) || 0);
  if (amount <= 0) return;

  const deliveryPersonId = order.assignedDeliveryPerson || UNASSIGNED_PERSON_ID;
  const deliveryPersonName = order.assignedDeliveryPersonName || 'Unassigned COD';
  const now = new Date().toISOString();

  if (deliveryPersonId === UNASSIGNED_PERSON_ID) {
    await ensureUnassignedCourier(storeId);
  } else {
    const personRef = doc(personsCol(storeId), deliveryPersonId);
    const personSnap = await getDoc(personRef);
    if (!personSnap.exists()) {
      await setDoc(personRef, {
        id: deliveryPersonId,
        name: deliveryPersonName || 'Courier',
        phone: '—',
        walletBalance: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const orderRef = doc(ordersCol(storeId), order.id);
  const existing = await getDoc(orderRef);
  if (existing.exists() && existing.data()?.returnedAt) return;
  if (existing.exists() && existing.data()?.status === 'paid' && existing.data()?.collectedAt) return;

  await runTransaction(getFirestore(), async (tx) => {
    const personSnap = await tx.get(doc(personsCol(storeId), deliveryPersonId));
    const prevBalance = round2(Number(personSnap.data()?.walletBalance) || 0);
    const balRef = cashBalanceRef(storeId);
    const balSnap = await tx.get(balRef);
    const held = round2(Number(balSnap.data()?.deliveryHeldCash) || 0);

    tx.set(orderRef, {
      id: order.id,
      platformOrderId: order.id,
      invoiceId: order.id,
      invoiceNumber: order.invoiceNumber || order.id,
      deliveryPersonId,
      deliveryPersonName,
      clientName: order.customerName || 'Customer',
      amount,
      status: 'paid',
      source: 'platform',
      assignedAt: existing.exists() ? existing.data()?.assignedAt || now : now,
      deliveredAt: now,
      collectedAt: now,
      createdAt: existing.exists() ? existing.data()?.createdAt || now : now,
      updatedAt: now,
    }, { merge: true });

    tx.set(doc(personsCol(storeId), deliveryPersonId), {
      walletBalance: prevBalance + amount,
      updatedAt: now,
    }, { merge: true });

    tx.set(balRef, {
      deliveryHeldCash: held + amount,
      lastUpdated: now,
    }, { merge: true });
  });
}

export async function settleDeliveryWalletOrders(
  storeId: string,
  deliveryPersonId: string,
  orderIds: string[],
  destination: 'cash' | 'bank' = 'cash',
  notes?: string,
): Promise<string> {
  const personRef = doc(personsCol(storeId), deliveryPersonId);
  const personSnap = await getDoc(personRef);
  if (!personSnap.exists()) throw new Error('Delivery person not found');

  const ordersSnap = await getDocs(ordersCol(storeId));
  const ordersToSettle = ordersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((o) => orderIds.includes(o.id) && o.status === 'paid' && !o.returnedAt);

  const totalAmount = round2(ordersToSettle.reduce((sum, o) => sum + round2(Number(o.amount) || 0), 0));
  if (totalAmount <= 0) throw new Error('No orders to settle');

  const person = personSnap.data();
  if (totalAmount > round2(Number(person.walletBalance) || 0)) {
    throw new Error('Settlement exceeds courier wallet balance');
  }

  const now = new Date().toISOString();
  const settlementId = `DWST-${Date.now()}`;

  await glPostDeliveryWalletSettlement(storeId, settlementId, totalAmount, now, destination);

  await runTransaction(getFirestore(), async (tx) => {
    const pSnap = await tx.get(personRef);
    const balRef = cashBalanceRef(storeId);
    const balSnap = await tx.get(balRef);
    const cashBal = balSnap.exists() ? balSnap.data() : {};

    tx.set(personRef, {
      walletBalance: round2(Number(pSnap.data()?.walletBalance) || 0) - totalAmount,
      updatedAt: now,
    }, { merge: true });

    for (const order of ordersToSettle) {
      tx.set(doc(ordersCol(storeId), order.id), {
        returnedAt: now,
        updatedAt: now,
      }, { merge: true });
    }

    tx.set(doc(collectionsCol(storeId), settlementId), {
      id: settlementId,
      deliveryPersonId,
      deliveryPersonName: person.name || 'Courier',
      orderIds,
      totalAmount,
      collectedAt: now,
      destination,
      notes: notes || null,
      source: 'platform',
      createdAt: now,
    });

    const held = round2(Number(cashBal.deliveryHeldCash) || 0);
    const cashOnHand = round2(Number(cashBal.cashOnHand) || 0);
    const bankBalance = round2(Number(cashBal.bankBalance) || 0);
    tx.set(balRef, {
      deliveryHeldCash: held - totalAmount,
      cashOnHand: destination === 'cash' ? cashOnHand + totalAmount : cashOnHand,
      bankBalance: destination === 'bank' ? bankBalance + totalAmount : bankBalance,
      lastUpdated: now,
    }, { merge: true });
  });

  return settlementId;
}

export async function loadDeliveryWalletSummary(storeId: string) {
  const [personsSnap, ordersSnap, collectionsSnap, balSnap] = await Promise.all([
    getDocs(personsCol(storeId)),
    getDocs(ordersCol(storeId)),
    getDocs(collectionsCol(storeId)),
    getDoc(cashBalanceRef(storeId)),
  ]);

  const deliveryPersons = personsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string; name: string; phone?: string; walletBalance: number; isActive?: boolean;
  }>;
  const deliveryOrders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string; deliveryPersonId: string; deliveryPersonName?: string; clientName?: string;
    amount: number; status: string; returnedAt?: string; invoiceNumber?: string; platformOrderId?: string;
  }>;
  const cashCollections = collectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const pendingCash = round2(deliveryPersons.reduce((s, p) => s + round2(Number(p.walletBalance) || 0), 0));

  return {
    deliveryPersons,
    deliveryOrders,
    cashCollections,
    cashBalance: balSnap.data() || {},
    pendingCash,
  };
}
