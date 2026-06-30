-- ===================================
-- AYN BEIRUT POS - DISCOUNT & OFFERS SYSTEM
-- Migration 014: Comprehensive discount and promotional system
-- ===================================
-- PREPARES DATABASE FOR FUTURE IMPLEMENTATION
-- Supports multiple discount types, loyalty programs, and promotional codes
-- Includes time-based restrictions and usage tracking
-- ===================================

-- ===================================
-- 1. DISCOUNT RULES MASTER TABLE
-- ===================================
-- Central table for all discount configurations

CREATE TABLE IF NOT EXISTS discount_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, -- 'SUMMER2024', 'BOGO', 'HAPPY_HOUR', etc.
    name TEXT NOT NULL, -- Display name
    description TEXT,
    type TEXT NOT NULL, -- 'percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping', 'bundle'
    value REAL NOT NULL, -- Discount value (10 for 10%, 5.00 for $5 off)
    startDate INTEGER, -- When discount becomes active (NULL = immediate)
    endDate INTEGER, -- When discount expires (NULL = no expiry)
    isActive INTEGER DEFAULT 1,
    
    -- Minimum purchase requirements
    minPurchaseAmount REAL DEFAULT 0, -- Minimum cart total to apply discount
    minQuantity INTEGER DEFAULT 0, -- Minimum items needed
    maxDiscountAmount REAL, -- Cap the discount at this amount
    
    -- Product/Category restrictions
    applicableToProductIds TEXT, -- JSON array of product IDs: '[1,2,3]'
    applicableToCategories TEXT, -- JSON array of categories: '["Coffee","Sandwiches"]'
    excludedProductIds TEXT, -- JSON array of excluded products
    excludedCategories TEXT, -- JSON array of excluded categories
    
    -- Time restrictions
    dayOfWeek TEXT, -- JSON array: '["monday","tuesday"]' or NULL for all days
    timeOfDayStart TEXT, -- '09:00' - start time (24h format)
    timeOfDayEnd TEXT, -- '17:00' - end time
    
    -- Buy X Get Y specifics
    buyQuantity INTEGER, -- Buy this many
    getQuantity INTEGER, -- Get this many free/discounted
    getDiscountPercentage REAL DEFAULT 100, -- 100 = free, 50 = half price
    
    -- Usage limits
    maxUsesTotal INTEGER, -- Total times this discount can be used (NULL = unlimited)
    maxUsesPerCustomer INTEGER, -- Times each customer can use (NULL = unlimited)
    currentUsageCount INTEGER DEFAULT 0, -- Track total uses
    
    -- Priority & Stacking
    priority INTEGER DEFAULT 0, -- Higher priority discounts apply first
    canCombineWithOthers INTEGER DEFAULT 0, -- Can be used with other discounts
    
    -- Loyalty tier restrictions
    minLoyaltyTier TEXT, -- 'bronze', 'silver', 'gold' - minimum tier required
    
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    createdBy INTEGER NOT NULL,
    notes TEXT,
    
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_discount_rules_code ON discount_rules(code);
CREATE INDEX IF NOT EXISTS idx_discount_rules_type ON discount_rules(type);
CREATE INDEX IF NOT EXISTS idx_discount_rules_active ON discount_rules(isActive);
CREATE INDEX IF NOT EXISTS idx_discount_rules_dates ON discount_rules(startDate, endDate);
CREATE INDEX IF NOT EXISTS idx_discount_rules_priority ON discount_rules(priority);

-- ===================================
-- 2. DISCOUNT USAGES LOG
-- ===================================
-- Track every time a discount is applied to a sale

