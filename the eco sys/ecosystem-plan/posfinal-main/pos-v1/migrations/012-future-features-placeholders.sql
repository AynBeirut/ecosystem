-- ===================================
-- AYN BEIRUT POS - FUTURE FEATURES PLACEHOLDERS
-- Migration 012: Database structure for Store & Restaurant modes
-- ===================================
-- PREPARES DATABASE FOR FUTURE IMPLEMENTATION
-- Supports both retail store and restaurant/cafe operations
-- ===================================

-- ===================================
-- 1. RAW MATERIALS & INVENTORY
-- ===================================
-- Raw materials purchased from suppliers
-- Used to create finished menu items (sandwiches, coffee, etc.)

CREATE TABLE IF NOT EXISTS raw_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE, -- e.g., 'RM001', 'RM002'
    name TEXT NOT NULL, -- e.g., 'Bread - White Loaf', 'Coffee Beans - Arabica'
    category TEXT, -- 'Ingredients', 'Beverages', 'Packaging', 'Cleaning'
    unit TEXT NOT NULL, -- 'kg', 'liter', 'piece', 'box', 'bag'
    currentStock REAL DEFAULT 0,
    minStock REAL DEFAULT 0, -- Reorder alert threshold
    maxStock REAL DEFAULT 0, -- Maximum storage capacity
    costPerUnit REAL DEFAULT 0, -- Purchase cost
    supplierId INTEGER,
    storageLocation TEXT, -- 'Main Stock', 'Kitchen', 'Bar', 'Freezer', 'Dry Storage'
    expiryTracking INTEGER DEFAULT 0, -- 1 if needs expiry date monitoring
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    createdBy INTEGER,
    notes TEXT,
    FOREIGN KEY (supplierId) REFERENCES suppliers(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);
CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier ON raw_materials(supplierId);
CREATE INDEX IF NOT EXISTS idx_raw_materials_active ON raw_materials(isActive);
CREATE INDEX IF NOT EXISTS idx_raw_materials_storage ON raw_materials(storageLocation);

-- Track all raw material movements
CREATE TABLE IF NOT EXISTS raw_material_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rawMaterialId INTEGER NOT NULL,
    transactionType TEXT NOT NULL, -- 'purchase', 'production_use', 'waste', 'transfer', 'adjustment', 'return'
    quantity REAL NOT NULL, -- Positive = increase stock, Negative = decrease stock
    balanceAfter REAL NOT NULL, -- Stock balance after this transaction
    unitCost REAL,
    totalValue REAL,
    fromLocation TEXT, -- For transfers
    toLocation TEXT, -- For transfers
    referenceType TEXT, -- 'delivery', 'recipe_production', 'waste_report', 'manual_adjustment'
    referenceId INTEGER, -- Links to related record
    timestamp INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (rawMaterialId) REFERENCES raw_materials(id),
    FOREIGN KEY (userId) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_raw_transactions_material ON raw_material_transactions(rawMaterialId);
CREATE INDEX IF NOT EXISTS idx_raw_transactions_type ON raw_material_transactions(transactionType);
CREATE INDEX IF NOT EXISTS idx_raw_transactions_timestamp ON raw_material_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_transactions_reference ON raw_material_transactions(referenceType, referenceId);

-- ===================================
-- 2. PRODUCTION STATIONS & RECIPES
-- ===================================
-- Stations where items are prepared (Kitchen, Bar, etc.)

CREATE TABLE IF NOT EXISTS production_stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- 'Kitchen', 'Bar', 'Grill', 'Bakery', 'Cold Station'
    code TEXT UNIQUE, -- 'KTCH', 'BAR', 'GRLL'
    description TEXT,
    isActive INTEGER DEFAULT 1,
    displayOrder INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL
);

