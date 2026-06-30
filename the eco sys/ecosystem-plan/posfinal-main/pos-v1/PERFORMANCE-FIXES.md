# 🐛 Performance Issue Analysis & Fixes

**Date:** February 7, 2026  
**Issue:** App freezing intermittently  
**Status:** Root cause identified

---

## 🔍 Root Causes Identified from Console Logs

### 1. **Excessive Database Saves** (CRITICAL)

**Problem:**
- `runExec()` automatically calls `saveDatabase()` after EVERY query
- Salary recalculation loops through 11 salaries, each triggering a save
- Result: **11+ consecutive database saves** in 1-2 seconds
- Each save writes to: localStorage + GLOBAL + File System = **3 operations per save**
- Total: **33 filesystem operations** during salary recalculation alone

**Console Evidence:**
```
💰 Recalculating salary ID 1...
💾 Saving database (1800.00 KB)...
✅ PRIMARY: Saved to localStorage
✅ GLOBAL: Saved to cross-path key
💾 Saving database to file (1.76MB)...
✅ Database saved to: C:\AynBeirutPOS-Data\pos-database.sqlite
💾 Auto-backup created (1.76MB)
   ✅ Updated salary ID 1...
💰 Recalculating salary ID 2...
💾 Saving database (1800.00 KB)...
[repeats 11 times]
```

**Impact:** Main thread blocked for 2-5 seconds every app startup

---

### 2. **Salary Recalculation on Every App Start**

**Problem:**
- `recalculateExistingSalaries()` runs 2 seconds after app initialization
- Meant to be a "one-time fix for old records" (line 53 comment)
- Actually runs EVERY TIME the app starts
- Recalculates ALL 11 existing salaries unnecessarily

**Code Location:** `js/staff-management.js` lines 53-56
```javascript
// Recalculate any existing salaries with $0 (one-time fix for old records)
setTimeout(() => {
    recalculateExistingSalaries();  // ← Runs every startup!
}, 2000);
```

**Impact:** 2-5 second freeze during app initialization

---

### 3. **Virtual Keyboard Event Spam**

**Problem:**
- Logs "🎹 Input focused: product-price-input" 47+ times when typing one number
- Excessive console.log operations slow down the dev tools and main thread

**Console Evidence:**
```
🎹 Input focused: product-price-input
🎹 Using numeric keyboard
[repeats 47+ times in 2 seconds]
```

**Impact:** Minor slowdown, but compounds with other issues

---

### 4. **Redundant Composed Product Calculations**

**Problem:**
- Same composed product (ID 46 "Bounty") calculated 8+ times per render
- No caching between calculations
- Happens on every product list render

**Console Evidence:**
```
🔍 Calculating stock for composed product ID: 46
📋 Recipe query result...
[repeats 8 times]
```

**Impact:** Unnecessary CPU cycles, delays rendering

---

### 5. **Multiple Product Renders**

**Problem:**
- Products rendered 3-4 times after a single action (add product)
- Each render triggers composed product calculations

**Console Evidence:**
```
🔄 Rendering 41 products...
[Complete render]
🔄 Refreshing POS product display after reload...
[Complete render again]
🔄 Refreshing main product menu...
[Complete render again]
```

**Impact:** 2-3x more work than necessary

---

## ✅ Solutions

### Fix #1: Batch Salary Recalculation (CRITICAL - Apply First!)

**File:** `js/staff-management.js` line 458

**Current Code (BAD):**
```javascript
async function recalculateExistingSalaries() {
    for (const salary of salaries) {
        // ... calculation ...
        
        await runExec(`UPDATE staff_payments ...`, [...]); // ← Saves DB here!
    }
    
    await saveDatabase(); // ← And saves again here!
}
```

**Fixed Code:**
```javascript
async function recalculateExistingSalaries() {
    try {
        console.log('🔄 Recalculating ALL existing salary records...');
        
        const salaries = runQuery(`
            SELECT id, staffId, periodStart, periodEnd, bonusAmount, deductions, netAmount
            FROM staff_payments
            WHERE paymentType = 'salary'
        `);
        
        console.log(`📊 Found ${salaries.length} salary records to recalculate`);
        
        // Use db.run() directly to avoid auto-save on each query
        for (const salary of salaries) {
            const periodStart = new Date(salary.periodStart).toISOString().split('T')[0];
            const periodEnd = new Date(salary.periodEnd).toISOString().split('T')[0];
            
            console.log(`💰 Recalculating salary ID ${salary.id} for staff ${salary.staffId}`);
            
            const calculated = await calculateSalaryForPeriod(salary.staffId, periodStart, periodEnd);
            const newNetAmount = calculated.totalAmount + (salary.bonusAmount || 0) - (salary.deductions || 0);
            
            console.log(`   Old: $${(salary.netAmount || 0).toFixed(2)}, New: $${newNetAmount.toFixed(2)}`);
            
            // Use db.run() directly instead of runExec() to avoid auto-save
            db.run(`
                UPDATE staff_payments
                SET baseAmount = ?, overtimeAmount = ?, netAmount = ?,
                    notes = ?
                WHERE id = ?
            `, [
                calculated.baseAmount,
                calculated.overtimeAmount,
                newNetAmount,
                `Recalculated: ${calculated.hours.total} total hours (${calculated.hours.regular} regular + ${calculated.hours.overtime} OT)`,
                salary.id
            ]);
            
            console.log(`   ✅ Updated salary ID ${salary.id} from $${(salary.netAmount || 0).toFixed(2)} to $${newNetAmount.toFixed(2)}`);
        }
        
        // Save database ONCE after all updates
        await saveDatabase();
        console.log('✅ All salary records recalculated (batch mode - 1 save)');
        return true;
    } catch (error) {
        console.error('Failed to recalculate salaries:', error);
        return false;
    }
}
```

