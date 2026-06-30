-- Migration 018: Add Product Recipes and Recipe Snapshots
-- Date: 2025-12-22
-- Description: Support for composed products with ingredient recipes and historical cost tracking

-- Product Recipes Table
-- Defines the ingredients (raw materials) that compose a product
CREATE TABLE IF NOT EXISTS product_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    raw_material_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (raw_material_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Sale Recipe Snapshots Table
-- Captures the recipe composition and costs at the time of sale
-- This ensures accurate historical COGS calculations even if ingredient costs change
CREATE TABLE IF NOT EXISTS sale_recipe_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    sale_item_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    raw_material_id INTEGER NOT NULL,
    raw_material_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    cost_per_unit REAL NOT NULL,
    total_cost REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (raw_material_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Add columns if they don't exist (check first to avoid errors)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle errors gracefully in code

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_material ON product_recipes(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_sale_snapshots_sale ON sale_recipe_snapshots(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_snapshots_product ON sale_recipe_snapshots(product_id);
