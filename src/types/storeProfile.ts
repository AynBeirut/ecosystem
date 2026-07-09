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
export type LogoPosition = 'left' | 'center' | 'right';
export type ContactFormStyle = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type RatingDisplayType = 'stars' | 'pill' | 'number' | 'card' | 'minimal';
export type AboutLayout = 'off' | 'left' | 'centered' | 'with-image';
export type PageLayout = 'contained' | 'full-width' | 'hybrid';
export type StoreCardStyle = 'standard' | 'full-width' | 'split' | 'minimal';
export type VisualStyle = 'rounded' | 'sharp' | 'mixed';
export type StoreSectionId = 'hero' | 'about' | 'announcements' | 'products' | 'gallery' | 'reviews' | 'contact';
export type SectionWidth = 'full' | 'half' | 'third';
export type SectionContainer = 'full-width' | 'contained' | 'wide'; // edge-to-edge, max-w-7xl centered, max-w-5xl centered
export type SectionPadding = 'none' | 'small' | 'medium' | 'large';
export type SectionAnimation = 'none' | 'fade' | 'slide-up' | 'zoom';

export interface StoreSectionOrder {
  id: StoreSectionId;
  enabled: boolean;
  order: number;
  width?: SectionWidth; // 'full' (1 per row), 'half' (2 per row), or 'third' (3 per row)
  
  // Elementor-style section styling
  container?: SectionContainer; // Container width: full-width, contained, wide
  showBackground?: boolean; // Show section background color
  showBorders?: boolean; // Show rounded corners and borders
  padding?: SectionPadding; // Section padding
  backgroundImage?: string; // Optional section background image URL
  animation?: SectionAnimation; // Section entrance animation style
  customCss?: string; // Optional CSS declarations (inline style format)
}

export interface DeliveryZoneSetting {
  id: number;
  name: string;
  radius: string;
  fee: string;
  time: string;
}

export interface DeliveryPartnerSetting {
  id: string;
  name: string;
  type: 'shipping' | 'local';
  active: boolean;
}

export interface StoreDeliverySettings {
  standardDelivery: boolean;
  expressDelivery: boolean;
  sameDay: boolean;
  pickup: boolean;
  standardTime: string;
  expressTime: string;
  sameDayTime: string;
  standardFee: string;
  expressFee: string;
  sameDayFee: string;
  freeShippingThreshold: string;
  deliveryRadius: string;
  workingDays: string;
  workingHours: string;
  specialInstructions: string;
  zones?: DeliveryZoneSetting[];
  deliveryPartners?: DeliveryPartnerSetting[];
  ownDeliveryEnabled?: boolean;
  defaultPickupCarrier?: string;
}

