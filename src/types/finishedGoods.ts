// Finished Goods (Ready Stock) Inventory Types

export type ValuationMethod = 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE';

export type StockActionType = 'manufactured' | 'sold' | 'adjustment' | 'opening_balance' | 'return';

export interface StockTransaction {
  id: string;
  date: string;
  actionType: StockActionType;
  quantity: number;
  unitCost?: number; // Cost per unit at time of transaction
  totalCost?: number; // Total cost of transaction
  reason?: string; // Required for adjustments
  referenceId?: string; // Production batch ID, Order ID, etc.
  referenceNumber?: string; // Batch number, Invoice number, etc.
  userId: string;
  userName: string;
  batchDetails?: {
    batchId: string;
    batchNumber: string;
    quantity: number;
    costPerUnit: number;
    remainingQuantity: number; // For FIFO tracking
  };
}

export interface DualCurrencyValue {
  usd: number;
  lbp: number;
  exchangeRate: number;
  lastUpdated: string;
}

export interface FinishedGoodsItem {
  id: string;
  itemCode: string; // Auto-generated FG-001, FG-002, etc.
  productId: string; // Link to products collection
  composedProductId?: string; // Link to composedProducts collection
  recipeId?: string; // Link to recipes collection
  description: string;
  productName: string;
  unit: string; // kg, pieces, liters, etc.
  
  // Stock quantities
  openingBalance: number;
  quantityManufactured: number;
  quantitySold: number;
  quantityAdjusted: number; // Net adjustments (can be negative)
  currentBalance: number; // openingBalance + manufactured - sold + adjusted
  reorderPoint?: number;
  
  // Pricing and valuation
  costPrice: number; // Current average cost per unit (USD)
  sellingPrice: number; // Current selling price (USD)
  totalValue: number; // currentBalance * costPrice
  valuationMethod: ValuationMethod; // Default: FIFO
  
  // Service cost allocation (calculated automatically from expenses)
  serviceCostCalculated?: boolean;
  serviceCostMonth?: string; // Format: '2026-01'
  serviceCostRate?: number; // Rate per unit applied
  serviceCostTotal?: number; // Total service cost allocated to this item
  
  // Dual currency
  dualCurrency?: {
    costPrice: DualCurrencyValue;
    sellingPrice: DualCurrencyValue;
    totalValue: DualCurrencyValue;
  };
  
  // Transaction history (embedded)
  transactions: StockTransaction[];
  
  // FIFO batch tracking
  batchQueue: {
    batchId: string;
    batchNumber: string;
    quantity: number;
    costPerUnit: number;
    productionDate: string;
  }[];
  
  // Optional multi-location support (future)
  location?: string;
  warehouse?: string;
  
  // Expiry tracking
  expiryTracking?: boolean;
  expiryDate?: string;
  expiryAlertDays?: number; // days before expiry to alert (default 30)
  expiryNotifiedAt?: string; // ISO date of last expiry notification sent

  // Metadata
  storeId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastStocktakeDate?: string;
}

export interface FinishedGoodsAdjustment {
  finishedGoodsId: string;
  adjustmentType: 'increase' | 'decrease';
  quantity: number;
  reason: 'damage' | 'production_damage';
  reasonNotes?: string;
  newBalance: number;
}

export interface FinishedGoodsFilter {
  productId?: string;
  lowStock?: boolean; // currentBalance < reorderPoint
  dateFrom?: string;
  dateTo?: string;
  location?: string;
}

export interface StockMovementSummary {
  totalManufactured: number;
  totalSold: number;
  totalAdjustments: number;
  openingStock: number;
  closingStock: number;
  averageCost: number;
  totalValue: number;
}

export interface MonthlyServiceCost {
  id?: string;
  month: string; // Format: '2026-01'
  totalExpenses: number;
  totalProductionQty: number;
  totalProductionUnit: string; // 'kg', 'pcs', etc - main unit
  ratePerUnit: number;
  appliedToProducts: number; // Count of finished goods items updated
  calculatedAt: string;
  calculatedBy: string;
  calculatedByName: string;
  storeId: string;
  breakdown?: {
    expensesByCategory: Record<string, number>;
    productionByProduct: Record<string, { qty: number; unit: string }>;
  };
}