CREATE TABLE IF NOT EXISTS discount_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discountRuleId INTEGER NOT NULL,
    discountCode TEXT NOT NULL,
    saleId INTEGER, -- NULL if sale not completed
    unpaidOrderId INTEGER, -- Link to unpaid order if applicable
    customerId INTEGER, -- Track customer usage
    
    originalAmount REAL NOT NULL, -- Price before discount
    discountAmount REAL NOT NULL, -- Amount discounted
    finalAmount REAL NOT NULL, -- Price after discount
    
    appliedAt INTEGER NOT NULL,
    appliedBy INTEGER NOT NULL, -- User/cashier who applied it
    
    -- Context information
    itemsAffected TEXT, -- JSON array of product IDs affected
    quantityAffected INTEGER, -- How many items got the discount
    
    status TEXT DEFAULT 'applied', -- 'applied', 'cancelled', 'refunded'
    cancelledAt INTEGER,
    cancelledBy INTEGER,
    cancellationReason TEXT,
    
    notes TEXT,
    
    FOREIGN KEY (discountRuleId) REFERENCES discount_rules(id),
    FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE SET NULL,
    FOREIGN KEY (customerId) REFERENCES customers(id),
    FOREIGN KEY (appliedBy) REFERENCES users(id),
    FOREIGN KEY (cancelledBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_discount_usages_rule ON discount_usages(discountRuleId);
CREATE INDEX IF NOT EXISTS idx_discount_usages_sale ON discount_usages(saleId);
CREATE INDEX IF NOT EXISTS idx_discount_usages_customer ON discount_usages(customerId);
CREATE INDEX IF NOT EXISTS idx_discount_usages_date ON discount_usages(appliedAt);
CREATE INDEX IF NOT EXISTS idx_discount_usages_status ON discount_usages(status);

-- ===================================
-- 3. PRODUCT DISCOUNTS (QUICK ASSIGN)
-- ===================================
-- Link specific products to specific discounts for faster lookups

CREATE TABLE IF NOT EXISTS product_discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    discountRuleId INTEGER NOT NULL,
    
    isActive INTEGER DEFAULT 1,
    effectiveDate INTEGER, -- When this product discount becomes active
    expiryDate INTEGER, -- When it expires
    
    displayInPOS INTEGER DEFAULT 1, -- Show in POS discount menu
    displayBadge TEXT, -- 'SALE', '50% OFF', 'NEW', etc.
    displayColor TEXT, -- Badge color: 'red', 'green', 'blue'
    
    createdAt INTEGER NOT NULL,
    createdBy INTEGER,
    
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (discountRuleId) REFERENCES discount_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (createdBy) REFERENCES users(id),
    UNIQUE(productId, discountRuleId) -- Prevent duplicate assignments
);
CREATE INDEX IF NOT EXISTS idx_product_discounts_product ON product_discounts(productId);
CREATE INDEX IF NOT EXISTS idx_product_discounts_rule ON product_discounts(discountRuleId);
CREATE INDEX IF NOT EXISTS idx_product_discounts_active ON product_discounts(isActive);

-- ===================================
-- 4. LOYALTY TIERS
-- ===================================
-- Customer loyalty program tiers with different benefits

CREATE TABLE IF NOT EXISTS loyalty_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL, -- 'Bronze', 'Silver', 'Gold', 'Platinum'
    code TEXT UNIQUE NOT NULL, -- 'bronze', 'silver', 'gold', 'platinum'
    description TEXT,
    
    -- Qualification criteria
    minPurchaseAmount REAL DEFAULT 0, -- Lifetime spending required
    minTransactionCount INTEGER DEFAULT 0, -- Number of purchases required
    minPointsRequired INTEGER DEFAULT 0, -- Loyalty points needed
    
    -- Benefits
    discountPercentage REAL DEFAULT 0, -- Automatic discount on all purchases
    pointsMultiplier REAL DEFAULT 1.0, -- 1.5 = earn 50% more points
    
    -- Tier privileges
    birthdayBonus REAL DEFAULT 0, -- Special birthday discount
    freeDelivery INTEGER DEFAULT 0, -- Free delivery for this tier
    prioritySupport INTEGER DEFAULT 0, -- Priority customer service
    exclusiveOffers INTEGER DEFAULT 0, -- Access to exclusive deals
    
    -- Display
    color TEXT, -- '#CD7F32' (bronze), '#C0C0C0' (silver), '#FFD700' (gold)
    icon TEXT, -- Emoji or icon name
    displayOrder INTEGER DEFAULT 0, -- Sort order in UI
    
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_code ON loyalty_tiers(code);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_active ON loyalty_tiers(isActive);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_order ON loyalty_tiers(displayOrder);

-- ===================================
-- 5. PROMOTIONAL CODES (COUPONS)
-- ===================================
-- Unique coupon codes with usage limits

