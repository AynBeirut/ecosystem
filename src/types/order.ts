export interface OrderItem {
  productId: string
  quantity: number
  price?: number
  productName?: string
  description?: string
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
  discountAmount?: number
}

export interface Order {
  id: string
  orderNumber?: string
  invoiceNumber?: string // Custom invoice number like INV-001
  storeId?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerTaxId?: string
  deliveryAddress?: string
  deliveryCity?: string
  deliveryNotes?: string
  invoiceNotes?: string
  deliveryMethod?: 'standard' | 'express' | 'same_day' | 'pickup'
  deliveryFee?: number
  estimatedDeliveryTime?: string
  deliveryWorkingHours?: string
  deliveryWorkingDays?: string
  fulfillmentLocationId?: string
  fulfillmentLocationName?: string
  routingScore?: number
  autoRouted?: boolean
  deliveryCoordinates?: { lat: number; lng: number }
  total?: number
  status?: string
  items?: OrderItem[]
  createdAt?: Date | string | number
  // Tax and discount fields
  subtotal?: number
  taxType?: 'none' | 'VAT' | 'TTC'
  taxRate?: number
  taxAmount?: number
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
  discountAmount?: number
  // Staff assignments
  assignedSalesPerson?: string
  assignedSalesPersonName?: string
  assignedDeliveryPerson?: string
  assignedDeliveryPersonName?: string
  // Payment tracking
  paymentStatus?: 'unpaid' | 'partial' | 'paid' | 'refunded'
  amountPaid?: number
  paymentDate?: string
  paymentMethod?: string
  paymentNotes?: string
  paymentHistory?: PaymentRecord[]
  createdBy?: string
  updatedAt?: string
  splitFromOrderId?: string
  splitToOrderIds?: string[]
  mergedIntoOrderId?: string
  mergedFromOrderIds?: string[]
  mergedAt?: string
  shippingLabelGeneratedAt?: string
  shippingLabelGeneratedBy?: string
  shippingBatchId?: string
  manifestId?: string
  pickupScheduledAt?: string
  pickupCarrier?: string
  pickupNotes?: string
  pickupStatus?: 'scheduled' | 'picked_up' | 'cancelled'
}

export interface PaymentRecord {
  id: string
  amount: number
  entryType?: 'payment' | 'refund'
  date: string
  method: string
  notes?: string
  recordedBy: string
  recordedAt: string
}

export interface Customer {
  id: string
  name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  taxId?: string
  createdAt?: Date | string | number
  // CRM fields
  totalOrders?: number
  lifetimeValue?: number
  loyaltyPoints?: number
  storeCredit?: number
  creditLimit?: number
  paymentTerms?: 'COD' | 'net_30' | 'net_60'
  tags?: string[]
  notes?: string
  lastOrderDate?: string
  // Sales CRM add-on
  storeId?: string
  pipelineStage?: string
  assignedRepId?: string | null
  nextFollowUpAt?: string | null
  dealValue?: number | null
  dealCurrency?: string
  lastActivityAt?: string | null
  lastActivityResult?: string | null
  crmEnabled?: boolean
  status?: 'active' | 'inactive' | 'suspended'
}