**Result:** 11 saves reduced to 1 save (11x performance improvement!)

---

### Fix #2: Run Salary Recalculation Only Once

**File:** `js/staff-management.js` line 53

**Current Code (BAD):**
```javascript
// Recalculate any existing salaries with $0 (one-time fix for old records)
setTimeout(() => {
    recalculateExistingSalaries(); // ← Runs every startup!
}, 2000);
```

**Fixed Code:**
```javascript
// Recalculate salaries only if flag is set (one-time migration)
setTimeout(() => {
    const needsRecalculation = localStorage.getItem('salariesRecalculated') !== 'true';
    if (needsRecalculation) {
        console.log('🔧 First-time salary recalculation starting...');
        recalculateExistingSalaries().then(() => {
            localStorage.setItem('salariesRecalculated', 'true');
            console.log('✅ Salary recalculation complete - will not run again');
        });
    } else {
        console.log('✅ Salary recalculation skipped (already done)');
    }
}, 2000);
```

**Result:** 2-5 second freeze only happens ONCE (first startup), not every time

---

### Fix #3: Reduce Virtual Keyboard Logging

**File:** `js/virtual-keyboard.js` 

**Find these lines and reduce logging:**
```javascript
// BEFORE (excessive logging)
console.log('🎹 Input focused:', input.id);
console.log('🎹 Using numeric keyboard');

// AFTER (throttled logging - only log once per input)
if (window.lastLoggedInput !== input.id) {
    console.log('🎹 Input focused:', input.id);
    window.lastLoggedInput = input.id;
}
// Remove the "Using numeric keyboard" log entirely
```

**Result:** 47 logs reduced to 1 log per input field

---

### Fix #4: Cache Composed Product Stock

**File:** `js/product-management.js`

**Add caching mechanism:**
```javascript
// At top of file
const composedStockCache = new Map();
let cacheTimestamp = Date.now();

function calculateComposedProductStock(productId, skipCache = false) {
    // Clear cache every 5 seconds
    if (Date.now() - cacheTimestamp > 5000) {
        composedStockCache.clear();
        cacheTimestamp = Date.now();
    }
    
    // Return cached value if available
    if (!skipCache && composedStockCache.has(productId)) {
        return composedStockCache.get(productId);
    }
    
    // ... existing calculation code ...
    
    // Cache the result
    composedStockCache.set(productId, stock);
    return stock;
}
```

**Result:** 8 calculations reduced to 1 per render (8x improvement)

---

### Fix #5: Debounce Product Renders

**File:** `js/product-management.js`

**Add debounce:**
```javascript
let renderTimeout = null;

function renderProducts(forceImmediate = false) {
    if (forceImmediate) {
        clearTimeout(renderTimeout);
        doRenderProducts(); // immediate render
        return;
    }
    
    // Debounce - wait 100ms before rendering
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        doRenderProducts();
    }, 100);
}

function doRenderProducts() {
    // ... existing render code ...
}
```

**Result:** 3-4 renders reduced to 1 per action

---

## 📊 Expected Performance Improvement

### Before Fixes:
- **App startup:** 2-5 second freeze (salary recalculation)
- **Database saves:** 11+ per operation
- **Product renders:** 3-4x per action
- **Stock calculations:** 8x per product per render

### After Fixes:
- **App startup:** Freeze only on FIRST startup (one-time migration)
- **Database saves:** 1 per batch operation (11x improvement)
- **Product renders:** 1 per action (3-4x improvement)
- **Stock calculations:** 1 per product per render (8x improvement)

**Overall Expected Improvement:** 60-80% reduction in freezing/lag

---

## 🚀 Implementation Priority

1. **Fix #1 (CRITICAL):** Batch salary recalculation - Apply immediately
2. **Fix #2 (HIGH):** One-time salary recalculation - Apply immediately  
3. **Fix #4 (MEDIUM):** Cache composed stock - Apply soon
4. **Fix #5 (MEDIUM):** Debounce renders - Apply soon
5. **Fix #3 (LOW):** Reduce logging - Optional (dev mode only)

---

## 🧪 Testing After Fixes

1. **Test app startup:** Should be smooth after first launch
2. **Test adding products:** No freezing, immediate response
3. **Test staff management:** Smooth opening, no delays
4. **Test purchases modal:** Opens without lag
5. **Monitor console:** Should see "1 save" messages instead of multiple

---

## 📝 Additional Recommendations

1. **Consider lazy loading:** Load staff data only when staff button clicked
2. **Add loading indicators:** Show spinner during long operations
3. **Compress database backups:** Reduce file size for faster saves
4. **Use Web Workers:** Move heavy calculations off main thread
5. **Implement request animation frame:** For smooth UI updates

---

**Status:** Ready to implement fixes  
**Estimated Time:** 30-45 minutes for critical fixes  
**Expected Result:** 60-80% reduction in freezing issues
