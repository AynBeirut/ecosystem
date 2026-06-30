-- ===================================
-- AYN BEIRUT POS - PHONEBOOK ENHANCEMENTS
-- Migration 003: Add phonebook enhancements with data preservation
-- ===================================

-- Create new phonebook table with all columns
CREATE TABLE IF NOT EXISTS phonebook_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    address TEXT,
    category TEXT DEFAULT 'Regular',
    birthday TEXT,
    balance REAL DEFAULT 0,
    notes TEXT,
    totalSpent REAL DEFAULT 0,
    visitCount INTEGER DEFAULT 0,
    lastVisit INTEGER,
    createdBy TEXT,
    cashierId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);

-- Copy data from old table if it exists
INSERT INTO phonebook_new (id, name, phone, email, address, notes, totalSpent, lastVisit, createdBy, cashierId, createdAt, synced, synced_at)
SELECT id, name, phone, email, address, notes, totalSpent, lastVisit, createdBy, cashierId, createdAt, synced, synced_at
FROM phonebook;

-- Drop old table
DROP TABLE phonebook;

-- Rename new table
ALTER TABLE phonebook_new RENAME TO phonebook;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_phonebook_phone ON phonebook(phone);
CREATE INDEX IF NOT EXISTS idx_phonebook_name ON phonebook(name);
CREATE INDEX IF NOT EXISTS idx_phonebook_category ON phonebook(category);
CREATE INDEX IF NOT EXISTS idx_phonebook_balance ON phonebook(balance);
CREATE INDEX IF NOT EXISTS idx_phonebook_lastVisit ON phonebook(lastVisit);

-- Create phonebook history table for tracking interactions
CREATE TABLE IF NOT EXISTS phonebook_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('sale', 'payment', 'note', 'edit', 'visit')),
    description TEXT NOT NULL,
    amount REAL,
    metadata TEXT,
    createdBy TEXT,
    cashierId TEXT,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (clientId) REFERENCES phonebook(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_phonebook_history_clientId ON phonebook_history(clientId);
CREATE INDEX IF NOT EXISTS idx_phonebook_history_type ON phonebook_history(type);
CREATE INDEX IF NOT EXISTS idx_phonebook_history_createdAt ON phonebook_history(createdAt);

-- Update schema version
INSERT INTO schema_version (version, description, applied_at, applied_by)
VALUES (3, 'Enhanced phonebook with categories, birthday, balance, notes, and history tracking', strftime('%s', 'now'), 'system');

