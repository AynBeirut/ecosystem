-- ===================================
-- AYN BEIRUT POS - FIX SUPPLIERS/DELIVERIES AUTOINCREMENT
-- Migration 005: Recreate suppliers, deliveries, delivery_items, supplier_payments with proper AUTOINCREMENT
-- ===================================

-- Recreate suppliers table
CREATE TABLE IF NOT EXISTS suppliers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contactPerson TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    paymentTerms TEXT,
    balance REAL DEFAULT 0,
    notes TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);

-- Copy existing supplier data if table exists
INSERT INTO suppliers_new (id, name, contactPerson, phone, email, address, paymentTerms, balance, notes, createdAt, updatedAt, synced, synced_at)
SELECT id, name, contactPerson, phone, email, address, paymentTerms, balance, notes, createdAt, updatedAt, synced, synced_at
FROM suppliers WHERE 1;

-- Drop old and rename
DROP TABLE IF EXISTS suppliers;
ALTER TABLE suppliers_new RENAME TO suppliers;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Recreate deliveries table
CREATE TABLE IF NOT EXISTS deliveries_new (
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

-- Copy existing delivery data if table exists
INSERT INTO deliveries_new (id, supplierId, deliveryRef, invoiceNumber, deliveryDate, totalAmount, notes, receivedBy, createdAt, synced, synced_at)
SELECT id, supplierId, deliveryRef, invoiceNumber, deliveryDate, totalAmount, notes, receivedBy, createdAt, synced, synced_at
FROM deliveries WHERE 1;

-- Drop old and rename
DROP TABLE IF EXISTS deliveries;
ALTER TABLE deliveries_new RENAME TO deliveries;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_supplierId ON deliveries(supplierId);
CREATE INDEX IF NOT EXISTS idx_deliveries_deliveryDate ON deliveries(deliveryDate);

-- Recreate delivery_items table
CREATE TABLE IF NOT EXISTS delivery_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deliveryId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unitCost REAL NOT NULL,
    lineTotal REAL NOT NULL,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY (productId) REFERENCES products(id)
);

-- Copy existing data
INSERT INTO delivery_items_new (id, deliveryId, productId, quantity, unitCost, lineTotal)
SELECT id, deliveryId, productId, quantity, unitCost, lineTotal
FROM delivery_items WHERE 1;

-- Drop old and rename
DROP TABLE IF EXISTS delivery_items;
ALTER TABLE delivery_items_new RENAME TO delivery_items;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_delivery_items_deliveryId ON delivery_items(deliveryId);
CREATE INDEX IF NOT EXISTS idx_delivery_items_productId ON delivery_items(productId);

-- Recreate supplier_payments table
CREATE TABLE IF NOT EXISTS supplier_payments_new (
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

-- Copy existing data
INSERT INTO supplier_payments_new (id, supplierId, amount, paymentMethod, reference, notes, paidBy, paidAt, createdAt, synced, synced_at)
SELECT id, supplierId, amount, paymentMethod, reference, notes, paidBy, paidAt, createdAt, synced, synced_at
FROM supplier_payments WHERE 1;

-- Drop old and rename
DROP TABLE IF EXISTS supplier_payments;
ALTER TABLE supplier_payments_new RENAME TO supplier_payments;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplierId ON supplier_payments(supplierId);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_paidAt ON supplier_payments(paidAt);
