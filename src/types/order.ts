export interface OrderItem {
  productId: string
  quantity: number
  price?: number
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
}

export interface Customer {
  id: string
  name?: string
  email?: string
  phone?: string
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
}
