export type ProductType = 'simple' | 'service' | 'composed';
export type ServiceBillingType = 'one-time' | 'monthly' | 'yearly';

export type Product = {
  id: string;
  name: string;
  slug?: string; // URL-friendly product identifier (e.g., 'iphone-15-pro')
  description: string;
  price: number;
  image: string;
  storeId: string;
  category: string;
  deliveryTime: string;
  inStock: boolean;
  stock?: number; // Stock quantity
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
  template: 'default' | 'modern' | 'minimal' | 'classic' | 'vibrant' | 'professional' | 'artistic';
  storeBackgroundImage?: string;
  carouselImages?: string[];
  galleryImages?: string[];
  customPages?: Array<{ id: string; name: string; order: number; image?: string; content?: string }>;
  templateColors?: { primary: string; secondary: string; accent: string };
  whatsappBusiness?: string;
  proEmail?: string;
  customDomain?: string;
  customDomainStatus?: 'pending' | 'active' | 'error';
  ownerId: string;
  isPremium: boolean;
  subscriptionTier?: 'trial' | 'starter' | 'pro' | 'business' | 'premium';
  subscriptionStatus?: 'active' | 'canceled' | 'past_due';
  status?: 'online' | 'offline';
  // Aggregated rating (denormalized) — optional
  rating?: number; // average rating
  ratingCount?: number; // number of reviews
};

export type PaymentMethod = 'visa' | 'mastercard' | 'paypal' | 'cash';

export type StoreAnnouncement = {
  id: string;
  storeId: string;
  title: string;
  message: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
};

export type UserRole = 'admin' | 'user' | 'sub_account';

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
