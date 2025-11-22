import { Product, Store, StoreAnnouncement } from '@/types/product';

export const STORES: Store[] = [
  {
    id: 'store1',
    name: 'Tech Gadgets',
    description: 'The latest in technology and gadgets for your everyday needs.',
    logo: 'https://ui-avatars.com/api/?name=Tech+Gadgets&background=38B2AC&color=fff',
    location: 'San Francisco, CA',
    website: 'https://example.com/techgadgets',
    socialLinks: {
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      twitter: 'https://twitter.com'
    },
    contactInfo: {
      phone: '(555) 123-4567',
      email: 'contact@techgadgets.com'
    },
    slogan: 'Innovation for Everyone',
    template: 'modern',
    ownerId: '1',
    isPremium: true,
    // allowsCredits removed
  },
  {
    id: 'store2',
    name: 'Outdoor Adventurers',
    description: 'Quality gear for all your outdoor adventures.',
    logo: 'https://ui-avatars.com/api/?name=Outdoor+Adventurers&background=2C5282&color=fff',
    location: 'Denver, CO',
    website: 'https://example.com/outdooradventurers',
    socialLinks: {
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com'
    },
    contactInfo: {
      phone: '(555) 987-6543',
      email: 'hello@outdooradventurers.com'
    },
    slogan: 'Explore Beyond Limits',
    template: 'default',
    ownerId: '2',
    isPremium: true,
    // allowsCredits removed
  },
  {
    id: 'store3',
    name: 'Artisan Crafts',
    description: 'Handmade crafts and artisanal products made with love.',
    logo: 'https://ui-avatars.com/api/?name=Artisan+Crafts&background=ED8936&color=fff',
    location: 'Portland, OR',
    website: 'https://example.com/artisancrafts',
    socialLinks: {
      instagram: 'https://instagram.com',
      twitter: 'https://twitter.com'
    },
    contactInfo: {
      email: 'create@artisancrafts.com'
    },
    slogan: 'Crafted with Passion',
    template: 'minimal',
    ownerId: '3',
    isPremium: true,
    // allowsCredits removed
  }
];

export const PRODUCTS: Product[] = [
  {
    id: 'prod1',
    name: 'Wireless Earbuds',
    description: 'High-quality wireless earbuds with noise cancellation.',
    price: 89.99,
    image: 'https://placehold.co/400x300/38B2AC/fff?text=Wireless+Earbuds',
    storeId: 'store1',
    category: 'Electronics',
    deliveryTime: '3-5 days',
    inStock: true,
    rating: 4.5
  },
  {
    id: 'prod2',
    name: 'Smart Watch',
    description: 'Track your fitness and stay connected with this modern smartwatch.',
    price: 199.99,
    image: 'https://placehold.co/400x300/38B2AC/fff?text=Smart+Watch',
    storeId: 'store1',
    category: 'Electronics',
    deliveryTime: '2-4 days',
    inStock: true,
    rating: 4.2
  },
  {
    id: 'prod3',
    name: 'Portable Charger',
    description: 'Never run out of battery with this high-capacity portable charger.',
    price: 49.99,
    image: 'https://placehold.co/400x300/38B2AC/fff?text=Portable+Charger',
    storeId: 'store1',
    category: 'Electronics',
    deliveryTime: '1-3 days',
    inStock: true,
    rating: 4.7
  },
  {
    id: 'prod4',
    name: 'Hiking Backpack',
    description: 'Durable, water-resistant backpack perfect for hiking and camping.',
    price: 79.99,
    image: 'https://placehold.co/400x300/2C5282/fff?text=Hiking+Backpack',
    storeId: 'store2',
    category: 'Outdoor Gear',
    deliveryTime: '4-6 days',
    inStock: true,
    rating: 4.8
  },
  {
    id: 'prod5',
    name: 'Camping Tent',
    description: 'Spacious 4-person tent that sets up in minutes.',
    price: 149.99,
    image: 'https://placehold.co/400x300/2C5282/fff?text=Camping+Tent',
    storeId: 'store2',
    category: 'Outdoor Gear',
    deliveryTime: '5-7 days',
    inStock: true,
    rating: 4.3
  },
  {
    id: 'prod6',
    name: 'Water Bottle',
    description: 'Insulated water bottle that keeps drinks cold for 24 hours.',
    price: 29.99,
    image: 'https://placehold.co/400x300/2C5282/fff?text=Water+Bottle',
    storeId: 'store2',
    category: 'Outdoor Gear',
    deliveryTime: '2-3 days',
    inStock: true,
    rating: 4.6
  },
  {
    id: 'prod7',
    name: 'Handmade Candle',
    description: 'Artisanal candle made with natural soy wax and essential oils.',
    price: 24.99,
    image: 'https://placehold.co/400x300/ED8936/fff?text=Handmade+Candle',
    storeId: 'store3',
    category: 'Home & Decor',
    deliveryTime: '5-7 days',
    inStock: true,
    rating: 4.9
  },
  {
    id: 'prod8',
    name: 'Ceramic Mug',
    description: 'Hand-thrown ceramic mug, perfect for your morning coffee.',
    price: 19.99,
    image: 'https://placehold.co/400x300/ED8936/fff?text=Ceramic+Mug',
    storeId: 'store3',
    category: 'Home & Decor',
    deliveryTime: '4-6 days',
    inStock: true,
    rating: 4.7
  },
  {
    id: 'prod9',
    name: 'Woven Basket',
    description: 'Hand-woven basket made from sustainable materials.',
    price: 39.99,
    image: 'https://placehold.co/400x300/ED8936/fff?text=Woven+Basket',
    storeId: 'store3',
    category: 'Home & Decor',
    deliveryTime: '6-8 days',
    inStock: true,
    rating: 4.4
  }
];

