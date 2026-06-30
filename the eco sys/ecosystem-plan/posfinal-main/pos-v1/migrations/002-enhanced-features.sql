-- ===================================
-- AYN BEIRUT POS - ENHANCED FEATURES
-- Migration 002: Phonebook, Bill Payments, User Management, Settings
-- ===================================

-- Phonebook table (Client registry)
CREATE TABLE IF NOT EXISTS phonebook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    notes TEXT,
    totalSpent REAL DEFAULT 0,
    lastVisit INTEGER,
    createdAt INTEGER NOT NULL,
    createdBy INTEGER,
    cashierId TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER,
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_phonebook_phone ON phonebook(phone);
CREATE INDEX IF NOT EXISTS idx_phonebook_name ON phonebook(name);
CREATE INDEX IF NOT EXISTS idx_phonebook_lastVisit ON phonebook(lastVisit);
CREATE INDEX IF NOT EXISTS idx_phonebook_synced ON phonebook(synced);

-- Bill Payments table
CREATE TABLE IF NOT EXISTS bill_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billType INTEGER NOT NULL,
    billNumber TEXT,
    customerName TEXT,
    customerPhone TEXT,
    amount REAL NOT NULL,
    paymentMethod TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    receiptNumber TEXT,
    cashierId TEXT NOT NULL,
    notes TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bill_payments_timestamp ON bill_payments(timestamp);
CREATE INDEX IF NOT EXISTS idx_bill_payments_billType ON bill_payments(billType);
CREATE INDEX IF NOT EXISTS idx_bill_payments_customerPhone ON bill_payments(customerPhone);
CREATE INDEX IF NOT EXISTS idx_bill_payments_cashierId ON bill_payments(cashierId);
CREATE INDEX IF NOT EXISTS idx_bill_payments_synced ON bill_payments(synced);

-- Bill Types table (Default + Custom)
CREATE TABLE IF NOT EXISTS bill_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    icon TEXT NOT NULL,
    isDefault INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 0,
    isActive INTEGER DEFAULT 1,
    createdBy INTEGER,
    createdAt INTEGER,
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_bill_types_isActive ON bill_types(isActive);
CREATE INDEX IF NOT EXISTS idx_bill_types_sortOrder ON bill_types(sortOrder);

-- Insert default bill types
INSERT INTO bill_types (name, icon, isDefault, sortOrder, isActive) VALUES
('Electricity', '💡', 1, 1, 1),
('Water', '💧', 1, 2, 1),
('Phone', '📱', 1, 3, 1),
('Internet', '🌐', 1, 4, 1),
('Gas', '🔥', 1, 5, 1),
('Municipality', '🏛️', 1, 6, 1),
('Other', '📄', 1, 7, 1);

-- Company Info table (Single record for receipt header/footer)
CREATE TABLE IF NOT EXISTS company_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    companyName TEXT,
    phone TEXT,
    website TEXT,
    email TEXT,
    taxId TEXT,
    address TEXT,
    logo TEXT,
    updatedAt INTEGER,
    updatedBy INTEGER,
    FOREIGN KEY (updatedBy) REFERENCES users(id)
);

-- Insert empty company info record
INSERT INTO company_info (id, companyName, updatedAt) VALUES (1, NULL, strftime('%s', 'now'));

-- App Settings table (VPS config, sync settings, etc)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    category TEXT,
    updated_at INTEGER NOT NULL
);

-- Insert default app settings
INSERT INTO app_settings (key, value, category, updated_at) VALUES
('vps_endpoint', '', 'sync', strftime('%s', 'now')),
('api_key', '', 'sync', strftime('%s', 'now')),
('branch_id', '', 'sync', strftime('%s', 'now')),
('app_mode', 'sub', 'sync', strftime('%s', 'now')),
('sync_interval_minutes', '5', 'sync', strftime('%s', 'now')),
('sync_retry_count', '5', 'sync', strftime('%s', 'now')),
('backup_retention_days', '90', 'backup', strftime('%s', 'now')),
('backup_minimum_keep', '3', 'backup', strftime('%s', 'now'));

-- Update schema version
INSERT INTO schema_version (version, description, applied_at, applied_by)
VALUES (2, 'Enhanced features: Phonebook, Bill Payments, User Management, Company Info, App Settings', strftime('%s', 'now'), 'system');
