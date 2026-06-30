# 📘 New Contributor Guide - Ayn Beirut POS

**Last Updated:** February 7, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## 🎯 Project Overview

**Ayn Beirut POS** is a full-featured Point of Sale system built with **Electron + SQL.js** for Windows desktop.  
Offline-first architecture designed for restaurants and retail businesses.

### Tech Stack
- **Runtime:** Electron 28.3.3 (Node.js + Chromium)
- **Database:** SQL.js (SQLite in WebAssembly)
- **Frontend:** Vanilla JavaScript ES6+, HTML5, CSS3
- **Storage:** File system (C:\AynBeirutPOS-Data\pos-database.sqlite)
- **Build:** electron-builder

---

## 🚀 Recent Major Features (Jan 2026)

### 1. ✅ Partial Payment System
**Implementation Date:** January 17-23, 2026  
**Status:** Complete and tested

**Features:**
- Accept down payments on invoices
- Track remaining balances per invoice
- View all open partial payment invoices
- Receive additional payments on open invoices
- Automatically close invoice when fully paid
- Real-time balance calculation
- Receipt generation for each payment

**Key Files:**
- `js/partial-payments.js` (280+ lines)
- `migrations/019-partial-payments.sql` (database schema)
- `js/payment.js` (updated with partial payment logic)
- `js/unpaid-orders.js` (updated to show partial payments)

**Database Tables:**
- `sales` table: Added `paymentStatus`, `remainingBalance`, `downPayment` columns
- `partial_payments` table: Tracks payment history

**How It Works:**
1. Customer makes down payment → Invoice marked as `paymentStatus='partial'`
2. Invoice appears in "Unpaid Orders" list with remaining balance
3. Additional payments reduce `remainingBalance`
4. When `remainingBalance` reaches 0 → `paymentStatus='paid'`

**Debug Logging:**
- Extensive console.log statements in `receivePartialPayment()` function
- Tracks payment calculations: oldBalance, newBalance, paymentStatus
- Database query confirmations after UPDATE and INSERT

---

### 2. ✅ Staff Attendance Correction System
**Implementation Date:** January 23, 2026  
**Status:** Complete and tested

**Features:**
- View last 30 days of attendance history
- Edit ONLY the most recent attendance record (fraud prevention)
- Delete ONLY the most recent attendance record (with confirmation)
- Professional modal UI with datetime-local inputs
- Color-coded status badges (⏰ ACTIVE, ✅ COMPLETE)
- Highlighted most recent record (yellow background)

**Key Files:**
- `js/staff-management.js` (major additions ~250+ lines)
  - `viewStaffAttendanceHistory(staffId)` - History viewer
  - `editAttendanceRecord(recordId, checkInTime, checkOutTime)` - Modal editor
  - `deleteAttendanceRecord(recordId, staffId)` - Deletion with confirmation
  - `editAttendanceFromButton(button)` - Wrapper for data attributes
  - `deleteAttendanceFromButton(button)` - Wrapper for data attributes

**Database:**
- Table: `staff_attendance`
- Columns: `id`, `staffId`, `attendanceDate` (TEXT YYYY-MM-DD), `checkInTime` (INTEGER unix timestamp), `checkOutTime` (INTEGER unix timestamp)

**UI Changes:**
- **⏰ Green button** - "Register Attendance (Check-in/Check-out)" → Opens form to record NEW attendance
- **📅 Calendar button** - "View Attendance History & Edit Last Record" → Opens history modal