CREATE TABLE IF NOT EXISTS promotional_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, -- 'WELCOME10', 'FRIEND20', etc.
    discountRuleId INTEGER NOT NULL, -- Links to discount_rules
    
    -- Usage limits
    maxUses INTEGER, -- Total uses allowed (NULL = unlimited)
    usesRemaining INTEGER, -- Current remaining uses
    maxUsesPerCustomer INTEGER DEFAULT 1, -- Per-customer limit
    
    -- Validity period
    validFrom INTEGER, -- Start date
    validUntil INTEGER, -- Expiry date
    
    -- Distribution tracking
    distributionChannel TEXT, -- 'email', 'social_media', 'in_store', 'affiliate'
    distributionDate INTEGER, -- When codes were distributed
    targetAudience TEXT, -- 'new_customers', 'vip', 'birthday', etc.
    
    isActive INTEGER DEFAULT 1,
    isSingleUse INTEGER DEFAULT 0, -- 1 = code deactivates after first use
    
    createdAt INTEGER NOT NULL,
    createdBy INTEGER NOT NULL,
    
    notes TEXT,
    
    FOREIGN KEY (discountRuleId) REFERENCES discount_rules(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promotional_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_rule ON promotional_codes(discountRuleId);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promotional_codes(isActive);
CREATE INDEX IF NOT EXISTS idx_promo_codes_validity ON promotional_codes(validFrom, validUntil);

-- ===================================
-- 6. DEFAULT LOYALTY TIERS DATA
-- ===================================
-- Insert standard loyalty tier structure

INSERT OR IGNORE INTO loyalty_tiers (name, code, description, minPurchaseAmount, minTransactionCount, discountPercentage, pointsMultiplier, color, icon, displayOrder, isActive, createdAt, updatedAt, notes) VALUES
('Bronze', 'bronze', 'Entry level - Welcome to our loyalty program!', 0, 0, 0, 1.0, '#CD7F32', '🥉', 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Automatic tier for all customers'),
('Silver', 'silver', 'Silver members enjoy 5% discount', 500, 10, 5, 1.2, '#C0C0C0', '🥈', 2, 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Spend $500 or make 10 purchases'),
('Gold', 'gold', 'Gold members get 10% discount + exclusive offers', 2000, 30, 10, 1.5, '#FFD700', '🥇', 3, 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Spend $2000 or make 30 purchases'),
('Platinum', 'platinum', 'VIP treatment with 15% discount + free delivery', 5000, 50, 15, 2.0, '#E5E4E2', '💎', 4, 1, strftime('%s', 'now'), strftime('%s', 'now'), 'Spend $5000 or make 50 purchases');

-- ===================================
-- 7. DEFAULT DISCOUNT EXAMPLES
-- ===================================
-- Sample discount rules to demonstrate system capabilities

INSERT OR IGNORE INTO discount_rules (code, name, description, type, value, isActive, minPurchaseAmount, maxDiscountAmount, dayOfWeek, timeOfDayStart, timeOfDayEnd, priority, canCombineWithOthers, createdAt, updatedAt, createdBy, notes) VALUES
('HAPPY_HOUR', 'Happy Hour 20% Off', 'Get 20% off on all beverages between 2 PM and 5 PM', 'percentage', 20, 1, 0, NULL, '["monday","tuesday","wednesday","thursday","friday"]', '14:00', '17:00', 5, 0, strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Afternoon discount to boost slow hours'),
('WEEKEND_SPECIAL', 'Weekend Special 10%', 'Enjoy 10% off on weekends', 'percentage', 10, 1, 0, NULL, '["saturday","sunday"]', NULL, NULL, 3, 1, strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Weekend promotion'),
('BOGO_COFFEE', 'Buy One Get One Coffee', 'Buy one coffee, get second one free', 'buy_x_get_y', 0, 1, 0, NULL, NULL, NULL, NULL, 8, 0, strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Popular coffee promotion');

-- ===================================
-- 8. SAMPLE PROMOTIONAL CODES
-- ===================================
-- Pre-configured coupon codes ready to use

INSERT OR IGNORE INTO promotional_codes (code, discountRuleId, maxUses, usesRemaining, maxUsesPerCustomer, validFrom, validUntil, distributionChannel, isActive, isSingleUse, createdAt, createdBy, notes) VALUES
('WELCOME10', (SELECT id FROM discount_rules WHERE code = 'WEEKEND_SPECIAL'), 100, 100, 1, strftime('%s', 'now'), strftime('%s', 'now', '+30 days'), 'email', 1, 0, strftime('%s', 'now'), 1, 'New customer welcome code'),
('VIP2024', (SELECT id FROM discount_rules WHERE code = 'WEEKEND_SPECIAL'), 50, 50, 3, strftime('%s', 'now'), strftime('%s', 'now', '+90 days'), 'in_store', 1, 0, strftime('%s', 'now'), 1, 'VIP customer exclusive code');

-- ===================================
-- IMPLEMENTATION TASKS (FUTURE)
-- ===================================
-- TODO: Create discount management UI (add/edit/delete rules)
-- TODO: Add discount picker widget in POS interface
-- TODO: Implement automatic discount application logic
-- TODO: Create discount conflict resolution (priority system)
-- TODO: Add discount preview before checkout
-- TODO: Implement coupon code validation in POS
-- TODO: Create discount performance analytics dashboard
-- TODO: Add A/B testing for different discount strategies
-- TODO: Implement customer loyalty tier auto-upgrade
-- TODO: Create discount effectiveness reports (ROI tracking)
-- TODO: Add scheduled discount activation/deactivation
-- TODO: Implement flash sales and limited-time offers
-- TODO: Create discount notification system (customer alerts)
-- TODO: Add discount approval workflow for large discounts
-- TODO: Implement referral discount program
-- TODO: Create bundle discount builder (product combos)
-- TODO: Add quantity-based tiered discounts
-- TODO: Implement birthday month automatic discounts
-- ===================================
