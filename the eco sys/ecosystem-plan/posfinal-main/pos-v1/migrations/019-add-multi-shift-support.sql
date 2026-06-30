-- Migration 019: Add multi-shift support for workers
-- Allow workers to check in/out multiple times per day for split shifts

-- Note: Column additions are handled in db-sql.js with error handling
-- This file exists for migration tracking purposes

-- The migration adds:
-- - shiftNumber INTEGER DEFAULT 1
-- - createdAt INTEGER
-- - updatedAt INTEGER
-- - Index on (staffId, attendanceDate, shiftNumber)
