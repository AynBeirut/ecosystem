export type ProductType = 'simple' | 'service' | 'composed';
export type StockUnitType = 'discrete' | 'continuous';
/** Same labels as rawMaterials.unit (kg, liter, piece, …) */
export type StockUnit = 'kg' | 'liter' | 'piece' | 'meter' | 'gram' | 'ml';
export type ServiceBillingType = 'one-time' | 'monthly' | 'yearly';
export type SupplierPlatform = 'shein' | 'alibaba' | 'amazon';
export type SupplierSyncStatus = 'ok' | 'error' | 'pending';

export type Product = {
  id: string;
  name: string;
  slug?: string; // URL-friendly product identifier (e.g., 'iphone-15-pro')
  description: string;
  price: number;
  image: string;
  imageAlt?: string;
  storeId: string;
  category: string;
  deliveryTime: string;
  inStock: boolean;
  stock?: number; // Stock quantity
  /** Whole-unit vs weight/volume; defaults to discrete when unset */
  stockUnitType?: StockUnitType;
  stockUnit?: StockUnit;
  rating?: number;
  productType?: ProductType; // Type of product
  sku?: string; // Stock Keeping Unit
  barcode?: string; // Barcode for scanning
  costPrice?: number; // Cost to produce/purchase
  margin?: number; // Profit margin percentage
  taxIncluded?: boolean; // Whether price includes tax
  // Service-specific fields
  serviceCost?: number;
  serviceDuration?: number; // Duration in minutes
  serviceBillingType?: ServiceBillingType;
  renewalReminderDays?: number;
  serviceProviderId?: string; // Staff member providing service
  // Composed product fields
  recipeId?: string; // Link to recipe for composed products
  // Expiry tracking
  expiryTracking?: boolean;
  expiryDate?: string;
  expiryAlertDays?: number; // days before expiry to alert (default 30)
  expiryNotifiedAt?: string; // ISO date of last expiry notification sent
  // Per-product dropship (Shein v1)
  supplierPlatform?: SupplierPlatform;
  supplierProductUrl?: string;
  supplierSyncEnabled?: boolean;
  supplierExternalId?: string;
  supplierLastSyncAt?: string;
  supplierLastSyncStatus?: SupplierSyncStatus;
  supplierLastSyncMessage?: string;
};

