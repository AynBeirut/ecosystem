-- Data migration: Update existing service products to correct type
-- Services are products in 'software' category or maintenance/repair related

UPDATE products 
SET type = 'service',
    hourlyEnabled = 1,
    firstHourRate = CASE 
        WHEN name LIKE '%repair%' OR name LIKE '%maintenance%' THEN 50.00
        WHEN name LIKE '%consult%' THEN 75.00
        WHEN name LIKE '%recovery%' THEN 100.00
        ELSE price
    END,
    additionalHourRate = CASE 
        WHEN name LIKE '%repair%' OR name LIKE '%maintenance%' THEN 35.00
        WHEN name LIKE '%consult%' THEN 50.00
        WHEN name LIKE '%recovery%' THEN 60.00
        ELSE price * 0.7
    END
WHERE category = 'software' 
   OR name LIKE '%service%' 
   OR name LIKE '%repair%' 
   OR name LIKE '%maintenance%'
   OR name LIKE '%installation%'
   OR name LIKE '%consultation%'
   OR name LIKE '%recovery%';

-- For simple services without hourly billing, disable hourly mode
UPDATE products
SET hourlyEnabled = 0,
    firstHourRate = 0,
    additionalHourRate = 0
WHERE type = 'service' 
  AND (name LIKE '%installation%' OR name NOT LIKE '%repair%' AND name NOT LIKE '%consult%' AND name NOT LIKE '%recovery%');
