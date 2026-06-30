-- Migration 019: Add partial payment support
-- Allows customers to make down payments and pay remaining balance later

-- Add partial payment columns to sales table
ALTER TABLE sales ADD COLUMN paymentStatus TEXT DEFAULT 'paid';
ALTER TABLE sales ADD COLUMN remainingBalance REAL DEFAULT 0;
ALTER TABLE sales ADD COLUMN downPayment REAL DEFAULT 0;

-- Create partial payments tracking table
CREATE TABLE IF NOT EXISTS partial_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER NOT NULL,
    amount REAL NOT NULL,
    paymentMethod TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    receiptNumber TEXT,
    cashierId INTEGER,
    notes TEXT,
    FOREIGN KEY(saleId) REFERENCES sales(id)
);

CREATE INDEX IF NOT EXISTS idx_partial_payments_saleId ON partial_payments(saleId);
CREATE INDEX IF NOT EXISTS idx_partial_payments_timestamp ON partial_payments(timestamp);

-- Update schema version (using applied_at column, not migrated_at)
INSERT OR REPLACE INTO schema_version (version, description, applied_at, applied_by) 
VALUES (19, 'Add partial payment support with down payments and balance tracking', strftime('%s', 'now'), 'system');
