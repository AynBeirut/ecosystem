// Inventory management types

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  method: string;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: 'net_30' | 'net_60' | 'net_90' | 'cod';
  taxId?: string;
  bankDetails?: string;
  notes?: string;
  status: 'active' | 'inactive';
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unit: 'kg' | 'liter' | 'piece' | 'meter' | 'gram' | 'ml';
  currentStock: number;
  minimumThreshold: number;
  reorderPoint: number;
  costPerUnit: number;
  preferredSupplierId?: string;
  storageLocation?: string;
  expiryTracking: boolean;
  expiryDate?: string;
  warrantyPeriod?: number; // days
  warrantyStartDate?: string;
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  sku: string;
  description?: string;
  outputYield: number;
  outputQuantity?: number;
  outputUnit: string;
  ingredients: RecipeIngredient[];
  totalCost: number;
  costPerUnit: number;
  preparationInstructions?: string;
  instructions?: string;
  productionTime?: number; // minutes
  preparationTime?: number; // minutes
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  rawMaterialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface ComposedProduct {
  id: string;
  productId: string;
  recipeId: string;
  sku: string;
  barcode?: string;
  markup: number; // percentage
  markupPercentage?: number; // alias for markup
  suggestedPrice: number;
  costPrice?: number;
  sellingPrice?: number;
  storeId: string;
  createdAt: string;
  updatedAt: string;
  name?: string;
  productionCost?: number;
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  composedProductId: string;
  productId?: string; // alias for composedProductId
  recipeId: string;
  quantityProduced: number;
  productionDate: string;
  startDate?: string; // alias for productionDate
  staffId?: string;
  staffName?: string;
  assignedStaff?: any[]; // staff assignments
  rawMaterialsUsed: BatchMaterial[];
  qualityStatus: 'pending' | 'passed' | 'failed';
  expiryDate?: string;
  notes?: string;
  storeId: string;
  createdAt: string;
  scheduledDate?: string;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'high' | 'low' | 'normal' | 'urgent';
  quantity?: number;
  estimatedCompletionDate?: string;
  actualQuantity?: number;
  completionDate?: string;
  productName?: string;
  materialsCost?: number;
}

export type ProductionBatchStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface BatchMaterial {
  rawMaterialId: string;
  materialName: string;
  quantity: number;
  lotNumber?: string;
  cost: number;
}

export interface StockAdjustment {
  id: string;
  materialId: string;
  adjustmentType: 'purchase' | 'wastage' | 'production' | 'adjustment' | 'damaged' | 'return_to_supplier';
  quantity: number;
  reason: string;
  newStock: number;
  performedBy: string;
  storeId: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  purchaseOrderNumber: string;
  poNumber?: string; // alias for purchaseOrderNumber
  invoiceNumber?: string; // Custom PO number like PO-001
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  totalAmount?: number; // alias for total
  totalCost?: number; // alias for total
  status: 'draft' | 'ordered' | 'received' | 'cancelled' | 'sent' | 'confirmed';
  orderDate: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  invoiceUrl?: string;
  notes?: string;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  amountPaid?: number;
  paymentDate?: string;
  paymentMethod?: string;
  paymentNotes?: string;
  paymentHistory?: PaymentRecord[];
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  rawMaterialId: string;
  materialName: string;
  sku: string;
  unit?: string; // Unit from raw material (kg, liter, piece, etc.)
  quantity: number;
  unitCost: number;
  unitPrice?: number; // alias for unitCost
  subtotal: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  purchaseOrderNumber: string;
  poNumber?: string; // alias
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  totalAmount: number;
  totalCost?: number; // alias
  orderDate?: string;
  receivedDate?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'received' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// Re-export types from other modules for convenience
export type { SupplierReturn, SupplierReturnItem, SupplierCredit } from './supplierReturns';
