import { GL_ACCOUNT_CODES } from '@/lib/ledger/defaultChartOfAccounts';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type PurchaseReceiveItem = {
  quantity?: number;
  unitCost?: number;
  unitPrice?: number;
  rawPrice?: number;
  subtotal?: number;
};

export type PurchaseReceiveInput = {
  items?: PurchaseReceiveItem[];
  total?: number;
  totalCost?: number;
  totalAmount?: number;
  amount?: number;
  subtotal?: number;
  taxAmount?: number;
  vat?: number;
  taxType?: string;
  taxRate?: number;
};

export type PurchaseReceiveSplit = {
  apCredit: number;
  inventoryDebit: number;
  inputVatDebit: number;
};

export function sumPurchaseLinesExVat(items: PurchaseReceiveItem[] | undefined): number {
  let total = 0;
  for (const item of items || []) {
    const unitCost = round2(Number(item.rawPrice ?? item.unitCost ?? item.unitPrice ?? 0));
    const quantity = round2(Number(item.quantity || 0));
    total = round2(total + unitCost * quantity);
  }
  return total;
}

export function resolvePurchaseReceiveSplit(purchase: PurchaseReceiveInput): PurchaseReceiveSplit | null {
  const taxType = String(purchase.taxType || '').toUpperCase();
  const taxRate = Number(purchase.taxRate || 0);
  const lineExVat = sumPurchaseLinesExVat(purchase.items);

  let ttc = round2(
    Number(purchase.total ?? purchase.totalCost ?? purchase.totalAmount ?? purchase.amount ?? 0),
  );

  if (ttc <= 0 && taxType === 'VAT' && taxRate > 0 && lineExVat > 0) {
    ttc = round2(lineExVat * (1 + taxRate / 100));
  }
  if (ttc <= 0 && lineExVat > 0) ttc = lineExVat;
  if (ttc <= 0) return null;

  const headerSubtotal = round2(Number(purchase.subtotal || 0));
  let inventoryDebit = headerSubtotal > 0 ? headerSubtotal : lineExVat;

  if (taxType === 'VAT' && taxRate > 0 && lineExVat > 0 && headerSubtotal <= 0) {
    inventoryDebit = lineExVat;
  }

  let inputVatDebit = round2(Number(purchase.taxAmount ?? purchase.vat ?? 0));
  if (inputVatDebit <= 0 && headerSubtotal > 0 && ttc > headerSubtotal) {
    inputVatDebit = round2(ttc - headerSubtotal);
  }
  if (inputVatDebit <= 0 && taxType === 'VAT' && taxRate > 0 && inventoryDebit > 0 && ttc > inventoryDebit) {
    inputVatDebit = round2(ttc - inventoryDebit);
  }

  if (inputVatDebit > 0) {
    inventoryDebit = round2(ttc - inputVatDebit);
    if (inventoryDebit < 0) {
      inventoryDebit = 0;
      inputVatDebit = ttc;
    }
  } else {
    inventoryDebit = ttc;
    inputVatDebit = 0;
  }

  const check = round2(inventoryDebit + inputVatDebit);
  if (check !== ttc) {
    inventoryDebit = round2(ttc - inputVatDebit);
  }

  return { apCredit: ttc, inventoryDebit, inputVatDebit };
}

export const INPUT_VAT_CODE = GL_ACCOUNT_CODES.INPUT_VAT;
