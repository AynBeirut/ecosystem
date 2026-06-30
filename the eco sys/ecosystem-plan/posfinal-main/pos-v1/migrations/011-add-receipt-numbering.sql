-- Migration 011: Add Sequential Receipt Numbering System
-- This migration initializes receipt counters and auto-assigns receipt numbers to existing sales

-- Initialize receipt counters in system_settings
INSERT OR REPLACE INTO system_settings (key, value, updated_at)
VALUES ('sale_receipt_counter', '0', strftime('%s', 'now') * 1000);

INSERT OR REPLACE INTO system_settings (key, value, updated_at)
VALUES ('refund_receipt_counter', '0', strftime('%s', 'now') * 1000);

-- Auto-assign receipt numbers to existing sales without receipt numbers
-- Sales will be numbered in chronological order: SALE-000001, SALE-000002, etc.
UPDATE sales
SET receiptNumber = 'SALE-' || substr('000000' || (
    SELECT COUNT(*) + 1
    FROM sales s2
    WHERE s2.timestamp < sales.timestamp
), -6)
WHERE receiptNumber IS NULL;

-- Update the counter to match the highest assigned number
UPDATE system_settings
SET value = CAST((SELECT COUNT(*) FROM sales WHERE receiptNumber IS NOT NULL) AS TEXT),
    updated_at = strftime('%s', 'now') * 1000
WHERE key = 'sale_receipt_counter';

-- Log migration completion in sync_queue for audit trail
INSERT INTO sync_queue (operation, table_name, data, timestamp, synced)
VALUES (
    'INSERT',
    'system_settings',
    '{"migration": "011-add-receipt-numbering", "sale_counter": ' || (SELECT value FROM system_settings WHERE key = 'sale_receipt_counter') || ', "refund_counter": ' || (SELECT value FROM system_settings WHERE key = 'refund_receipt_counter') || '}',
    strftime('%s', 'now') * 1000,
    0
);
