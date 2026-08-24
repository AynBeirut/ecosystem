import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Product } from '@/types/product';
import { allocateInvoiceNumberWithTrial } from '@/lib/subscriptionEnforcement';
import { logAction } from '@/lib/auditLog';
import { resolveCachedWalkInCustomer } from '@/lib/vOpsCatalog';

export type VPosCartLine = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
};

export type VPosCustomerInput = {
  id?: string;
  name?: string;
  phone?: string;
};

export type CreateVPosOrderInput = {
  storeId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  items: VPosCartLine[];
  customer?: VPosCustomerInput;
  markPaid: boolean;
};

export type CreateVPosOrderResult = {
  orderId: string;
  invoiceNumber: string;
  total: number;
  customerName: string;
  paymentStatus: 'paid' | 'unpaid';
};

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function getProductSalePrice(product: Product & { sellingPrice?: number }) {
  return roundMoney(Number(product.sellingPrice || product.price || product.ownerReferencePrice || 0));
}

export function isVPosMenuProduct(product: Product & { vposMenuVisible?: boolean; sellingPrice?: number }) {
  if (product.vposMenuVisible === false) return false;
  return getProductSalePrice(product) > 0;
}

export async function generateStoreInvoiceNumber(storeId: string): Promise<string> {
  const db = getFirestore();
  return allocateInvoiceNumberWithTrial(db, storeId, 'invoice', 'INV');
}

async function resolveWalkInCustomer(storeId: string) {
  return resolveCachedWalkInCustomer(storeId);
}

async function resolveVPosCustomer(storeId: string, customer?: VPosCustomerInput) {
  if (customer?.id) {
    return {
      id: customer.id,
      name: customer.name?.trim() || 'Customer',
      phone: customer.phone?.trim() || '',
    };
  }

  const name = customer?.name?.trim() || '';
  const phone = customer?.phone?.trim() || '';

  if (!name && !phone) {
    return resolveWalkInCustomer(storeId);
  }

  const db = getFirestore();

  if (phone) {
    const byPhone = await getDocs(
      query(collection(db, 'customers'), where('storeId', '==', storeId), where('phone', '==', phone), limit(1)),
    );
    if (!byPhone.empty) {
      const docSnap = byPhone.docs[0];
      return {
        id: docSnap.id,
        name: name || String(docSnap.data().name || 'Customer'),
        phone,
      };
    }
  }

  const ref = await addDoc(collection(db, 'customers'), {
    storeId,
    name: name || 'Customer',
    phone: phone || '',
    email: '',
    createdAt: new Date().toISOString(),
    notes: 'Created from V·POS',
  });

  return { id: ref.id, name: name || 'Customer', phone };
}

export async function createVPosOrder(input: CreateVPosOrderInput): Promise<CreateVPosOrderResult> {
  if (!input.items.length) {
    throw new Error('Add at least one product');
  }

  const db = getFirestore();

  // Parallel: customer resolve + single txn (trial + invoice #).
  const [customer, invoiceNumber] = await Promise.all([
    resolveVPosCustomer(input.storeId, input.customer),
    allocateInvoiceNumberWithTrial(db, input.storeId, 'invoice', 'INV'),
  ]);

  const today = new Date().toISOString().split('T')[0];

  const items = input.items.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    price: roundMoney(line.price),
    description: '',
  }));

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const total = subtotal;
  const markPaid = input.markPaid;
  const nowIso = new Date().toISOString();

  const orderData = {
    storeId: input.storeId,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: '',
    customerTaxId: '',
    deliveryAddress: '',
    deliveryCity: '',
    invoiceNotes: '',
    deliveryNotes: '',
    deliveryMethod: 'pickup',
    deliveryFee: 0,
    estimatedDeliveryTime: '',
    invoiceNumber,
    items,
    subtotal,
    taxType: 'none',
    taxRate: 0,
    taxAmount: 0,
    discountType: 'percentage',
    discountValue: 0,
    discountAmount: 0,
    discount: 0,
    total,
    status: markPaid ? 'delivered' : 'pending',
    paymentStatus: markPaid ? ('paid' as const) : ('unpaid' as const),
    amountPaid: markPaid ? total : 0,
    remainingAmount: markPaid ? 0 : total,
    paymentDate: markPaid ? today : null,
    paymentMethod: markPaid ? 'cash' : '',
    paymentNotes: markPaid ? 'V·POS cash sale' : 'V·POS unpaid sale',
    paymentHistory: markPaid
      ? [
          {
            id: `PMT-VPOS-${Date.now()}`,
            amount: total,
            entryType: 'payment',
            date: today,
            method: 'cash',
            notes: 'V·POS cash sale',
            recordedBy: input.userId,
            recordedAt: nowIso,
          },
        ]
      : [],
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: input.userId,
    orderChannel: 'vpos',
  };

  const docRef = await addDoc(collection(db, 'orders'), orderData);

  // Non-blocking post-save work — return to UI immediately.
  void (async () => {
    try {
      const customerSnap = await getDoc(doc(db, 'customers', customer.id));
      if (customerSnap.exists()) {
        const data = customerSnap.data();
        await updateDoc(doc(db, 'customers', customer.id), {
          totalOrders: Number(data.totalOrders || 0) + 1,
          lifetimeValue: Number(data.lifetimeValue || 0) + total,
          lastOrderDate: nowIso,
        });
      }
    } catch {
      // ignore
    }
    try {
      await logAction(
        input.userId,
        input.userName || 'Staff',
        input.userRole || 'admin',
        'create',
        'order',
        docRef.id,
        { newValue: { invoiceNumber, total, orderChannel: 'vpos' } },
        input.storeId,
      );
    } catch {
      // ignore
    }
  })();

  return {
    orderId: docRef.id,
    invoiceNumber,
    total,
    customerName: customer.name,
    paymentStatus: markPaid ? 'paid' : 'unpaid',
  };
}
