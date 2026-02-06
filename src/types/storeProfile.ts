export interface StoreProfile {
  name: string;
  slug?: string; // URL-friendly store identifier (e.g., 'tech-gadgets')
  description: string;
  location: string;
  website: string;
  slogan: string;
  phone: string;
  email: string;
  facebook: string;
  instagram: string;
  twitter: string;
  logo: string;
  status: 'online' | 'offline'; // Store visibility status
  // Subscription & Add-ons
  subscriptionTier?: 'premium' | 'pro'; // Default premium (without composed), pro (with composed)
  addOns?: string[]; // ['pos', 'storage'] - Active add-ons
  // Multi-currency support
  mainCurrency?: string; // Main currency for calculations (USD, EUR, LBP)
  secondaryCurrency?: string; // Display currency
  customExchangeRate?: number; // Custom exchange rate
  // Tax configuration
  taxType?: 'none' | 'VAT' | 'TTC';
  taxRate?: number; // Default tax rate percentage
  taxNumber?: string; // Tax registration number
  // Staff limits
  maxSalesStaff?: number; // Default 5
  maxDeliveryStaff?: number; // Default 5
  // Loyalty program
  loyaltyEnabled?: boolean;
  pointsPerDollar?: number;
  // SKU configuration
  skuPrefix?: string; // Prefix for auto-generated SKUs
  // Invoice configuration
  invoiceNumberPrefix?: string; // Default: "INV"
  lastInvoiceNumber?: number; // Last used invoice number
  invoiceTemplate?: 'modern' | 'classic' | 'vibrant'; // Invoice design template
  // Product settings
  productCategories?: string[]; // Categories for composed products
  priceMultiplier?: number; // Default price multiplier for composed products (default: 2.5)
  // Migration tracking
  migrationVersion?: number;
  lastMigrationDate?: string;
}
