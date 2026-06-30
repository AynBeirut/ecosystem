-- ===================================
-- AYN BEIRUT POS - ADD PRODUCT COST COLUMN
-- Migration 004: Add cost column to products table for weighted average cost tracking
-- ===================================

-- Create new products table with cost column
CREATE TABLE IF NOT EXISTS products_new (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    cost REAL DEFAULT 0,
    icon TEXT,
    barcode TEXT UNIQUE,
    stock INTEGER DEFAULT 0,
    description TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);

-- Copy data from old table
INSERT INTO products_new (id, name, category, price, icon, barcode, stock, description, createdAt, updatedAt, synced, synced_at)
SELECT id, name, category, price, icon, barcode, stock, description, createdAt, updatedAt, synced, synced_at
FROM products;

-- Drop old table
DROP TABLE products;

-- Rename new table
ALTER TABLE products_new RENAME TO products;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_synced ON products(synced);
