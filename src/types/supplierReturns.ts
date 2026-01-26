// Supplier Return Authorization (SRA) types

export type SupplierReturnStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'shipped'
  | 'received_by_supplier'
  | 'credited'
  | 'replaced'
  | 'rejected'
  | 'disputed';

export type SupplierReturnReason =
  | 'defective_on_arrival'
  | 'quality_below_standard'
  | 'damaged_in_transit'
  | 'wrong_item_shipped'
  | 'expired_goods'
  | 'partial_shipment'
  | 'invoice_discrepancy'
  | 'warranty_claim';

export interface SupplierReturnItem {
  rawMaterialId: string;
  materialName: string;
  sku: string;
  quantity: number;
  originalQuantity?: number;
  unitCost: number;
  unitPrice?: number; // alias for unitCost
  totalCost: number;
  lotNumber?: string;
  expiryDate?: string;
  defectDescription?: string;
  photos?: string[];
  warrantyStatus?: boolean;
  creditAmount?: number;
  replacementQuantity?: number;
  inspectionReport?: string;
  condition?: string; // Item condition
  reason?: string; // Return reason for this item
}

export interface SupplierReturn {
  id: string;
  sraNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string;
  purchaseId?: string; // alias for purchaseOrderId
  purchaseOrderNumber: string;
  storeId: string;
  requestDate: string;
  status: SupplierReturnStatus;
  returnItems: SupplierReturnItem[];
  items?: SupplierReturnItem[]; // alias for returnItems
  returnReason: SupplierReturnReason;
  reason?: SupplierReturnReason; // alias for returnReason
  claimType: 'warranty' | 'defective' | 'damaged_shipping' | 'wrong_item' | 'quality_issue';
  totalClaimAmount: number;
  totalAmount?: number; // alias for totalClaimAmount
  creditIssued?: number;
  creditedDate?: string;
  replacementOrderId?: string;
  trackingNumber?: string;
  shippingCost?: number;
  approvedBy?: string;
  processedBy?: string;
  notes?: string;
  supplierNotes?: string;
  resolutionType?: 'credit' | 'replacement' | 'partial_credit';
  resolutionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierCredit {
  id: string;
  sraId: string;
  supplierId: string;
  creditAmount: number;
  creditNoteNumber: string;
  issuedDate: string;
  expiryDate?: string;
  appliedAmount?: number;
  remainingBalance?: number;
  status: 'pending' | 'issued' | 'applied' | 'expired';
}
