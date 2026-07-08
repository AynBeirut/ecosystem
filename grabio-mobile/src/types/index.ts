export interface StorePaymentMethods {
  cashOnDelivery?: boolean;
  creditCard?: boolean;
  debitCard?: boolean;
  bankTransfer?: boolean;
  paypal?: boolean;
  applePay?: boolean;
  googlePay?: boolean;
  storeCredits?: boolean;
}

export interface Store {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  logo?: string;
  slug?: string;
  rating?: number;
  ratingCount?: number;
  ownerId: string;
  whatsappNumber?: string;
  whatsappBusiness?: string;
  location?: string;
  mainCurrency?: string;
  paymentMethods?: StorePaymentMethods;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image?: string;    // web field name
  imageUrl?: string; // mobile field name (both kept in sync)
  storeId: string;
  productType: 'simple' | 'service' | 'composed' | 'production' | 'finished_good';
  inStock: boolean;
  stock?: number;
  lowStockThreshold?: number;
  unit?: string;
  expiryDate?: string;
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
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'returned' | 'cancelled';
  createdAt: unknown;
  paymentMethod: string;
}

export type RootStackParamList = {
  Login: undefined;
  MainTabs: { screen?: keyof TabParamList } | undefined;
  CrmClientDetail: { clientId: string; clientName: string };
  StoreDetail: { storeId: string; storeName: string };
  ProductDetail: { product: Product; storeName: string };
  Cart: undefined;
  Checkout: undefined;
  OrderTracking: { orderId: string; storeId?: string };
  OrderList: undefined;
  OwnerDashboard: undefined;
  OwnerOrders: undefined;
  OwnerProducts: undefined;
  AddEditProduct: { productId?: string };
  Inventory: undefined;
  Expenses: undefined;
  CreateOrder: undefined;
  Customers: undefined;
  Purchases: undefined;
  Suppliers: undefined;
  AccountStatement: undefined;
  InvoiceManager: { path?: string } | undefined;
};

export type TabParamList = {
  Profile: undefined;
  Marketplace: undefined;
  MyOrders: undefined;
  Cart: undefined;
  OwnerTab: undefined;
  OwnerHome: undefined;
  OwnerCustomers: undefined;
  OwnerDashboard: undefined;
  CrmClients: undefined;
};