**Important Notes:**
- Query changed from "timestamp" (doesn't exist) to "attendanceDate >= ?" 
- Uses datetime-local input type (not prompt() - Electron doesn't support it)
- Data attributes approach (not inline onclick parameters) to avoid syntax errors with null values
- Validation ensures check-out > check-in

**Why Modal Instead of Prompt:**
- Electron deprecated prompt() → shows error: "prompt() is and will not be supported"
- Modal provides better UX with datetime-local pickers
- Displays current values as reference below inputs

---

### 3. ✅ Sales Reports - Tax & Discount Display
**Implementation Date:** January 23, 2026  
**Status:** Complete

**Features:**
- Tax and discount information now visible in expanded sale details
- Yellow box for discount: "💰 Discount: X% ($X.XX)"
- Blue box for tax: "🧾 Tax (11%): $X.XX"

**Key Files:**
- `js/reports.js` (lines ~1320-1385)
- Created `taxDiscountInfo` variable that builds HTML
- Integrated into `itemsList` display

---

## 📋 Essential Documentation to Read

**For NEW contributors starting work on this project, read these files in order:**

### 1. **NEW-CONTRIBUTOR-GUIDE.md** (THIS FILE)
   - Overview of project and recent changes
   - Essential context for all conversations

### 2. **README.md**
   - Full feature list
   - System requirements
   - Project structure
   - Architecture overview

### 3. **IMPLEMENTATION-STATUS.md**
   - Current implementation status
   - What's completed vs pending
   - Detailed partial payment implementation notes

### 4. **PARTIAL-PAYMENT-IMPLEMENTATION.md**
   - Complete technical documentation of partial payment system
   - Step-by-step implementation details
   - Database schema changes

### 5. **STAFF_BALANCE_IMPLEMENTATION.md** (if working on staff features)
   - Staff management system documentation
   - Payroll processing
   - Attendance tracking

### 6. **BARCODE-REFERENCE.md** (if working on inventory)
   - Product management
   - Barcode system

### 7. **ELECTRON-GUIDE.md** (if working on desktop features)
   - Electron-specific implementation
   - IPC communication
   - Print system

---

## 🛠️ Development Setup

### 1. Prerequisites
```powershell
# Node.js 18+ required
node --version

# Install dependencies
cd c:\Users\Alaa\Documents\githup\pos\posfinal\pos-v1
npm install
```

### 2. Run Development
```powershell
# Start the app
npm start

# Or use batch file
.\START-POS.bat
```

### 3. Build Production
```powershell
# Create installer
npm run dist

# Output: dist\Ayn Beirut POS-1.0.0-win.exe
```

---

## 📂 Key File Locations

### JavaScript Modules (js/)
- **app.js** - Application initialization & auth
- **pos-core.js** - Core POS logic (cart, checkout)
- **payment.js** - Payment processing (includes partial payment logic)
- **partial-payments.js** - Partial payment management
- **unpaid-orders.js** - Hold/retrieve orders, partial payment list
- **staff-management.js** - Staff attendance, payroll, editing
- **reports.js** - Sales reports (includes tax/discount display)
- **receipt.js** - Receipt generation & printing
- **db-sql.js** - Database operations wrapper
- **migrations-bundle.js** - All database migrations bundled

### Database Migrations (migrations/)
- **019-partial-payments.sql** - Adds partial payment support
- **bundle-migrations.js** - Script to bundle all migrations

### HTML
- **index.html** - Main application (includes partial payment UI)
- **login.html** - Authentication page

---

## 🗄️ Database Schema (Key Tables)

### Sales Table (Updated)
```sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  receiptNumber TEXT UNIQUE,
  totalAmount REAL,
  paymentMethod TEXT,
  paymentStatus TEXT DEFAULT 'paid',      -- NEW: 'paid' or 'partial'
  remainingBalance REAL DEFAULT 0,        -- NEW: Remaining to be paid
  downPayment REAL DEFAULT 0,             -- NEW: Initial down payment
  timestamp INTEGER,
  cashierId INTEGER,
  customerName TEXT,
  ...
);
```

### Partial Payments Table (New)
```sql
CREATE TABLE partial_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saleId INTEGER NOT NULL,
  paymentAmount REAL NOT NULL,
  paymentMethod TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  receiptNumber TEXT,
  cashierId INTEGER,
  notes TEXT,
  FOREIGN KEY (saleId) REFERENCES sales(id)
);
```

### Staff Attendance Table
```sql
CREATE TABLE staff_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staffId INTEGER NOT NULL,
  attendanceDate TEXT,              -- Format: YYYY-MM-DD
  checkInTime INTEGER,              -- Unix timestamp
  checkOutTime INTEGER,             -- Unix timestamp (null if still active)
  FOREIGN KEY (staffId) REFERENCES staff(id)
);
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Partial Payment Invoices Disappearing
**Problem:** Invoices with remaining balance don't show in unpaid orders list  
**Solution:** Query filter must include `remainingBalance > 0` check  
**File:** `js/db-sql.js` - `getAllUnpaidOrders()` function  
**Fix:** `WHERE paymentStatus = "partial" AND remainingBalance > 0`

### Issue 2: Tax/Discount Buttons Freezing
**Problem:** After partial payment operations, tax/discount buttons stop responding  
**Solution:** Use `runExec()` with proper `await`, call both loaders after payment  
**File:** `js/partial-payments.js` - `receivePartialPayment()` function  
**Fix:** Call both `loadPartialPayments()` and `loadUnpaidOrders()` after payment

### Issue 3: Staff Attendance Query Fails
**Problem:** Error "no such column: timestamp" in staff_attendance table  
**Solution:** Table uses `attendanceDate` (not timestamp) for date filtering  
**File:** `js/staff-management.js` - `viewStaffAttendanceHistory()` function  
**Fix:** Query `WHERE attendanceDate >= ?` with format YYYY-MM-DD

### Issue 4: JavaScript Syntax Error in Onclick
**Problem:** "missing ) after argument list" when clicking edit/delete attendance  
**Solution:** Use data attributes instead of inline onclick parameters  
**File:** `js/staff-management.js`  
**Fix:** 
```javascript
// ❌ Bad: onclick="editAttendanceRecord(${id}, ${time}, ${null})"
// ✅ Good: data-record-id="${id}" onclick="editAttendanceFromButton(this)"
```

### Issue 5: Electron Prompt Error
**Problem:** "prompt() is and will not be supported" error in Electron  
**Solution:** Replace prompt() with proper modal dialogs  
**File:** `js/staff-management.js` - `editAttendanceRecord()` function  
**Fix:** Use modal with datetime-local inputs instead of prompt()

---

## 🧪 Testing Workflow

### Test Partial Payments
1. Login as admin
2. Add items to cart
3. Click "Place Order"
4. Check "Partial Payment" checkbox
5. Enter down payment (less than total)
6. Complete payment → Invoice stays in "Unpaid Orders"
7. Click "Unpaid Orders" → should see invoice with remaining balance
8. Make additional payment → remaining balance should decrease
9. Pay full remaining amount → invoice should disappear from list

### Test Staff Attendance Correction
1. Navigate to Staff Management
2. Click ⏰ green button → Record attendance (check-in)
3. Click 📅 calendar button → View attendance history
4. Most recent record should have yellow background
5. Click ✏️ edit button on most recent record
6. Modal should open with datetime-local inputs
7. Change times → Click "✅ Save Changes"
8. Verify changes persist in history list
9. Click 🗑️ delete button → Confirm deletion
10. Record should be removed

### Test Sales Reports
1. Create a sale with tax and discount applied
2. Navigate to Reports → Sales Report
3. Find the sale and expand details
4. Should see yellow box with discount info
5. Should see blue box with tax info

---

## 🔄 Git Workflow

### Latest Commit
```
Commit: 3aa2f1cc0
Date: January 31, 2026
Message: Add partial payments, staff attendance correction, and sales report enhancements

Changes:
- 15 files changed
- 1,718 insertions, 27 deletions
```

### Repository
- **Owner:** AynBeirut
- **Repo:** posfinal
- **Branch:** main

### Common Commands
```powershell
# Check status
git status

# Stage all changes
git add -A

# Commit
git commit -m "Your message"

# Push to GitHub
git push origin main

# Build after changes
npm run dist
```

---

## 💡 Tips for New Contributors

1. **Always read console logs** - Extensive debug logging implemented for partial payments
2. **Check Electron DevTools** - Press F12 in app to see console
3. **Test in production build** - Some features (like prompt) behave differently in Electron
4. **Use data attributes** - Avoid inline onclick parameters with variables
5. **Query actual schema** - Check database structure before writing queries
6. **Call multiple loaders** - When data affects multiple views, refresh all of them
7. **Validate datetime inputs** - Always check check-out > check-in
8. **Use modals not prompts** - Electron doesn't support browser prompts

---

## 📞 Support & Resources

- **GitHub Issues:** https://github.com/AynBeirut/posfinal/issues
- **Project Root:** `c:\Users\Alaa\Documents\githup\pos\posfinal\pos-v1\`
- **Database Location:** `C:\AynBeirutPOS-Data\pos-database.sqlite`
- **Backups:** `C:\AynBeirutPOS-Backups\`

---

## 📝 Next Features to Implement (Roadmap)

- [ ] Cloud synchronization (VPS endpoint)
- [ ] Multi-store support
- [ ] Advanced reporting & analytics
- [ ] Customer loyalty program
- [ ] Email receipt delivery
- [ ] Inventory forecasting
- [ ] Mobile app companion

---

**Welcome to the team! Start by reading the documentation files listed above, then dive into the code.** 🚀