-- Recipes: How to make menu items from raw materials
-- Created by Admin/Manager, linked to menu items (products)
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL, -- The menu item this recipe produces
    recipeName TEXT NOT NULL,
    stationId INTEGER NOT NULL, -- Which station prepares this (Kitchen, Bar, etc.)
    servingSize REAL DEFAULT 1, -- Portions produced
    preparationTime INTEGER, -- Minutes
    instructions TEXT, -- Cooking/preparation instructions
    costPerServing REAL DEFAULT 0, -- Auto-calculated from ingredients
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    createdBy INTEGER NOT NULL,
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (stationId) REFERENCES production_stations(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(productId);
CREATE INDEX IF NOT EXISTS idx_recipes_station ON recipes(stationId);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes(isActive);

-- Recipe ingredients: Which raw materials and how much
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipeId INTEGER NOT NULL,
    rawMaterialId INTEGER NOT NULL,
    quantityNeeded REAL NOT NULL, -- Amount needed per serving
    unit TEXT NOT NULL,
    cost REAL DEFAULT 0, -- Cost of this ingredient in recipe
    isOptional INTEGER DEFAULT 0,
    preparationNotes TEXT, -- e.g., 'chopped', 'grilled', 'shredded'
    FOREIGN KEY (recipeId) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (rawMaterialId) REFERENCES raw_materials(id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipeId);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_material ON recipe_ingredients(rawMaterialId);

-- Production log: Track when items are made
-- Auto-deducts raw materials when production is recorded
CREATE TABLE IF NOT EXISTS production_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipeId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantityProduced REAL NOT NULL,
    stationId INTEGER NOT NULL,
    producedBy INTEGER, -- Staff member who made it
    productionDate INTEGER NOT NULL,
    materialsCost REAL DEFAULT 0, -- Total raw materials cost
    status TEXT DEFAULT 'completed', -- 'in_progress', 'completed', 'cancelled', 'wasted'
    saleId INTEGER, -- Link to sale if sold immediately
    notes TEXT,
    FOREIGN KEY (recipeId) REFERENCES recipes(id),
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (stationId) REFERENCES production_stations(id),
    FOREIGN KEY (producedBy) REFERENCES staff(id),
    FOREIGN KEY (saleId) REFERENCES sales(id)
);
CREATE INDEX IF NOT EXISTS idx_production_recipe ON production_log(recipeId);
CREATE INDEX IF NOT EXISTS idx_production_station ON production_log(stationId);
CREATE INDEX IF NOT EXISTS idx_production_date ON production_log(productionDate);
CREATE INDEX IF NOT EXISTS idx_production_status ON production_log(status);

-- ===================================
-- 3. KITCHEN/BAR ORDER DISPLAY SYSTEM
-- ===================================
-- Orders sent to Kitchen/Bar for preparation

CREATE TABLE IF NOT EXISTS station_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL, -- Link to unpaid_orders or sales
    orderType TEXT DEFAULT 'sale', -- 'sale', 'unpaid_order'
    stationId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    productName TEXT NOT NULL,
    quantity REAL NOT NULL,
    specialInstructions TEXT, -- Customer requests (no onions, extra cheese, etc.)
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    status TEXT DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'served', 'cancelled'
    tableNumber TEXT, -- For restaurant mode
    serverName TEXT, -- Waiter/bartender who took order
    receivedAt INTEGER NOT NULL, -- When order came in
    startedAt INTEGER, -- When preparation started
    completedAt INTEGER, -- When item ready
    servedAt INTEGER, -- When delivered to customer
    preparedBy INTEGER, -- Staff who prepared it
    FOREIGN KEY (stationId) REFERENCES production_stations(id),
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (preparedBy) REFERENCES staff(id)
);
CREATE INDEX IF NOT EXISTS idx_station_orders_order ON station_orders(orderId, orderType);
CREATE INDEX IF NOT EXISTS idx_station_orders_station ON station_orders(stationId);
CREATE INDEX IF NOT EXISTS idx_station_orders_status ON station_orders(status);
CREATE INDEX IF NOT EXISTS idx_station_orders_received ON station_orders(receivedAt);

