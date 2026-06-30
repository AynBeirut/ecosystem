-- ===================================
-- AYN BEIRUT POS - INITIAL SCHEMA
-- Migration 001: Create all base tables
-- ===================================

-- Schema version tracking table
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at INTEGER NOT NULL,
    applied_by TEXT
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    date TEXT NOT NULL,
    items TEXT NOT NULL,  -- JSON string
    totals TEXT NOT NULL, -- JSON string
    paymentMethod TEXT,
    customerInfo TEXT,    -- JSON string
    receiptNumber TEXT,
    cashierName TEXT,
    cashierId TEXT,
    notes TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_cashierId ON sales(cashierId);
CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(synced);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    icon TEXT,
    barcode TEXT UNIQUE,
    stock INTEGER DEFAULT 0,
    description TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_synced ON products(synced);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('cashier', 'manager', 'admin')),
    name TEXT,
    email TEXT,
    permissions TEXT, -- JSON array of permissions
    createdAt INTEGER,
    lastLogin INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    action TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    details TEXT, -- JSON string
    ipAddress TEXT,
    cashierId TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_activity_userId ON activity(userId);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity(action);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);

-- Stock history table
CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    oldStock INTEGER,
    newStock INTEGER NOT NULL,
    quantity INTEGER,
    reason TEXT,
    type TEXT CHECK(type IN ('add', 'remove', 'sale', 'adjustment')),
    userId INTEGER,
    cashierId TEXT,
    FOREIGN KEY (productId) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_stock_history_productId ON stock_history(productId);
CREATE INDEX IF NOT EXISTS idx_stock_history_timestamp ON stock_history(timestamp);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    totalSpent REAL DEFAULT 0,
    totalPurchases INTEGER DEFAULT 0,
    lastPurchase INTEGER,
    notes TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_lastPurchase ON customers(lastPurchase);

-- Suppliers table (for purchasing system)
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contactPerson TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    paymentTerms TEXT,
    balance REAL DEFAULT 0,  -- Negative = we owe supplier, Positive = supplier owes us
    notes TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Deliveries table (tracks stock receipts from suppliers)
CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplierId INTEGER NOT NULL,
    deliveryRef TEXT,
    invoiceNumber TEXT,
    deliveryDate INTEGER NOT NULL,
    totalAmount REAL DEFAULT 0,
    notes TEXT,
    receivedBy TEXT,
    createdAt INTEGER NOT NULL,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER,
    FOREIGN KEY (supplierId) REFERENCES suppliers(id)
);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplierId ON deliveries(supplierId);
CREATE INDEX IF NOT EXISTS idx_deliveries_deliveryDate ON deliveries(deliveryDate);

-- Delivery items table (line items in deliveries)
CREATE TABLE IF NOT EXISTS delivery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deliveryId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unitCost REAL NOT NULL,
    lineTotal REAL NOT NULL,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY (productId) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_delivery_items_deliveryId ON delivery_items(deliveryId);
CREATE INDEX IF NOT EXISTS idx_delivery_items_productId ON delivery_items(productId);

-- Supplier payments table (tracks payments to suppliers)
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplierId INTEGER NOT NULL,
    amount REAL NOT NULL,
    paymentMethod TEXT,
    reference TEXT,
    notes TEXT,
    paidBy TEXT,
    paidAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER,
    FOREIGN KEY (supplierId) REFERENCES suppliers(id)
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplierId ON supplier_payments(supplierId);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_paidAt ON supplier_payments(paidAt);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    icon TEXT,
    sortOrder INTEGER DEFAULT 0,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Unpaid orders table
CREATE TABLE IF NOT EXISTS unpaid_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'cancelled')),
    customerName TEXT,
    customerPhone TEXT,
    items TEXT NOT NULL,     -- JSON string
    totals TEXT NOT NULL,    -- JSON string
    createdDate TEXT NOT NULL,
    paidDate TEXT,
    notes TEXT,
    cashierId TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_unpaid_orders_timestamp ON unpaid_orders(timestamp);
CREATE INDEX IF NOT EXISTS idx_unpaid_orders_customerName ON unpaid_orders(customerName);
CREATE INDEX IF NOT EXISTS idx_unpaid_orders_status ON unpaid_orders(status);
CREATE INDEX IF NOT EXISTS idx_unpaid_orders_cashierId ON unpaid_orders(cashierId);

-- Sync queue table (for failed operations)
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON string
    timestamp INTEGER NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    synced INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Insert initial schema version
INSERT INTO schema_version (version, description, applied_at, applied_by)
VALUES (1, 'Initial schema with all 8 core tables + sync_queue + system_settings', strftime('%s', 'now'), 'system');

-- Insert default categories
INSERT INTO categories (name, displayName, icon, sortOrder) VALUES
('electronics', 'Electronics', '💻', 1),
('accessories', 'Accessories', '🎧', 2),
('software', 'Software', '📀', 3),
('other', 'Other', '📦', 4);

-- Insert default users (admin and cashier)
INSERT INTO users (id, username, password, name, role, createdAt) VALUES
(1, 'admin', 'admin123', 'Administrator', 'admin', strftime('%s', 'now')),
(2, 'manager', 'manager123', 'Manager', 'manager', strftime('%s', 'now')),
(3, 'cashier', 'cashier123', 'Cashier', 'cashier', strftime('%s', 'now'));
