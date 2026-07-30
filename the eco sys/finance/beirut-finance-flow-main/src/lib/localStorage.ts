import { Product, Service, ComposedProduct, Invoice, Estimate, PurchaseOrder, Receipt, Client, Supplier, CompanyProfile, calculateComposedProductCost } from '@/types';

const STORAGE_KEYS = {
  PRODUCTS: 'app_products',
  SERVICES: 'app_services',
  COMPOSED_PRODUCTS: 'app_composed_products',
  INVOICES: 'app_invoices',
  ESTIMATES: 'app_estimates',
  PURCHASE_ORDERS: 'app_purchase_orders',
  RECEIPTS: 'app_receipts',
  CLIENTS: 'app_clients',
  SUPPLIERS: 'app_suppliers',
  COMPANY: 'app_company',
};

// Generic storage helpers
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

// Products
export const getProducts = (): Product[] => getItem(STORAGE_KEYS.PRODUCTS, []);
export const saveProducts = (products: Product[]): void => setItem(STORAGE_KEYS.PRODUCTS, products);
export const addProduct = (product: Product): Product[] => {
  const products = getProducts();
  products.push(product);
  saveProducts(products);
  return products;
};
export const updateProduct = (id: string, updates: Partial<Product>): Product[] => {
  const products = getProducts();
  const index = products.findIndex(p => p.id === id);
  if (index !== -1) {
    products[index] = { ...products[index], ...updates, updatedAt: new Date().toISOString() };
    saveProducts(products);
  }
  return products;
};
export const deleteProduct = (id: string): Product[] => {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  return products;
};

// Services
export const getServices = (): Service[] => getItem(STORAGE_KEYS.SERVICES, []);
export const saveServices = (services: Service[]): void => setItem(STORAGE_KEYS.SERVICES, services);
export const addService = (service: Service): Service[] => {
  const services = getServices();
  services.push(service);
  saveServices(services);
  return services;
};
export const updateService = (id: string, updates: Partial<Service>): Service[] => {
  const services = getServices();
  const index = services.findIndex(s => s.id === id);
  if (index !== -1) {
    services[index] = { ...services[index], ...updates, updatedAt: new Date().toISOString() };
    saveServices(services);
  }
  return services;
};
export const deleteService = (id: string): Service[] => {
  const services = getServices().filter(s => s.id !== id);
  saveServices(services);
  return services;
};

// Composed Products (manufactured items)
export const getComposedProducts = (): ComposedProduct[] => getItem(STORAGE_KEYS.COMPOSED_PRODUCTS, []);
export const saveComposedProducts = (products: ComposedProduct[]): void => setItem(STORAGE_KEYS.COMPOSED_PRODUCTS, products);
export const addComposedProduct = (product: ComposedProduct): ComposedProduct[] => {
  const products = getComposedProducts();
  products.push(product);
  saveComposedProducts(products);
  return products;
};
export const updateComposedProduct = (id: string, updates: Partial<ComposedProduct>): ComposedProduct[] => {
  const products = getComposedProducts();
  const index = products.findIndex(p => p.id === id);
  if (index !== -1) {
    products[index] = { ...products[index], ...updates, updatedAt: new Date().toISOString() };
    saveComposedProducts(products);
  }
  return products;
};
export const deleteComposedProduct = (id: string): ComposedProduct[] => {
  const products = getComposedProducts().filter(p => p.id !== id);
  saveComposedProducts(products);
  return products;
};

