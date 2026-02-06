export type ServicePaymentType = 'one-time' | 'monthly' | 'yearly';

export interface ComposedService {
  id: string;
  name: string;
  description: string;
  category: string;
  storeId: string;
  // Payment options
  paymentType: ServicePaymentType;
  oneTimePrice?: number; // For one-time services
  monthlyPrice?: number; // For monthly recurring
  yearlyPrice?: number; // For yearly recurring
  // Cost tracking
  materials?: { rawMaterialId: string; quantity: number }[];
  serviceCost: number; // Labor/operational cost
  totalCost: number; // Materials + serviceCost
  // Metadata
  icon?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ServiceSubscription {
  id: string;
  serviceId: string;
  serviceName: string;
  customerId: string;
  customerName: string;
  storeId: string;
  paymentType: 'monthly' | 'yearly';
  price: number;
  startDate: string;
  nextBillingDate: string;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}
