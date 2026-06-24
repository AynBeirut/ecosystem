export interface Product {
  id: string;
  type: 'product';
  name: string;
  sku?: string;
  rawCost: number;
  salePrice: number;
  stockQuantity: number;
  lowStockAlert: number;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  type: 'service';
  name: string;
  cost: number;
  salePrice: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

// Composed Product: manufactured internally using raw products + service cost
export interface ComposedProductComponent {
  productId: string;
  productName: string; // denormalized for display
  quantity: number;
  unitCost: number; // rawCost of component at time of creation
}

export interface ComposedProduct {
  id: string;
  type: 'composed';
  name: string;
  description?: string;
  sku?: string;
  components: ComposedProductComponent[]; // Raw materials
  serviceCost: number; // Labor, utilities, overhead
  stockQuantity: number;
  lowStockAlert: number;
  salePrice: number;
  createdAt: string;
  updatedAt: string;
}

// Calculated raw cost for composed product = sum(component.quantity * component.unitCost) + serviceCost
export const calculateComposedProductCost = (product: ComposedProduct): number => {
  const componentsCost = product.components.reduce(
    (sum, c) => sum + (c.quantity * c.unitCost), 
    0
  );
  return componentsCost + product.serviceCost;
};

export type InventoryItem = Product | Service | ComposedProduct;

export interface LineItem {
  id: string;
  itemId: string;
  itemType: 'product' | 'service' | 'composed';
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  rawCost: number;
  subtotal: number;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  clientId: string;
  clientName: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  invoiceId?: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentMethod: string;
  currency: string;
  createdAt: string;
}

export interface CompanyProfile {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  taxId?: string;
}