// Manufacture composed product: deduct raw materials, increase composed product stock
export const manufactureComposedProduct = (
  composedProductId: string, 
  quantity: number
): { success: boolean; error?: string } => {
  const composedProducts = getComposedProducts();
  const composedIndex = composedProducts.findIndex(p => p.id === composedProductId);
  
  if (composedIndex === -1) {
    return { success: false, error: 'Composed product not found' };
  }
  
  const composedProduct = composedProducts[composedIndex];
  const rawProducts = getProducts();
  
  // Check if we have enough raw materials for all components
  for (const component of composedProduct.components) {
    const rawProduct = rawProducts.find(p => p.id === component.productId);
    if (!rawProduct) {
      return { success: false, error: `Component "${component.productName}" not found in inventory` };
    }
    const requiredQty = component.quantity * quantity;
    if (rawProduct.stockQuantity < requiredQty) {
      return { 
        success: false, 
        error: `Insufficient stock for "${component.productName}". Need ${requiredQty}, have ${rawProduct.stockQuantity}` 
      };
    }
  }
  
  // Deduct raw materials
  for (const component of composedProduct.components) {
    const productIndex = rawProducts.findIndex(p => p.id === component.productId);
    if (productIndex !== -1) {
      rawProducts[productIndex] = {
        ...rawProducts[productIndex],
        stockQuantity: rawProducts[productIndex].stockQuantity - (component.quantity * quantity),
        updatedAt: new Date().toISOString()
      };
    }
  }
  saveProducts(rawProducts);
  
  // Increase composed product stock
  composedProducts[composedIndex] = {
    ...composedProducts[composedIndex],
    stockQuantity: composedProducts[composedIndex].stockQuantity + quantity,
    updatedAt: new Date().toISOString()
  };
  saveComposedProducts(composedProducts);
  
  console.log(`[localStorage] Manufactured ${quantity}x ${composedProduct.name}`);
  return { success: true };
};

