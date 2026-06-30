-- ===================================
-- AYN BEIRUT POS - MULTI-CURRENCY SYSTEM
-- Migration 013: Support for multiple currencies and exchange rates
-- ===================================
-- PREPARES DATABASE FOR FUTURE IMPLEMENTATION
-- Supports sales in multiple currencies with real-time conversion
-- Tracks exchange rate history and currency conversions
-- ===================================

-- ===================================
-- 1. CURRENCIES MASTER TABLE
-- ===================================
-- Stores all available currencies in the system

CREATE TABLE IF NOT EXISTS currencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, -- ISO 4217: 'USD', 'EUR', 'LBP', etc.
    name TEXT NOT NULL, -- 'US Dollar', 'Lebanese Pound', etc.
    symbol TEXT NOT NULL, -- '$', '€', 'ل.ل', etc.
    isBaseCurrency INTEGER DEFAULT 0, -- 1 if this is the base currency (usually USD)
    exchangeRate REAL DEFAULT 1.0, -- Rate to base currency (base = 1.0)
    decimalPlaces INTEGER DEFAULT 2, -- How many decimals to show (LBP = 0, USD = 2)
    position TEXT DEFAULT 'before', -- 'before' ($100) or 'after' (100€)
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    createdBy INTEGER,
    notes TEXT,
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies(isActive);
CREATE INDEX IF NOT EXISTS idx_currencies_base ON currencies(isBaseCurrency);

-- ===================================
-- 2. EXCHANGE RATE HISTORY
-- ===================================
-- Track all exchange rate changes over time
-- Useful for historical reporting and auditing

CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    currencyId INTEGER NOT NULL,
    currencyCode TEXT NOT NULL,
    oldRate REAL,
    newRate REAL NOT NULL,
    changePercentage REAL, -- % change from old to new rate
    effectiveDate INTEGER NOT NULL, -- When this rate became effective
    changedBy INTEGER NOT NULL, -- User who updated the rate
    changedAt INTEGER NOT NULL,
    source TEXT, -- 'manual', 'api', 'bank', 'central_bank'
    notes TEXT,
    FOREIGN KEY (currencyId) REFERENCES currencies(id),
    FOREIGN KEY (changedBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_exchange_history_currency ON exchange_rate_history(currencyId);
CREATE INDEX IF NOT EXISTS idx_exchange_history_date ON exchange_rate_history(effectiveDate);
CREATE INDEX IF NOT EXISTS idx_exchange_history_code ON exchange_rate_history(currencyCode);

-- ===================================
-- 3. SALE CURRENCIES
-- ===================================
-- Store currency information for each sale
-- Links sales table to currencies used in that transaction

CREATE TABLE IF NOT EXISTS sale_currencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER NOT NULL,
    currencyId INTEGER NOT NULL,
    currencyCode TEXT NOT NULL,
    exchangeRate REAL NOT NULL, -- Rate used at time of sale
    totalInCurrency REAL NOT NULL, -- Sale total in this currency
    totalInBaseCurrency REAL NOT NULL, -- Converted to base currency for reporting
    isPrimaryCurrency INTEGER DEFAULT 1, -- 1 if customer paid in this currency
    paymentAmount REAL, -- Amount paid in this currency (if split payment)
    changeAmount REAL, -- Change given in this currency
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (currencyId) REFERENCES currencies(id)
);
CREATE INDEX IF NOT EXISTS idx_sale_currencies_sale ON sale_currencies(saleId);
CREATE INDEX IF NOT EXISTS idx_sale_currencies_currency ON sale_currencies(currencyId);
CREATE INDEX IF NOT EXISTS idx_sale_currencies_code ON sale_currencies(currencyCode);
CREATE INDEX IF NOT EXISTS idx_sale_currencies_date ON sale_currencies(createdAt);

-- ===================================
-- 4. PRODUCT PRICES (MULTI-CURRENCY)
-- ===================================
-- Allow products to have prices in multiple currencies
-- Override default conversion with custom prices

