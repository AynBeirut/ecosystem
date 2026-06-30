-- Migration 20: Add purchases table for inventory tracking
-- This table tracks purchases of raw materials and inventory items

CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplierName TEXT NOT NULL,
    supplierContact TEXT,
    itemName TEXT NOT NULL,
    quantity REAL NOT NULL,
    unitPrice REAL NOT NULL,
    totalCost REAL NOT NULL,
    paymentStatus TEXT DEFAULT 'unpaid' CHECK(paymentStatus IN ('paid', 'unpaid', 'partial')),
    paidAmount REAL DEFAULT 0,
    purchaseDate TEXT NOT NULL,
    dueDate TEXT,
    category TEXT,
    notes TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchaseDate);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(paymentStatus);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplierName);
