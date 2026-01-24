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
  reason: 'damage' | 'theft' | 'count_correction' | 'expired' | 'other';
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
