-- ===================================
-- MIGRATION 002 ROLLBACK
-- Safely rollback enhanced features
-- ===================================

-- Step 1: Backup data before rollback (handled by application)

-- Step 2: Drop new tables in reverse order (handle dependencies)
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS company_info;
DROP TABLE IF EXISTS bill_payments;
DROP TABLE IF EXISTS bill_types;
DROP TABLE IF EXISTS phonebook;

-- Step 3: Drop any new indexes that weren't in migration 001
-- (None in this case, as all indexes were part of the new tables)

-- Step 4: Revert schema version
UPDATE schema_version SET version = 1 WHERE version = 2;

-- Step 5: Verify rollback
SELECT 'Rollback complete - Schema version: ' || version FROM schema_version;
