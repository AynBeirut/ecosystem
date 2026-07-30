export type GrabioSubscriptionTier = 'trial' | 'starter' | 'pro' | 'business' | 'premium';

export type FinanceDocumentSettings = {
  primaryColor?: string;
  secondaryColor?: string;
  invoiceTemplate?: 'basic' | 'modern' | 'professional';
  signature?: string;
};

export type GrabioStoreProfile = {
  /** Primary display name (Grabio Admin Profile). */
  name?: string;
  /** Legacy bootstrap field — prefer `name`. */
  storeName?: string;
  logo?: string;
  location?: string;
  website?: string;
  description?: string;
  phone?: string;
  email?: string;
  contactInfo?: { phone?: string; email?: string };
  templateColors?: {
    primary?: string;
    secondary?: string;
    highlight?: string;
    accent?: string;
  };
  financeDocumentSettings?: FinanceDocumentSettings;
  subscriptionTier?: GrabioSubscriptionTier;
  subscriptionStatus?: 'trial' | 'active' | 'grace' | 'expired' | 'blocked' | string;
  pricingVersion?: 'legacy-v1' | 'modular-v2';
  startingPackage?: string;
  enabledModules?: Record<string, boolean>;
  addons?: string[];
  ownerId?: string;
  isDemo?: boolean;
  taxId?: string;
  commercialRegistry?: string;
  /** Base currency for calculations (synced from Grabio Admin Profile). */
  mainCurrency?: string;
  /** USD/LBP rate from Admin Profile (1 USD = X LBP). */
  customExchangeRate?: number;
  /** Large-number display style: 'full' (89,500,000) or 'compact' (89.5M). */
  numberFormat?: 'full' | 'compact';
  secondaryCurrency?: string;
  accountingMode?: 'international' | 'lebanese';
  accountingLanguage?: 'en' | 'ar' | 'bilingual';
  accountingModeLocked?: boolean;
  /** In-app help icons (Store Profile → System Preferences). */
  systemGuideEnabled?: boolean;
};

export type GrabioStoreContext = {
  storeId: string;
  profile: GrabioStoreProfile | null;
  role: 'owner' | 'admin' | 'member';
  loading: boolean;
};
