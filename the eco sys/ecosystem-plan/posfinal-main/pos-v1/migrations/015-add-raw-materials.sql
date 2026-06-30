-- =====================================================
-- MIGRATION 015: ADD RAW MATERIALS WITH UNITS
-- Adds raw_material product type with unit support
-- Changes stock to REAL for decimal quantities
-- =====================================================

-- Step 1: Add raw_material to product type check constraint
-- SQLite doesn't support DROP CONSTRAINT or ALTER COLUMN
-- We use triggers to validate the new enum values

-- Add new constraint including raw_material
CREATE TRIGGER IF NOT EXISTS validate_product_type_insert
BEFORE INSERT ON products
FOR EACH ROW
WHEN NEW.type NOT IN ('item', 'service', 'raw_material')
BEGIN
    SELECT RAISE(ABORT, 'Invalid product type. Must be: item, service, or raw_material');
END;

CREATE TRIGGER IF NOT EXISTS validate_product_type_update
BEFORE UPDATE ON products
FOR EACH ROW
WHEN NEW.type NOT IN ('item', 'service', 'raw_material')
BEGIN
    SELECT RAISE(ABORT, 'Invalid product type. Must be: item, service, or raw_material');
END;

-- Step 2: Add unit column for raw materials
ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'pieces' 
    CHECK(unit IN ('kg', 'g', 'litre', 'ml', 'meter', 'cm', 'pieces'));

-- Step 3: Create new table with REAL stock column
CREATE TABLE products_new (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    cost REAL DEFAULT 0,
    type TEXT DEFAULT 'item',
    unit TEXT DEFAULT 'pieces' CHECK(unit IN ('kg', 'g', 'litre', 'ml', 'meter', 'cm', 'pieces')),
    icon TEXT,
    barcode TEXT UNIQUE,
    stock REAL DEFAULT 0,  -- Changed from INTEGER to REAL
    hourlyEnabled INTEGER DEFAULT 0,
    firstHourRate REAL DEFAULT 0,
    additionalHourRate REAL DEFAULT 0,
    description TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);

-- Copy data from old table
INSERT INTO products_new SELECT 
    id, name, category, price, cost, type, 
    COALESCE(unit, 'pieces') as unit,
    icon, barcode, 
    CAST(stock AS REAL) as stock,  -- Convert INTEGER to REAL
    hourlyEnabled, firstHourRate, additionalHourRate,
    description, createdAt, updatedAt, synced, synced_at
FROM products;

-- Drop old table and rename new one
DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_synced ON products(synced);

-- Step 4: Update stock_history table to support REAL quantities
CREATE TABLE stock_history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    oldStock REAL,  -- Changed from INTEGER to REAL
    newStock REAL NOT NULL,  -- Changed from INTEGER to REAL
    quantity REAL,  -- Changed from INTEGER to REAL
    reason TEXT,
    type TEXT CHECK(type IN ('add', 'remove', 'sale', 'adjustment')),
    userId INTEGER,
    cashierId INTEGER
);

-- Copy existing stock history data
INSERT INTO stock_history_new SELECT 
    id, productId, timestamp,
    CAST(oldStock AS REAL) as oldStock,
    CAST(newStock AS REAL) as newStock,
    CAST(quantity AS REAL) as quantity,
    reason, type, userId, cashierId
FROM stock_history;

-- Drop old table and rename
DROP TABLE stock_history;
ALTER TABLE stock_history_new RENAME TO stock_history;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(productId);
CREATE INDEX IF NOT EXISTS idx_stock_history_timestamp ON stock_history(timestamp);

-- Step 5: Update delivery_items to support REAL quantities
CREATE TABLE delivery_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deliveryId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity REAL NOT NULL,  -- Changed from INTEGER to REAL
    unitCost REAL NOT NULL,
    lineTotal REAL NOT NULL
);

-- Copy existing delivery data
INSERT INTO delivery_items_new SELECT 
    id, deliveryId, productId,
    CAST(quantity AS REAL) as quantity,
    unitCost, lineTotal
FROM delivery_items;

-- Drop old table and rename
DROP TABLE delivery_items;
ALTER TABLE delivery_items_new RENAME TO delivery_items;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(deliveryId);
CREATE INDEX IF NOT EXISTS idx_delivery_items_product ON delivery_items(productId);

-- Step 6: Record migration
INSERT INTO schema_version (version, description, applied_at, applied_by)
VALUES (15, 'Add raw materials with units and decimal stock support', datetime('now'), 'system');

-- Migration complete
SELECT 'Migration 015 completed successfully' as status;