export interface MarketplaceIntegrationSetting {
  id: string;
  name: string;
  enabled: boolean;
  merchantId?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface DropshippingPartnerSetting {
  id: string;
  name: string;
  enabled: boolean;
  contactEmail?: string;
  webhookUrl?: string;
  notes?: string;
}

export interface PaymentGatewaySettings {
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
}

export interface StoreSeoSettings {
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
  lastSitemapSubmission?: {
    submittedAt?: string;
    sitemapUrl?: string;
    results?: Array<{
      target: string;
      ok: boolean;
      status?: number;
      detail?: string;
    }>;
  };
}

export interface MetaIntegrationSettings {
  pixelEnabled?: boolean;
  pixelId?: string;
  facebookPageUrl?: string;
  facebookAppId?: string;
  catalogId?: string;
  conversionApiToken?: string;
  conversionTrackingEnabled?: boolean;
  lastConversionEventAt?: string;
  lastConversionEventName?: string;
  adAccountId?: string;
  metaAdsEnabled?: boolean;
  lastMetaAdsCampaignId?: string;
  lastMetaAdsCampaignName?: string;
  lastMetaAdsCampaignAt?: string;
  lastMetaAdsCampaignStatus?: string;
  dynamicProductAdsEnabled?: boolean;
  dynamicProductAdsStatus?: 'enabled' | 'disabled' | 'error';
  dynamicProductAdsAudienceName?: string;
  dynamicProductAdsRetargetingWindowDays?: number;
  dynamicProductAdsMinimumEventCount?: number;
  lastDynamicProductAdsJobId?: string;
  lastDynamicProductAdsAt?: string;
  catalogFeedUrl?: string;
  lastCatalogSyncAt?: string;
  lastCatalogSyncJobId?: string;
  lastCatalogProductCount?: number;
  facebookShopEnabled?: boolean;
  facebookShopStatus?: 'connected' | 'pending' | 'error' | 'not_connected';
  facebookShopConnectedAt?: string;
  facebookShopLastConnectionJobId?: string;
  instagramShoppingEnabled?: boolean;
  instagramShoppingStatus?: 'connected' | 'pending' | 'error' | 'not_connected';
  instagramShoppingConnectedAt?: string;
  instagramShoppingLastConnectionJobId?: string;
}

export interface ServiceCatalogSettings {
  allowServiceProducts?: boolean;
  allowRecurringSubscriptions?: boolean;
  defaultServiceBillingType?: 'one-time' | 'monthly' | 'yearly';
  minimumServiceDurationMinutes?: number;
  defaultRenewalReminderDays?: number;
}

export interface SubscriptionBillingSettings {
  autoRenewEnabled?: boolean;
  retryFailedPayments?: boolean;
  maxRetryAttempts?: number;
  renewalGraceDays?: number;
  invoiceLeadDays?: number;
  preferredRenewalGateway?: 'whish' | 'stripe' | 'paypal' | 'manual';
}

export interface AiModelPricingSetting {
  modelId: string;
  label: string;
  provider: string;
  creditsPerUnit: number;
  unitLabel: string;
  costPerCreditUsd: number;
  active: boolean;
}

export interface AiIntegrationSettings {
  enabled?: boolean;
  assistantAccessMode?: 'owner-account';
  apiBaseUrl?: string;
  apiKey?: string;
  defaultModelId?: string;
  modelPricing?: AiModelPricingSetting[];
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
    salesCrm?: boolean;
    manufacturingBom?: boolean;
    extraStorageBlocks?: number;
  };
  crmSettings?: {
    noContactAlertDays?: number;
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
  exchangeRateMode?: 'manual' | 'auto';
  exchangeRateProvider?: string;
  exchangeRateBaseCurrency?: string;
  exchangeRateQuoteCurrency?: string;
  exchangeRateLastAutoUpdatedAt?: string;
  exchangeRateLastAutoStatus?: 'success' | 'error';
  exchangeRateLastAutoMessage?: string;
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
  template?: 'default' | 'modern' | 'minimalist' | 'minimal' | 'classic' | 'classic_ecom' | 'fashion_boutique' | 'food_restaurant' | 'tech_electronics' | 'vibrant' | 'professional' | 'artistic'; // Storefront template
  storeBackgroundImage?: string;
  carouselImages?: string[];
  galleryImages?: string[];
  customPages?: StorePage[];
  templateColors?: StoreTemplateColors;
  productDisplayType?: ProductDisplayType;
  productCardAnimation?: ProductCardAnimation;
  heroLayout?: HeroLayout;
  menuStyle?: MenuStyle;
  logoPosition?: LogoPosition;
  contactFormStyle?: ContactFormStyle;
  ratingDisplayType?: RatingDisplayType;
  aboutLayout?: AboutLayout;
  pageLayout?: PageLayout;
  storeCardStyle?: StoreCardStyle;
  visualStyle?: VisualStyle;
  sectionOrder?: StoreSectionOrder[];
  whatsappBusiness?: string; // WhatsApp Business number (international format, digits only)
  proEmail?: string;         // Email address to receive Contact Us messages
  customDomain?: string;     // Custom domain (e.g. "shop.client.com")
  customDomainStatus?: 'pending' | 'active' | 'error'; // Status of custom domain verification
  whishMode?: 'sandbox' | 'production';
  whishSuccessCallbackUrl?: string;
  whishFailureCallbackUrl?: string;
  whishLastCallbackValidationAt?: string;
  whishLastSmokeTestAt?: string;
  sslAutoProvisioningEnabled?: boolean;
  sslAutoProvisioningLastCheckedAt?: string;
  sslAutoProvisioningLastStatus?: 'pending' | 'active' | 'error';
  adminIpWhitelistEnabled?: boolean;
  adminIpAllowlist?: string[];
  // Product settings
  productCategories?: string[]; // Categories for composed products
  priceMultiplier?: number; // Default price multiplier for composed products (default: 2.5)
  // Delivery configuration
  deliverySettings?: StoreDeliverySettings;
  // Marketplace and dropshipping integrations
  marketplaceIntegrations?: MarketplaceIntegrationSetting[];
  dropshippingPartners?: DropshippingPartnerSetting[];
  paymentGatewaySettings?: PaymentGatewaySettings;
  seoSettings?: StoreSeoSettings;
  metaIntegrationSettings?: MetaIntegrationSettings;
  serviceCatalogSettings?: ServiceCatalogSettings;
  subscriptionBillingSettings?: SubscriptionBillingSettings;
  aiIntegrationSettings?: AiIntegrationSettings;
  aiCreditBalance?: number;
  // Ecosystem modular (Phase 0 — optional; legacy path unchanged when unset)
  pricingVersion?: 'legacy-v1' | 'modular-v2';
  businessWorkflow?: 'shop' | 'live_kitchen' | 'factory' | 'ngo' | 'freelancer' | 'custom';
  startingPackage?:
    | 'pkg_shop'
    | 'pkg_live_kitchen'
    | 'pkg_factory_flow'
    | 'pkg_ngo'
    | 'pkg_freelancer';
  enabledModules?: Record<string, boolean>;
  composedProductSource?: 'platform' | 'pos';
  seatCount?: number;
  posLocationCount?: number;
  legacyPlanSnapshot?: Record<string, unknown>;
  nextPlanPreset?: string;
  nextEnabledModules?: Record<string, boolean>;
  nextSeatCount?: number;
  nextPosLocationCount?: number;
  scheduledPlanMigrationAt?: string;
  entitlementBackfillAt?: string;
  packageDraftAppliedAt?: string;
  /** display = showcase only (no cart); commerce = full store checkout */
  storefrontMode?: 'display' | 'commerce';
  builderWizard?: {
    step?: string;
    siteIntent?: 'display' | 'blog' | 'ecommerce';
    businessIntent?: 'store' | 'restaurant' | 'manufacturer';
    buildMethod?: 'classic' | 'theme_editor' | 'wordpress' | 'import';
    wordpressRequestId?: string;
    updatedAt?: string;
  };
  // Migration tracking
  migrationVersion?: number;
  lastMigrationDate?: string;
}
