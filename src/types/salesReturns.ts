export interface SalesReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  originalQuantity?: number;
  price: number;
  subtotal: number;
  reason: string;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  orderId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: SalesReturnItem[];
  subtotal: number;
  refundAmount: number;
  returnDate: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  refundMethod?: 'cash' | 'bank_transfer' | 'store_credit' | 'original_payment';
  refundDate?: string;
  restockItems: boolean;
  notes?: string;
  storeId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCredit {
  id: string;
  customerId: string;
  customerName: string;
  creditAmount: number;
  usedAmount: number;
  remainingAmount: number;
  sourceReturnId: string;
  sourceReturnNumber: string;
  createdAt: string;
  expiryDate?: string;
  storeId: string;
}
