-- Add refunds table for tracking all refund transactions

CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER NOT NULL,
    originalSaleDate TEXT,
    refundAmount REAL NOT NULL,
    refundType TEXT DEFAULT 'full' CHECK(refundType IN ('full', 'partial')),
    refundItems TEXT NOT NULL, -- JSON array of refunded items
    reason TEXT,
    approvedBy TEXT NOT NULL,
    approverUsername TEXT NOT NULL,
    approverRole TEXT NOT NULL,
    processedBy TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    receiptNumber TEXT,
    paymentMethod TEXT, -- How refund was issued (cash, card, etc)
    notes TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER,
    FOREIGN KEY (saleId) REFERENCES sales(id)
);

-- Add modification tracking to unpaid_orders (check if columns don't exist first)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we'll use a different approach: check pragma and add only if missing

-- Check if modified column exists, if not create a new table with it
CREATE TABLE IF NOT EXISTS unpaid_orders_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    status TEXT DEFAULT 'unpaid',
    customerName TEXT,
    customerPhone TEXT,
    items TEXT NOT NULL,
    totals TEXT NOT NULL,
    createdDate TEXT,
    paidDate TEXT,
    notes TEXT,
    cashierId TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER,
    modified INTEGER DEFAULT 0,
    modifiedAt INTEGER,
    modifiedBy TEXT
);

-- Copy data from old table if it exists and is different
-- For fresh installs, unpaid_orders won't have modified/modifiedAt/modifiedBy columns
INSERT OR IGNORE INTO unpaid_orders_new 
    (id, timestamp, status, customerName, customerPhone, items, totals, createdDate, paidDate, notes, cashierId, synced, synced_at, modified, modifiedAt, modifiedBy)
SELECT 
    id, timestamp, status, customerName, customerPhone, items, totals, createdDate, paidDate, notes, cashierId, synced, synced_at,
    0 as modified,    -- Default value for fresh installs
    NULL as modifiedAt,
    NULL as modifiedBy
FROM unpaid_orders;

-- Drop old table and rename new one
DROP TABLE IF EXISTS unpaid_orders;
ALTER TABLE unpaid_orders_new RENAME TO unpaid_orders;

-- Create indexes for refunds
CREATE INDEX IF NOT EXISTS idx_refunds_sale ON refunds(saleId);
CREATE INDEX IF NOT EXISTS idx_refunds_timestamp ON refunds(timestamp);
CREATE INDEX IF NOT EXISTS idx_refunds_approver ON refunds(approvedBy);
CREATE INDEX IF NOT EXISTS idx_unpaid_orders_modified ON unpaid_orders(modified);
