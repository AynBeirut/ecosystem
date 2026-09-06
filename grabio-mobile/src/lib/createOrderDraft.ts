import AsyncStorage from '@react-native-async-storage/async-storage';

export type CreateOrderDraftItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
};

export type CreateOrderDraft = {
  customerName: string;
  customerPhone: string;
  customerSearch: string;
  selectedCustomerId?: string;
  orderItems: CreateOrderDraftItem[];
  paymentMethod: string;
  markPaid: boolean;
  scheduleEnabled: boolean;
  scheduledDateIso: string | null;
  scheduledTime: { hour: number; minute: number } | null;
  productSearch: string;
  savedAt: string;
};

function draftKey(storeId: string, userId: string): string {
  return `create_order_draft:${storeId}:${userId}`;
}

export function isDraftEmpty(draft: CreateOrderDraft): boolean {
  return (
    !draft.customerName.trim()
    && !draft.customerPhone.trim()
    && !draft.customerSearch.trim()
    && draft.orderItems.length === 0
    && !draft.scheduleEnabled
  );
}

export async function loadCreateOrderDraft(
  storeId: string,
  userId: string,
): Promise<CreateOrderDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(storeId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreateOrderDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      customerName: parsed.customerName || '',
      customerPhone: parsed.customerPhone || '',
      customerSearch: parsed.customerSearch || parsed.customerName || '',
      selectedCustomerId: parsed.selectedCustomerId,
      orderItems: Array.isArray(parsed.orderItems) ? parsed.orderItems : [],
      paymentMethod: parsed.paymentMethod || 'Cash',
      markPaid: parsed.markPaid !== false,
      scheduleEnabled: Boolean(parsed.scheduleEnabled),
      scheduledDateIso: parsed.scheduledDateIso || null,
      scheduledTime: parsed.scheduledTime || null,
      productSearch: parsed.productSearch || '',
      savedAt: parsed.savedAt || '',
    };
  } catch {
    return null;
  }
}

export async function saveCreateOrderDraft(
  storeId: string,
  userId: string,
  draft: CreateOrderDraft,
): Promise<void> {
  if (isDraftEmpty(draft)) {
    await clearCreateOrderDraft(storeId, userId);
    return;
  }
  await AsyncStorage.setItem(
    draftKey(storeId, userId),
    JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
  );
}

export async function clearCreateOrderDraft(storeId: string, userId: string): Promise<void> {
  await AsyncStorage.removeItem(draftKey(storeId, userId));
}
