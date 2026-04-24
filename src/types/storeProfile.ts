export interface StorePage {
  id: string;
  name: string;
  order: number;
  image?: string;
  content?: string;
}

export interface StoreTemplateColors {
  primary: string;
  secondary: string;
  accent: string;
  background?: string;
  surface?: string;
  textColor?: string;
  highlight?: string;
  heroBg?: string;
  storeCardBg?: string;
  contentCardBg?: string;
  heroTextColor?: string;
  storeCardTextColor?: string;
  contentCardTextColor?: string;
}

export type ProductDisplayType = 'grid-standard' | 'grid-large' | 'list' | 'masonry' | 'spotlight';
export type ProductCardAnimation = 'none' | 'parallax' | 'lift-3d' | 'glow-pulse' | 'slide-reveal' | 'zoom-tilt';
export type HeroLayout = 'fullscreen' | 'split' | 'minimal' | 'centered';
export type MenuStyle = 'classic' | 'centered' | 'bold' | 'sticky-glass' | 'hamburger';
export type ContactFormStyle = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type RatingDisplayType = 'stars' | 'pill' | 'number' | 'card' | 'minimal';
export type AboutLayout = 'off' | 'left' | 'centered' | 'with-image';
export type StoreSectionId = 'hero' | 'about' | 'announcements' | 'products' | 'gallery' | 'reviews' | 'contact';
export type SectionWidth = 'full' | 'half';

export interface StoreSectionOrder {
  id: StoreSectionId;
  enabled: boolean;
  order: number;
  width?: SectionWidth; // 'full' (default) or 'half' for side-by-side layouts
}

export interface StoreProfile {
  name: string;
  slug?: string; // URL-friendly store identifier (e.g., 'tech-gadgets')
  description: string;
  location: string;
  website: string;
  slogan: string;
  aboutUs?: string;
  mission?: string;
  vision?: string;
  phone: string;
  email: string;
  facebook: string;
  instagram: string;
  twitter: string;
  logo: string;
  status: 'online' | 'offline'; // Store visibility status
  // Subscription & Add-ons
  subscriptionTier?: 'trial' | 'starter' | 'pro' | 'business' | 'premium'; // premium kept for backward compatibility
  addOns?: string[] | Record<string, unknown>; // ['domainPackage', 'whatsappBusiness'] or object map
  addOnsMeta?: {
    domainPackage?: boolean;
    whatsappBusiness?: boolean;
    manufacturingBom?: boolean;
    extraStorageBlocks?: number;
  };
  subscriptionStatus?: 'trial' | 'active' | 'grace' | 'expired' | 'blocked'; // Subscription status
  subscriptionPlan?: 'monthly' | 'yearly'; // Billing cycle
  subscriptionEndsAt?: string; // ISO 8601 date when subscription expires
  hasUsedTrial?: boolean; // Whether user has used trial before
  trialStartedAt?: string;
  trialEndsAt?: string;
  trial_start_date?: string;
  trial_end_date?: string;
  trialGraceDays?: number;
  trialGraceEndsAt?: string;
  productLimit?: number;
  storageLimitMb?: number;
  storage_limit_mb?: number;
  monthlyOperationsLimit?: number | null;
  monthly_operations_limit?: number | null;
  monthlyOperationsCount?: number;
  monthly_operations_count?: number;
  revenueSharePercentage?: number;
  revenue_share_percentage?: number;
  allowsComposedProducts?: boolean;
  allowsManufacturing?: boolean;
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
  template?: 'default' | 'modern' | 'minimal' | 'classic' | 'vibrant' | 'professional' | 'artistic'; // Storefront template
  storeBackgroundImage?: string;
  carouselImages?: string[];
  galleryImages?: string[];
  customPages?: StorePage[];
  templateColors?: StoreTemplateColors;
  productDisplayType?: ProductDisplayType;
  productCardAnimation?: ProductCardAnimation;
  heroLayout?: HeroLayout;
  menuStyle?: MenuStyle;
  contactFormStyle?: ContactFormStyle;
  ratingDisplayType?: RatingDisplayType;
  aboutLayout?: AboutLayout;
  sectionOrder?: StoreSectionOrder[];
  whatsappBusiness?: string; // WhatsApp Business number (international format, digits only)
  proEmail?: string;         // Email address to receive Contact Us messages
  customDomain?: string;     // Custom domain (e.g. "shop.client.com")
  customDomainStatus?: 'pending' | 'active' | 'error'; // Status of custom domain verification
  // Product settings
  productCategories?: string[]; // Categories for composed products
  priceMultiplier?: number; // Default price multiplier for composed products (default: 2.5)
  // Migration tracking
  migrationVersion?: number;
  lastMigrationDate?: string;
}
