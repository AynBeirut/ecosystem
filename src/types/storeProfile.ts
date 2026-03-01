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
  subscriptionStatus?: 'trial' | 'active' | 'grace' | 'expired' | 'blocked'; // Subscription status
  subscriptionPlan?: 'monthly' | 'yearly'; // Billing cycle
  subscriptionEndsAt?: string; // ISO 8601 date when subscription expires
  hasUsedTrial?: boolean; // Whether user has used trial before
  isLegacyUser?: boolean; // Legacy users get 1 year free
  legacyExpiresAt?: string; // When legacy access expires (Feb 28, 2027)
  gracePeriodStartedAt?: string; // When grace period started (7 days)
  blockedAt?: string; // When account was blocked
  billingHistory?: Array<{
    paymentId: string;
    amount: number;
    status: 'success' | 'failed' | 'refunded';
    type: 'trial' | 'subscription';
    createdAt: string;
  }>;
  expiryReminder30Sent?: boolean; // Whether 30-day reminder was sent
  expiryReminder7Sent?: boolean; // Whether 7-day reminder was sent
  expiryReminder3Sent?: boolean; // Whether 3-day reminder was sent
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