CREATE TABLE IF NOT EXISTS product_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    currencyId INTEGER NOT NULL,
    currencyCode TEXT NOT NULL,
    price REAL NOT NULL, -- Price in this specific currency
    compareAtPrice REAL, -- Original price (for showing discounts)
    costPrice REAL, -- Cost in this currency (for profit calculation)
    isAutoCalculated INTEGER DEFAULT 1, -- 1 = auto-convert, 0 = manually set
    effectiveDate INTEGER, -- When this price becomes active
    expiryDate INTEGER, -- When this price expires (for promotions)
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    createdBy INTEGER,
    notes TEXT,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (currencyId) REFERENCES currencies(id),
    FOREIGN KEY (createdBy) REFERENCES users(id),
    UNIQUE(productId, currencyId) -- Each product can have only one active price per currency
);
CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(productId);
CREATE INDEX IF NOT EXISTS idx_product_prices_currency ON product_prices(currencyId);
CREATE INDEX IF NOT EXISTS idx_product_prices_code ON product_prices(currencyCode);
CREATE INDEX IF NOT EXISTS idx_product_prices_active ON product_prices(isActive);

-- ===================================
-- 5. CURRENCY CONVERSIONS LOG
-- ===================================
-- Track when users manually convert amounts
-- Useful for audit trail and analytics

CREATE TABLE IF NOT EXISTS currency_conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fromCurrencyId INTEGER NOT NULL,
    fromCurrencyCode TEXT NOT NULL,
    toCurrencyId INTEGER NOT NULL,
    toCurrencyCode TEXT NOT NULL,
    fromAmount REAL NOT NULL,
    toAmount REAL NOT NULL,
    exchangeRate REAL NOT NULL,
    conversionType TEXT DEFAULT 'manual', -- 'manual', 'sale', 'payment', 'refund', 'report'
    referenceType TEXT, -- 'sale', 'refund', 'expense', etc.
    referenceId INTEGER, -- Link to related transaction
    convertedBy INTEGER NOT NULL,
    convertedAt INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (fromCurrencyId) REFERENCES currencies(id),
    FOREIGN KEY (toCurrencyId) REFERENCES currencies(id),
    FOREIGN KEY (convertedBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_conversions_from ON currency_conversions(fromCurrencyId);
CREATE INDEX IF NOT EXISTS idx_conversions_to ON currency_conversions(toCurrencyId);
CREATE INDEX IF NOT EXISTS idx_conversions_date ON currency_conversions(convertedAt);
CREATE INDEX IF NOT EXISTS idx_conversions_type ON currency_conversions(conversionType);
CREATE INDEX IF NOT EXISTS idx_conversions_reference ON currency_conversions(referenceType, referenceId);

-- ===================================
-- 6. DEFAULT CURRENCY DATA
-- ===================================
-- Insert commonly used Middle East & international currencies
-- USD is set as base currency

INSERT OR IGNORE INTO currencies (code, name, symbol, isBaseCurrency, exchangeRate, decimalPlaces, position, isActive, createdAt, updatedAt, notes) VALUES
('USD', 'US Dollar', '$', 1, 1.0, 2, 'before', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Base currency for all conversions'),
('EUR', 'Euro', '€', 0, 0.92, 2, 'before', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'European Union currency'),
('GBP', 'British Pound', '£', 0, 0.79, 2, 'before', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'United Kingdom currency'),
('LBP', 'Lebanese Pound', 'ل.ل', 0, 89500.0, 0, 'after', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Lebanese Pound - high inflation, no decimals'),
('AED', 'UAE Dirham', 'د.إ', 0, 3.67, 2, 'after', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'United Arab Emirates currency'),
('SAR', 'Saudi Riyal', 'ر.س', 0, 3.75, 2, 'after', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Saudi Arabia currency'),
('EGP', 'Egyptian Pound', 'ج.م', 0, 30.90, 2, 'after', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Egyptian currency'),
('TRY', 'Turkish Lira', '₺', 0, 32.50, 2, 'before', 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Turkish currency');

-- ===================================
-- IMPLEMENTATION TASKS (FUTURE)
-- ===================================
-- TODO: Create currency management UI in Admin Dashboard
-- TODO: Add exchange rate auto-update from API (xe.com, fixer.io, etc.)
-- TODO: Add currency selector to POS interface
-- TODO: Update sales.js to handle multi-currency payments
-- TODO: Create currency conversion calculator tool
-- TODO: Add multi-currency reports (daily sales by currency)
-- TODO: Implement split payment in multiple currencies
-- TODO: Add currency rounding rules (LBP rounds to nearest 250/500)
-- TODO: Create exchange rate alert system (notify on major changes)
-- TODO: Add historical exchange rate charts
-- TODO: Implement automatic price updates when rates change
-- TODO: Add currency-specific tax handling
-- ===================================