export type Store = {
  id: string;
  name: string;
  slug?: string; // URL-friendly store identifier
  description: string;
  logo: string;
  location: string;
  website?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  slogan?: string;
  aboutUs?: string;
  mission?: string;
  vision?: string;
  template: 'default' | 'modern' | 'minimalist' | 'minimal' | 'classic' | 'classic_ecom' | 'fashion_boutique' | 'food_restaurant' | 'tech_electronics' | 'vibrant' | 'professional' | 'artistic';
  storeBackgroundImage?: string;
  carouselImages?: string[];
  galleryImages?: string[];
  customPages?: Array<{ id: string; name: string; order: number; image?: string; content?: string }>;
  templateColors?: { primary: string; secondary: string; accent: string; background?: string; surface?: string; textColor?: string; highlight?: string };
  // Design settings (set via AdminTemplates tabs)
  productDisplayType?: 'grid-standard' | 'grid-large' | 'list' | 'masonry' | 'spotlight';
  productCardAnimation?: 'none' | 'parallax' | 'lift-3d' | 'glow-pulse' | 'slide-reveal' | 'zoom-tilt';
  heroLayout?: 'fullscreen' | 'split' | 'minimal' | 'centered';
  menuStyle?: 'classic' | 'centered' | 'bold' | 'sticky-glass' | 'hamburger';
  logoPosition?: 'left' | 'center' | 'right';
  contactFormStyle?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  ratingDisplayType?: 'stars' | 'pill' | 'number' | 'card' | 'minimal';
  aboutLayout?: 'off' | 'left' | 'centered' | 'with-image';
  sectionOrder?: Array<{ id: string; enabled: boolean; order: number }>;
  whatsappBusiness?: string;
  proEmail?: string;
  customDomain?: string;
  customDomainStatus?: 'pending' | 'active' | 'error';
  paymentGatewaySettings?: {
    whishEnabled?: boolean;
    stripeEnabled?: boolean;
    squareEnabled?: boolean;
    omtEnabled?: boolean;
    bobEnabled?: boolean;
    paypalEnabled?: boolean;
    bankTransferEnabled?: boolean;
    cashOnDeliveryEnabled?: boolean;
    preferredGateway?: 'whish' | 'stripe' | 'square' | 'omt' | 'bob' | 'paypal' | 'manual';
    stripePublishableKey?: string;
    squareLocationId?: string;
    omtReceiverName?: string;
    omtReceiverPhone?: string;
    bobReceiverName?: string;
    bobReceiverPhone?: string;
    paypalClientId?: string;
  };
  seoSettings?: {
    metaTitleSuffix?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalBaseUrl?: string;
    robotsIndex?: boolean;
    robotsFollow?: boolean;
    robotsDisallowPaths?: string[];
    robotsCustomDirectives?: string;
    ogImage?: string;
    twitterHandle?: string;
  };
  metaIntegrationSettings?: {
    pixelEnabled?: boolean;
    pixelId?: string;
    facebookPageUrl?: string;
    facebookAppId?: string;
    catalogId?: string;
    conversionApiToken?: string;
  };
  serviceCatalogSettings?: {
    allowServiceProducts?: boolean;
    allowRecurringSubscriptions?: boolean;
    defaultServiceBillingType?: 'one-time' | 'monthly' | 'yearly';
    minimumServiceDurationMinutes?: number;
    defaultRenewalReminderDays?: number;
  };
  subscriptionBillingSettings?: {
    autoRenewEnabled?: boolean;
    retryFailedPayments?: boolean;
    maxRetryAttempts?: number;
    renewalGraceDays?: number;
    invoiceLeadDays?: number;
    preferredRenewalGateway?: 'whish' | 'stripe' | 'paypal' | 'manual';
  };
  hasImportedDesign?: boolean; // Flag when store imports custom design (triggers white-label)
  ownerId: string;
  isPremium: boolean;
  subscriptionTier?: 'trial' | 'starter' | 'pro' | 'business' | 'premium';
  subscriptionStatus?: 'active' | 'canceled' | 'past_due';
  status?: 'online' | 'offline';
  /** display = showcase only (no cart); commerce = full checkout */
  storefrontMode?: 'display' | 'commerce';
  enabledModules?: Record<string, boolean>;
  // Aggregated rating (denormalized) — optional
  rating?: number; // average rating
  ratingCount?: number; // number of reviews
};

export type PaymentMethod = 'visa' | 'mastercard' | 'square' | 'omt' | 'bob' | 'paypal' | 'cash' | 'apple_pay' | 'google_pay' | 'bank_transfer';

export type StoreAnnouncement = {
  id: string;
  storeId: string;
  title: string;
  message: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
};

export type UserRole = 'admin' | 'user' | 'sub_account' | 'crm_rep';

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar: string;
  dailyAdsWatched: number;
  lastAdWatchDate?: string;
  storeId?: string;
  // Seller subscription properties
  isSeller?: boolean;
  sellerSince?: string;
  sellerIndex?: number;
  phone?: string;
  // List of followed store IDs
  following?: string[];
  // Sub-account properties
  subAccountId?: string;
  subAccountRole?: 'sales' | 'delivery' | 'manager';
  permissions?: string[];
  // Sales CRM rep (dedicated role — not sub_account permissions)
  crmRepId?: string;
};

export type StoreReview = {
  id?: string;
  storeId: string;
  userId: string;
  userName?: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
};

export type ProductReviewStatus = 'pending' | 'approved' | 'rejected';

export type ProductReview = {
  id?: string;
  storeId: string;
  productId: string;
  userId: string;
  userName?: string;
  rating: number;
  comment?: string;
  status: ProductReviewStatus;
  createdAt: string;
  moderatedAt?: string;
  moderatedBy?: string;
  orderId?: string;
};

export type AdWatchHistory = {
  id: string;
  userId: string;
  watchedAt: Date;
};

export type SubscriptionTier = {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
};

export type { ComposedProduct } from './inventory';
