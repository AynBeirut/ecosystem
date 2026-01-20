// Supplier Return Reason Enum
export const SUPPLIER_RETURN_REASONS = [
  { value: 'defective_on_arrival', label: 'Defective on Arrival' },
  { value: 'quality_below_standard', label: 'Quality Below Standard' },
  { value: 'damaged_in_transit', label: 'Damaged in Transit' },
  { value: 'wrong_item_shipped', label: 'Wrong Item Shipped' },
  { value: 'expired_goods', label: 'Expired Goods' },
  { value: 'partial_shipment', label: 'Partial Shipment' },
  { value: 'invoice_discrepancy', label: 'Invoice Discrepancy' },
  { value: 'warranty_claim', label: 'Warranty Claim' },
] as const;

export type SupplierReturnReason = typeof SUPPLIER_RETURN_REASONS[number]['value'];
