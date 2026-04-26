// Customer Return Management (RMA) types

export type ReturnStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'received'
  | 'inspected'
  | 'refunded'
  | 'cancelled'
  | 'completed';

export type ReturnReason =
  | 'defective'
  | 'wrong_item'
  | 'damaged_shipping'
  | 'not_as_described'
  | 'changed_mind'
  | 'size_issue'
  | 'quality_issue'
  | 'arrived_late'
  | 'duplicate_order'
  | 'other';

export type ItemCondition = 'unopened' | 'opened' | 'damaged' | 'defective';

export interface ReturnRequest {
  id: string;
  rmaNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  storeId: string;
  requestDate: string;
  status: ReturnStatus;
  returnItems: ReturnItem[];
  items?: ReturnItem[]; // alias for returnItems
  reason?: ReturnReason;
  requestType?: 'refund' | 'exchange';
  customerNotes?: string;
  customerComments?: string; // alias for customerNotes
  adminNotes?: string;
  internalNotes?: string; // alias for adminNotes
  refundMethod: 'original_payment' | 'store_credit' | 'cash' | 'bank_transfer';
  refundAmount: number;
  returnTotalAmount?: number;
  exchangeTotalAmount?: number;
  netAmount?: number;
  netSettlementType?: 'payable' | 'refundable' | 'even';
  exchangeItems?: ExchangeItem[];
  exchangeProcessedDate?: string;
  refundDate?: string;
  approvedDate?: string;
  completedDate?: string;
  restockingFee: number;
  shippingCost: number;
  inspectionStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  processedBy?: string;
  linkedSraId?: string; // Link to supplier return if defective
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReturnItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  originalPrice: number;
  refundAmount: number;
  returnReason: ReturnReason;
  condition: ItemCondition;
  restockable: boolean;
  restockedQuantity?: number;
  images?: string[];
}

export interface RefundTransaction {
  id: string;
  rmaId: string;
  customerId?: string;
  amount: number;
  method: 'original_payment' | 'store_credit' | 'cash' | 'bank_transfer';
  reference?: string;
  processedDate: string;
  processedBy: string;
  status: 'pending' | 'completed' | 'failed';
  storeId: string;
}
