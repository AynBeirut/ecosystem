-- =====================================================
-- MIGRATION 016: ADD REFUND TRACKING TO SALES
-- Links sales to refunds and updates stock_history
-- =====================================================

-- Step 1: Add refund tracking columns to sales table
ALTER TABLE sales ADD COLUMN refundId INTEGER;
ALTER TABLE sales ADD COLUMN refundedAt INTEGER;

-- Create index for refund lookups
CREATE INDEX IF NOT EXISTS idx_sales_refund ON sales(refundId);

-- Step 2: Update stock_history type enum to include 'refund'
-- SQLite doesn't support ALTER COLUMN on CHECK constraints
-- We need to recreate the table with updated constraint

-- Create new stock_history table with 'refund' type included
CREATE TABLE stock_history_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    oldStock REAL,
    newStock REAL NOT NULL,
    quantity REAL,
    reason TEXT,
    type TEXT CHECK(type IN ('add', 'remove', 'sale', 'adjustment', 'refund')),
    userId INTEGER,
    cashierId INTEGER
);

-- Copy existing data
INSERT INTO stock_history_temp 
SELECT id, productId, timestamp, oldStock, newStock, quantity, reason, type, userId, cashierId
FROM stock_history;

-- Drop old table
DROP TABLE stock_history;

-- Rename new table
ALTER TABLE stock_history_temp RENAME TO stock_history;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(productId);
CREATE INDEX IF NOT EXISTS idx_stock_history_timestamp ON stock_history(timestamp);

-- Step 3: Add foreign key index to refunds table (if not exists)
CREATE INDEX IF NOT EXISTS idx_refunds_sale ON refunds(saleId);

-- Step 4: Create view for sales with refund information
CREATE VIEW IF NOT EXISTS sales_with_refunds AS
SELECT 
    s.*,
    r.id as refund_id,
    r.refundAmount,
    r.refundType,
    r.refundItems,
    r.timestamp as refund_timestamp,
    r.reason as refund_reason,
    r.approverUsername as refund_approver
FROM sales s
LEFT JOIN refunds r ON s.refundId = r.id;

-- Step 5: Record schema version update
INSERT INTO schema_version (version, description, applied_at, applied_by)
VALUES (16, 'Add refund tracking to sales table and update stock_history type enum', 
        strftime('%s', 'now') * 1000, 'system');

-- Verification queries
SELECT '✅ Migration 016 applied successfully' as status;
SELECT 'Schema version: ' || MAX(version) as version FROM schema_version;
