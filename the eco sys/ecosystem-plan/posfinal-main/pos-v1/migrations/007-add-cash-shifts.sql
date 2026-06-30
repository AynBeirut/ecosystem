-- Add cash drawer shift management
-- Tracks cashier shifts, opening/closing cash, and reconciliation

CREATE TABLE IF NOT EXISTS cash_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cashierId TEXT NOT NULL,
    cashierName TEXT NOT NULL,
    openTime INTEGER NOT NULL,
    closeTime INTEGER,
    openingCash REAL NOT NULL,
    closingCash REAL,
    expectedCash REAL,
    difference REAL,
    totalSales REAL DEFAULT 0,
    totalCash REAL DEFAULT 0,
    totalCard REAL DEFAULT 0,
    totalMobile REAL DEFAULT 0,
    cashRefunds REAL DEFAULT 0,
    cashExpenses REAL DEFAULT 0,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    notes TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER
);

-- Add bank transfers table for cash-to-bank movements
CREATE TABLE IF NOT EXISTS bank_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shiftId INTEGER,
    amount REAL NOT NULL,
    bankAccount TEXT NOT NULL,
    reference TEXT,
    transferredBy TEXT NOT NULL,
    transferredByRole TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    notes TEXT,
    synced INTEGER DEFAULT 0,
    synced_at INTEGER,
    FOREIGN KEY (shiftId) REFERENCES cash_shifts(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_shifts_cashier ON cash_shifts(cashierId);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_open_time ON cash_shifts(openTime);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_shift ON bank_transfers(shiftId);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_timestamp ON bank_transfers(timestamp);