// Deduct stock for composed products
export const deductComposedProductStock = (composedProductId: string, quantity: number): { success: boolean; error?: string } => {
  const products = getComposedProducts();
  const productIndex = products.findIndex(p => p.id === composedProductId);
  
  if (productIndex === -1) {
    return { success: false, error: 'Composed product not found' };
  }
  
  const product = products[productIndex];
  if (product.stockQuantity < quantity) {
    return { success: false, error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}` };
  }
  
  products[productIndex] = {
    ...product,
    stockQuantity: product.stockQuantity - quantity,
    updatedAt: new Date().toISOString()
  };
  saveComposedProducts(products);
  return { success: true };
};

// Invoices
export const getInvoices = (): Invoice[] => getItem(STORAGE_KEYS.INVOICES, []);
export const saveInvoices = (invoices: Invoice[]): void => setItem(STORAGE_KEYS.INVOICES, invoices);
export const addInvoice = (invoice: Invoice): Invoice[] => {
  const invoices = getInvoices();
  invoices.push(invoice);
  saveInvoices(invoices);
  return invoices;
};
export const updateInvoice = (id: string, updates: Partial<Invoice>): Invoice[] => {
  const invoices = getInvoices();
  const index = invoices.findIndex(i => i.id === id);
  if (index !== -1) {
    invoices[index] = { ...invoices[index], ...updates, updatedAt: new Date().toISOString() };
    saveInvoices(invoices);
  }
  return invoices;
};
export const deleteInvoice = (id: string): Invoice[] => {
  const invoices = getInvoices().filter(i => i.id !== id);
  saveInvoices(invoices);
  return invoices;
};

// Estimates
export const getEstimates = (): Estimate[] => getItem(STORAGE_KEYS.ESTIMATES, []);
export const saveEstimates = (estimates: Estimate[]): void => setItem(STORAGE_KEYS.ESTIMATES, estimates);
export const addEstimate = (estimate: Estimate): Estimate[] => {
  const estimates = getEstimates();
  estimates.push(estimate);
  saveEstimates(estimates);
  return estimates;
};
export const updateEstimate = (id: string, updates: Partial<Estimate>): Estimate[] => {
  const estimates = getEstimates();
  const index = estimates.findIndex(e => e.id === id);
  if (index !== -1) {
    estimates[index] = { ...estimates[index], ...updates, updatedAt: new Date().toISOString() };
    saveEstimates(estimates);
  }
  return estimates;
};
export const deleteEstimate = (id: string): Estimate[] => {
  const estimates = getEstimates().filter(e => e.id !== id);
  saveEstimates(estimates);
  return estimates;
};

// Purchase Orders
export const getPurchaseOrders = (): PurchaseOrder[] => getItem(STORAGE_KEYS.PURCHASE_ORDERS, []);
export const savePurchaseOrders = (orders: PurchaseOrder[]): void => setItem(STORAGE_KEYS.PURCHASE_ORDERS, orders);
export const addPurchaseOrder = (order: PurchaseOrder): PurchaseOrder[] => {
  const orders = getPurchaseOrders();
  orders.push(order);
  savePurchaseOrders(orders);
  return orders;
};
export const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>): PurchaseOrder[] => {
  const orders = getPurchaseOrders();
  const index = orders.findIndex(o => o.id === id);
  if (index !== -1) {
    orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
    savePurchaseOrders(orders);
  }
  return orders;
};
export const deletePurchaseOrder = (id: string): PurchaseOrder[] => {
  const orders = getPurchaseOrders().filter(o => o.id !== id);
  savePurchaseOrders(orders);
  return orders;
};

// Receipts
export const getReceipts = (): Receipt[] => getItem(STORAGE_KEYS.RECEIPTS, []);
export const saveReceipts = (receipts: Receipt[]): void => setItem(STORAGE_KEYS.RECEIPTS, receipts);
export const addReceipt = (receipt: Receipt): Receipt[] => {
  const receipts = getReceipts();
  receipts.push(receipt);
  saveReceipts(receipts);
  return receipts;
};
export const deleteReceipt = (id: string): Receipt[] => {
  const receipts = getReceipts().filter(r => r.id !== id);
  saveReceipts(receipts);
  return receipts;
};

// Clients
export const getClients = (): Client[] => getItem(STORAGE_KEYS.CLIENTS, []);
export const saveClients = (clients: Client[]): void => setItem(STORAGE_KEYS.CLIENTS, clients);
export const addClient = (client: Client): Client[] => {
  const clients = getClients();
  clients.push(client);
  saveClients(clients);
  return clients;
};
export const deleteClient = (id: string): Client[] => {
  const clients = getClients().filter(c => c.id !== id);
  saveClients(clients);
  return clients;
};

// Suppliers
export const getSuppliers = (): Supplier[] => getItem(STORAGE_KEYS.SUPPLIERS, []);
export const saveSuppliers = (suppliers: Supplier[]): void => setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
export const addSupplier = (supplier: Supplier): Supplier[] => {
  const suppliers = getSuppliers();
  suppliers.push(supplier);
  saveSuppliers(suppliers);
  return suppliers;
};
export const deleteSupplier = (id: string): Supplier[] => {
  const suppliers = getSuppliers().filter(s => s.id !== id);
  saveSuppliers(suppliers);
  return suppliers;
};

// Company Profile
export const getCompanyProfile = (): CompanyProfile | null => getItem(STORAGE_KEYS.COMPANY, null);
export const saveCompanyProfile = (company: CompanyProfile): void => setItem(STORAGE_KEYS.COMPANY, company);

// Stock Management
export const deductStock = (itemId: string, quantity: number): { success: boolean; error?: string } => {
  const products = getProducts();
  const productIndex = products.findIndex(p => p.id === itemId);
  
  if (productIndex === -1) {
    return { success: true }; // Not a product, might be a service
  }
  
  const product = products[productIndex];
  if (product.stockQuantity < quantity) {
    return { success: false, error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}` };
  }
  
  products[productIndex] = {
    ...product,
    stockQuantity: product.stockQuantity - quantity,
    updatedAt: new Date().toISOString()
  };
  saveProducts(products);
  return { success: true };
};

export const addStock = (itemId: string, quantity: number): void => {
  const products = getProducts();
  const productIndex = products.findIndex(p => p.id === itemId);
  
  if (productIndex !== -1) {
    products[productIndex] = {
      ...products[productIndex],
      stockQuantity: products[productIndex].stockQuantity + quantity,
      updatedAt: new Date().toISOString()
    };
    saveProducts(products);
  }
};
