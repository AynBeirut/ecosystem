export interface Store {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  slug?: string;
  rating?: number;
  ratingCount?: number;
  ownerId: string;
  whatsappNumber?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  storeId: string;
  productType: 'simple' | 'composed' | 'production' | 'finished_good';
  inStock: boolean;
  stock?: number;
  lowStockThreshold?: number;
  unit?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  storeId: string;
  storeName: string;
}

export interface Order {
  id: string;
  storeId: string;
  storeName: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{ productId: string; name: string; price: number; quantity: number }>;
  total: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  createdAt: any;
  paymentMethod: string;
}

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  StoreDetail: { storeId: string; storeName: string };
  ProductDetail: { product: Product; storeName: string };
  Cart: undefined;
  Checkout: undefined;
  OrderTracking: { orderId: string };
  OrderList: undefined;
  OwnerDashboard: undefined;
  OwnerOrders: undefined;
  OwnerProducts: undefined;
  AddEditProduct: { productId?: string };
};

export type TabParamList = {
  Marketplace: undefined;
  Favorites: undefined;
  MyOrders: undefined;
  Profile: undefined;
  OwnerTab: undefined;
};
