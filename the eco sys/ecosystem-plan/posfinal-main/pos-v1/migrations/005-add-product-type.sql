-- ===================================
-- Migration 005: Add type column to products table
-- Description: Add product type (item/service) and service-specific fields
-- ===================================

-- Add type column (item or service)
ALTER TABLE products ADD COLUMN type TEXT DEFAULT 'item' CHECK(type IN ('item', 'service'));

-- Add service-specific fields
ALTER TABLE products ADD COLUMN hourlyEnabled INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN firstHourRate REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN additionalHourRate REAL DEFAULT 0;

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
