export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  storeId: string;
  category: string;
  deliveryTime: string;
  inStock: boolean;
  stock?: number; // Stock quantity
  rating?: number;
};

export type Store = {
  id: string;
  name: string;
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
  template: 'default' | 'modern' | 'minimal';
  ownerId: string;
  isPremium: boolean;
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

export type UserRole = 'admin' | 'user';

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
