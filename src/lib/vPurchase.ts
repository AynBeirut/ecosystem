import {
  addDoc,
  collection,
  doc,
  getFirestore,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import { allocateInvoiceNumberWithTrial } from '@/lib/subscriptionEnforcement';
import type { PurchaseItem } from '@/types/inventory';

export type VPurchaseLine = {
  materialId: string;
  materialName: string;
  sku: string;
  unit: string;
  unitCost: number;
  quantity: number;
};

export type CreateVPurchaseInput = {
  storeId: string;
  userId: string;
  userName: string;
  userRole: string;
  supplierId: string;
  notes?: string;
  items: VPurchaseLine[];
  markPaid: boolean;
};

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

async function applyReceivedStock(
  storeId: string,
  items: PurchaseItem[],
): Promise<void> {
  const db = getFirestore();

  for (const item of items) {
    const receivedQty = Number(item.receivedQuantity || item.quantity || 0);
    const materialId = item.rawMaterialId;
    if (!materialId || receivedQty <= 0) continue;

    const unitCost = round4(Number(item.unitCost || item.unitPrice || 0));
    const materialRef = doc(db, 'rawMaterials', materialId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(materialRef);
      if (!snap.exists()) return;
      const data = snap.data() as { currentStock?: number; costPerUnit?: number; unit?: string; storeId?: string };
      if (data.storeId && data.storeId !== storeId) return;

      const freshStock = Number(data.currentStock || 0);
      const freshCost = Number(data.costPerUnit || 0);
      const newStock = freshStock + receivedQty;
      const currentValue = freshStock * freshCost;
      const newValue = receivedQty * unitCost;
      const newCostPerUnit =
        freshStock === 0 ? unitCost : newStock > 0 ? round4((currentValue + newValue) / newStock) : unitCost;

      tx.update(materialRef, {
        currentStock: newStock,
        costPerUnit: newCostPerUnit,
        unit: item.unit || data.unit || 'piece',
        updatedAt: new Date().toISOString(),
      });
    });
  }
}

export async function createVPurchase(
  input: CreateVPurchaseInput,
): Promise<{ id: string; invoiceNumber: string; total: number; paymentStatus: 'paid' | 'unpaid' }> {
  if (!input.storeId) throw new Error('Missing store');
  if (!input.supplierId) throw new Error('Select a supplier');
  if (!input.items.length) throw new Error('Add at least one material');

  const db = getFirestore();
  const invoiceNumber = await allocateInvoiceNumberWithTrial(db, input.storeId, 'purchase', 'PO');
  const markPaid = input.markPaid;

  const normalizedItems: PurchaseItem[] = input.items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitCost = Number(item.unitCost) || 0;
    return {
      itemType: 'raw_material',
      rawMaterialId: item.materialId,
      materialName: item.materialName,
      sku: item.sku || '',
      unit: item.unit || 'piece',
      quantity,
      unitCost,
      unitPrice: unitCost,
      subtotal: quantity * unitCost,
      receivedQuantity: markPaid ? quantity : 0,
    };
  });

  const subtotal = normalizedItems.reduce(
    (sum, item) => sum + item.quantity * (item.unitPrice || item.unitCost),
    0,
  );
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const purchaseData = {
    poNumber: invoiceNumber,
    invoiceNumber,
    supplierId: input.supplierId,
    orderDate: now,
    expectedDeliveryDate: today,
    status: markPaid ? ('received' as const) : ('draft' as const),
    receivedDate: markPaid ? now : null,
    items: normalizedItems,
    subtotal,
    taxType: 'none' as const,
    taxRate: 0,
    vat: 0,
    totalAmount: subtotal,
    totalCost: subtotal,
    notes: input.notes || '',
    paymentStatus: markPaid ? ('paid' as const) : ('unpaid' as const),
    amountPaid: markPaid ? subtotal : 0,
    remainingAmount: markPaid ? 0 : subtotal,
    paymentMethod: markPaid ? 'cash' : '',
    paymentDate: markPaid ? today : null,
    paymentNotes: markPaid ? 'V·Buy cash purchase' : 'V·Buy unpaid purchase',
    paymentHistory: markPaid
      ? [
          {
            id: `PMT-VPUR-${Date.now()}`,
            amount: subtotal,
            entryType: 'payment',
            date: today,
            method: 'cash',
            notes: 'V·Buy cash purchase',
            recordedBy: input.userId,
            recordedAt: now,
          },
        ]
      : [],
    storeId: input.storeId,
    createdAt: now,
    updatedAt: now,
    source: 'v-purchase',
    createdBy: { id: input.userId, name: input.userName, role: input.userRole },
  };

  const docRef = await addDoc(collection(db, 'purchases'), purchaseData);

  if (markPaid) {
    await applyReceivedStock(input.storeId, normalizedItems);
    await updateDoc(docRef, { updatedAt: new Date().toISOString() });
  }

  return {
    id: docRef.id,
    invoiceNumber,
    total: subtotal,
    paymentStatus: markPaid ? 'paid' : 'unpaid',
  };
}