export const ANNOUNCEMENTS: StoreAnnouncement[] = [
  {
    id: 'ann1',
    storeId: 'store1',
    title: 'Summer Sale!',
    message: 'Get 20% off all electronics this summer. Limited time offer!',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2025-06-30'),
    isActive: true
  },
  {
    id: 'ann2',
    storeId: 'store2',
    title: 'New Hiking Gear',
    message: 'Check out our new hiking gear collection for your summer adventures!',
    startDate: new Date('2025-05-15'),
    endDate: new Date('2025-07-15'),
    isActive: true
  },
  {
    id: 'ann3',
    storeId: 'store3',
    title: 'Artisan Workshop',
    message: 'Join our virtual workshop and learn how to make your own candles!',
    startDate: new Date('2025-06-15'),
    endDate: new Date('2025-06-15'),
    isActive: true
  }
];

export const getProductsByStore = (storeId: string): Product[] => {
  return PRODUCTS.filter(product => product.storeId === storeId);
};

export const getStoreById = (storeId: string): Store | undefined => {
  return STORES.find(store => store.id === storeId);
};

export const getProductById = (productId: string): Product | undefined => {
  return PRODUCTS.find(product => product.id === productId);
};

export const searchProducts = (query: string): Product[] => {
  const lowercaseQuery = query.toLowerCase();
  return PRODUCTS.filter(
    product => 
      product.name.toLowerCase().includes(lowercaseQuery) || 
      product.description.toLowerCase().includes(lowercaseQuery)
  );
};

export const searchStores = (query: string): Store[] => {
  const lowercaseQuery = query.toLowerCase();
  return STORES.filter(
    store => 
      store.name.toLowerCase().includes(lowercaseQuery) || 
      store.description.toLowerCase().includes(lowercaseQuery)
  );
};

export const getAnnouncementsByStore = (storeId: string): StoreAnnouncement[] => {
  return ANNOUNCEMENTS.filter(announcement => 
    announcement.storeId === storeId && 
    announcement.isActive &&
    new Date() >= announcement.startDate &&
    new Date() <= announcement.endDate
  );
};