-- ===================================
-- 4. MANAGER APPROVAL SYSTEM
-- ===================================
-- Central approval queue for various actions

CREATE TABLE IF NOT EXISTS approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requestType TEXT NOT NULL, -- 'purchase_order', 'supplier_payment', 'refund', 'bank_transfer', 'staff_attendance', 'salary_payment', 'expense', 'price_change', 'discount'
    referenceType TEXT, -- 'delivery', 'payment', 'refund', 'staff_payment', etc.
    referenceId INTEGER, -- ID of item needing approval
    requestData TEXT, -- JSON with all request details
    amount REAL, -- For financial approvals
    requestedBy INTEGER NOT NULL,
    requestedAt INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'auto_approved', 'cancelled'
    reviewedBy INTEGER,
    reviewedAt INTEGER,
    reviewNotes TEXT,
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    expiresAt INTEGER, -- Optional: request auto-cancels after this time
    FOREIGN KEY (requestedBy) REFERENCES users(id),
    FOREIGN KEY (reviewedBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_approval_type ON approval_requests(requestType);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requested ON approval_requests(requestedBy);
CREATE INDEX IF NOT EXISTS idx_approval_date ON approval_requests(requestedAt);

-- Auto-approval rules configuration
CREATE TABLE IF NOT EXISTS approval_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ruleName TEXT NOT NULL,
    requestType TEXT NOT NULL,
    conditions TEXT NOT NULL, -- JSON: [{"field": "amount", "operator": "<=", "value": 100}]
    action TEXT DEFAULT 'auto_approve', -- 'auto_approve', 'require_approval', 'notify_only'
    assignTo INTEGER, -- User to notify/assign to
    isActive INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0, -- Rules checked in order
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    createdBy INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (assignTo) REFERENCES users(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_approval_rules_type ON approval_rules(requestType);
CREATE INDEX IF NOT EXISTS idx_approval_rules_active ON approval_rules(isActive);

-- ===================================
-- 5. STAFF MANAGEMENT
-- ===================================
-- Employee records

CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER UNIQUE, -- Link to users table for login access
    employeeCode TEXT UNIQUE, -- e.g., 'EMP001', 'WAIT05'
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    position TEXT NOT NULL, -- 'bartender', 'waiter', 'chef', 'kitchen_staff', 'manager', 'cashier', 'cleaner'
    department TEXT, -- 'bar', 'kitchen', 'dining', 'management', 'cleaning'
    stationId INTEGER, -- Default station for kitchen/bar staff
    hireDate INTEGER NOT NULL,
    terminationDate INTEGER,
    employmentType TEXT DEFAULT 'full_time', -- 'full_time', 'part_time', 'contract', 'temporary'
    paymentType TEXT NOT NULL, -- 'monthly', 'daily', 'hourly'
    monthlySalary REAL DEFAULT 0,
    dailyRate REAL DEFAULT 0,
    hourlyRate REAL DEFAULT 0,
    overtimeRate REAL DEFAULT 0, -- Hourly overtime rate
    bankAccount TEXT,
    nationalId TEXT,
    address TEXT,
    emergencyContact TEXT,
    emergencyPhone TEXT,
    photo TEXT, -- File path or URL
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (stationId) REFERENCES production_stations(id)
);
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(userId);
CREATE INDEX IF NOT EXISTS idx_staff_position ON staff(position);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(isActive);

-- Staff attendance/time tracking
CREATE TABLE IF NOT EXISTS staff_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staffId INTEGER NOT NULL,
    attendanceDate TEXT NOT NULL, -- YYYY-MM-DD
    checkInTime INTEGER,
    checkOutTime INTEGER,
    totalHours REAL DEFAULT 0,
    regularHours REAL DEFAULT 0,
    overtimeHours REAL DEFAULT 0,
    breakMinutes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'present', -- 'present', 'absent', 'late', 'half_day', 'leave', 'holiday'
    leaveType TEXT, -- 'sick', 'vacation', 'personal', 'unpaid', 'emergency'
    approvalStatus TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected' (for leaves/overtime)
    approvedBy INTEGER,
    approvedAt INTEGER,
    notes TEXT,
    FOREIGN KEY (staffId) REFERENCES staff(id),
    FOREIGN KEY (approvedBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON staff_attendance(staffId);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON staff_attendance(attendanceDate);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON staff_attendance(status);

-- Salary/wage payments
CREATE TABLE IF NOT EXISTS staff_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staffId INTEGER NOT NULL,
    paymentType TEXT NOT NULL, -- 'salary', 'wages', 'bonus', 'overtime', 'commission', 'advance'
    paymentPeriod TEXT NOT NULL, -- 'January 2025', 'Dec 1-15, 2025'
    periodStart INTEGER,
    periodEnd INTEGER,
    baseAmount REAL DEFAULT 0,
    overtimeAmount REAL DEFAULT 0,
    bonusAmount REAL DEFAULT 0,
    commissionAmount REAL DEFAULT 0,
    deductions REAL DEFAULT 0, -- Taxes, advances, penalties
    netAmount REAL NOT NULL,
    paymentMethod TEXT DEFAULT 'cash', -- 'cash', 'bank_transfer', 'check'
    paymentDate INTEGER,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'cancelled'
    approvalRequired INTEGER DEFAULT 1,
    approvedBy INTEGER,
    approvedAt INTEGER,
    paidBy INTEGER,
    paidAt INTEGER,
    referenceNumber TEXT,
    receiptNumber TEXT,
    notes TEXT,
    FOREIGN KEY (staffId) REFERENCES staff(id),
    FOREIGN KEY (approvedBy) REFERENCES users(id),
    FOREIGN KEY (paidBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_staff_payments_staff ON staff_payments(staffId);
CREATE INDEX IF NOT EXISTS idx_staff_payments_period ON staff_payments(periodStart, periodEnd);
CREATE INDEX IF NOT EXISTS idx_staff_payments_status ON staff_payments(status);
CREATE INDEX IF NOT EXISTS idx_staff_payments_date ON staff_payments(paymentDate);

-- ===================================
-- 6. EXPENSES TRACKING
-- ===================================
-- All business expenses (including staff wages)

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expenseCode TEXT UNIQUE,
    category TEXT NOT NULL, -- 'staff_wages', 'utilities', 'rent', 'supplies', 'maintenance', 'marketing', 'taxes', 'other'
    subcategory TEXT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    expenseDate INTEGER NOT NULL,
    paymentMethod TEXT, -- 'cash', 'bank_transfer', 'credit_card', 'check'
    paymentReference TEXT,
    vendor TEXT,
    receiptNumber TEXT,
    receiptImage TEXT, -- File path
    referenceType TEXT, -- 'staff_payment', 'supplier_payment', 'manual', 'recurring'
    referenceId INTEGER,
    isRecurring INTEGER DEFAULT 0,
    recurringFrequency TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'cancelled'
    approvalRequired INTEGER DEFAULT 0,
    approvedBy INTEGER,
    approvedAt INTEGER,
    paidBy INTEGER,
    paidAt INTEGER,
    recordedBy INTEGER NOT NULL,
    recordedAt INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (approvedBy) REFERENCES users(id),
    FOREIGN KEY (paidBy) REFERENCES users(id),
    FOREIGN KEY (recordedBy) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expenseDate);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(referenceType, referenceId);

-- ===================================
-- 7. DINING AREA MANAGEMENT (Restaurant Mode)
-- ===================================
-- Restaurant floor layout and table management

CREATE TABLE IF NOT EXISTS dining_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, -- 'Main Hall', 'Terrace', 'Bar Area', 'VIP Room'
    description TEXT,
    capacity INTEGER, -- Total seats
    floorLevel INTEGER DEFAULT 1,
    isActive INTEGER DEFAULT 1,
    displayOrder INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dining_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tableNumber TEXT NOT NULL UNIQUE, -- 'T01', 'T02', 'BAR-1'
    tableName TEXT, -- Optional friendly name
    areaId INTEGER NOT NULL,
    capacity INTEGER DEFAULT 4,
    tableType TEXT DEFAULT 'standard', -- 'standard', 'bar', 'booth', 'private', 'outdoor'
    status TEXT DEFAULT 'available', -- 'available', 'occupied', 'reserved', 'cleaning', 'closed'
    currentOrderId INTEGER, -- Link to active unpaid order
    assignedWaiterId INTEGER, -- Current waiter
    reservedBy TEXT, -- Customer name for reservations
    reservedAt INTEGER,
    reservedUntil INTEGER,
    lastCleaned INTEGER,
    xPosition INTEGER, -- For visual floor map
    yPosition INTEGER,
    isActive INTEGER DEFAULT 1,
    notes TEXT,
    FOREIGN KEY (areaId) REFERENCES dining_areas(id),
    FOREIGN KEY (assignedWaiterId) REFERENCES staff(id)
);
CREATE INDEX IF NOT EXISTS idx_tables_area ON dining_tables(areaId);
CREATE INDEX IF NOT EXISTS idx_tables_status ON dining_tables(status);
CREATE INDEX IF NOT EXISTS idx_tables_waiter ON dining_tables(assignedWaiterId);
CREATE INDEX IF NOT EXISTS idx_tables_active ON dining_tables(isActive);

-- ===================================
-- 8. PRODUCT TYPE ENHANCEMENTS
-- ===================================
-- Add columns to existing products table for production tracking

-- Add requiresProduction column to products table
-- 0 = Retail item (sold as-is, no production needed)
-- 1 = Produced item (needs recipe, goes to kitchen/bar)
ALTER TABLE products ADD COLUMN requiresProduction INTEGER DEFAULT 0;

-- Add default production station for products
ALTER TABLE products ADD COLUMN defaultStationId INTEGER;

-- ===================================
-- IMPLEMENTATION NOTES
-- ===================================
-- 
-- FLOW FOR STORE MODE (Current):
-- Suppliers → Products (Stock) → Sales ✅
--
-- FLOW FOR RESTAURANT MODE (Future):
-- 1. Purchase raw materials from suppliers → raw_materials table
-- 2. Admin/Manager creates recipes → recipes + recipe_ingredients
-- 3. Recipes link raw materials to menu items (products)
-- 4. Products appear in POS menu
-- 5. Customer orders → Sale created
-- 6. Order sent to Kitchen/Bar → station_orders
-- 7. Staff prepares item → production_log created
-- 8. Raw materials auto-deducted → raw_material_transactions
-- 9. Item marked ready → served to customer
--
-- APPROVAL WORKFLOW:
-- - Purchase orders, refunds, bank transfers, staff payments require manager approval
-- - Auto-approval rules can bypass for small amounts
-- - All approvals tracked in approval_requests table
--
-- STAFF PAYROLL:
-- - Monthly: Fixed salary
-- - Daily: Days worked × daily rate
-- - Hourly: Hours worked × hourly rate (+ overtime)
-- - Payments create expense records automatically
--
-- ROLE-BASED ACCESS:
-- - Admin/Manager: Full access to all features
-- - Bartender: Bar station only, limited menu access
-- - Waiter: Table management, order taking
-- - Chef/Kitchen: Kitchen orders view only
-- - Cashier: POS operations only
--
-- ===================================

-- Record this migration
INSERT INTO schema_version (version, description, applied_at, applied_by)
VALUES (12, 'Future features: Raw materials, Production stations, Recipes, Approvals, Staff management, Expenses, Dining areas', strftime('%s', 'now') * 1000, 'system');
