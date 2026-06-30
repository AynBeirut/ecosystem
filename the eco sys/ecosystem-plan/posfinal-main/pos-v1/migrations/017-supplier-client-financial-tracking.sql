-- Migration 017: Supplier & Client Financial Tracking System
-- Add payment terms, balance caching, visit tracking, and settings

-- 1. Note: payment_terms_days column added via JavaScript with error handling

-- 2. Create supplier_balances_cache table for performance
CREATE TABLE IF NOT EXISTS supplier_balances_cache (
    supplier_id INTEGER PRIMARY KEY,
    total_purchases REAL DEFAULT 0,
    total_paid REAL DEFAULT 0,
    balance_owed REAL DEFAULT 0,
    last_delivery_date TEXT,
    last_payment_date TEXT,
    last_updated TEXT DEFAULT (datetime('now')),
    cache_expires_at TEXT DEFAULT (datetime('now', '+24 hours')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_balances_cache_expires ON supplier_balances_cache(cache_expires_at);
CREATE INDEX IF NOT EXISTS idx_supplier_balances_cache_balance ON supplier_balances_cache(balance_owed);

-- 3. Note: last_visit_date column added via JavaScript with error handling

-- Note: Cannot easily update last_visit_date from sales.customerInfo (JSON column)
-- This will be handled by application code when customers are linked to sales

CREATE INDEX IF NOT EXISTS idx_customers_last_visit ON customers(last_visit_date);

-- 4. Create settings table for configurable thresholds
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default visit threshold settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES 
    ('client_active_threshold_days', '30', 'Days threshold for marking clients as ACTIVE'),
    ('client_occasional_threshold_days', '90', 'Days threshold for marking clients as OCCASIONAL vs INACTIVE');

-- 5. Note: payment_terms_days defaults to 30 days, can be updated via UI

-- 6. Create function view for supplier status (for reporting)
CREATE VIEW IF NOT EXISTS supplier_status_view AS
SELECT 
    s.id,
    s.name,
    s.payment_terms_days,
    sbc.total_purchases,
    sbc.total_paid,
    sbc.balance_owed,
    sbc.last_delivery_date,
    CASE 
        WHEN sbc.last_delivery_date IS NOT NULL THEN
            date(sbc.last_delivery_date, '+' || s.payment_terms_days || ' days')
        ELSE NULL
    END as due_date,
    CASE
        WHEN sbc.balance_owed = 0 THEN 'PAID'
        WHEN sbc.last_delivery_date IS NOT NULL AND 
             date(sbc.last_delivery_date, '+' || s.payment_terms_days || ' days') < date('now') 
             AND sbc.balance_owed > 0 
        THEN 'OVERDUE'
        WHEN sbc.last_delivery_date IS NOT NULL AND 
             date(sbc.last_delivery_date, '+' || s.payment_terms_days || ' days') BETWEEN date('now') AND date('now', '+7 days')
             AND sbc.balance_owed > 0
        THEN 'DUE_SOON'
        ELSE 'CURRENT'
    END as status
FROM suppliers s
LEFT JOIN supplier_balances_cache sbc ON s.id = sbc.supplier_id;

-- 7. Create view for client status (for reporting)
CREATE VIEW IF NOT EXISTS client_status_view AS
SELECT 
    c.id,
    c.name,
    c.last_visit_date,
    CASE
        WHEN c.last_visit_date IS NULL THEN 'NEVER_VISITED'
        WHEN julianday('now') - julianday(c.last_visit_date) <= 
             (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'client_active_threshold_days')
        THEN 'ACTIVE'
        WHEN julianday('now') - julianday(c.last_visit_date) <= 
             (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'client_occasional_threshold_days')
        THEN 'OCCASIONAL'
        ELSE 'INACTIVE'
    END as status,
    CAST(julianday('now') - julianday(c.last_visit_date) AS INTEGER) as days_since_visit
FROM customers c;

-- 8. Note: Trigger for updating last_visit_date skipped as sales table uses JSON customerInfo
-- This will be handled by application code when customers are linked to sales

-- 9. Add payment_impact column to supplier_payments for tracking payment effectiveness
-- Note: Skipping as column may not be needed yet

-- 10. Note: Indexes already exist with camelCase naming from migration 001
-- Skipping duplicate index creation to avoid errors
