# Latest Changes - Quick Reference

**Last Updated:** February 7, 2026  
**Commit:** 3aa2f1cc0  
**Date Range:** January 17 - 31, 2026

---

## 🆕 What's New

### 1. Partial Payment System
Accept down payments and track installment payments on invoices.

**Features:**
- Accept down payments (customer pays part now, rest later)
- Track remaining balance per invoice
- View all open partial payment invoices
- Receive additional payments
- Auto-close when fully paid
- Receipt for each payment

**How to Use:**
1. Place order → Check "Partial Payment" box
2. Enter down payment amount
3. Complete payment → Invoice stays in "Unpaid Orders"
4. Customer returns → Click "Unpaid Orders"
5. Select invoice → Make additional payment
6. Repeat until fully paid

**Files Changed:**
- `js/partial-payments.js` (NEW - 280 lines)
- `js/payment.js` (updated)
- `js/unpaid-orders.js` (updated)
- `js/db-sql.js` (updated queries)
- `migrations/019-partial-payments.sql` (NEW)

---

### 2. Staff Attendance Correction
Edit or delete the most recent attendance record (like refund for attendance).

**Features:**
- View last 30 days of attendance
- Edit ONLY most recent record
- Delete ONLY most recent record
- Datetime picker for precise editing
- Color-coded status badges
- Fraud prevention (can't edit old records)

**How to Use:**
1. Staff Management → Find employee
2. Click **⏰ green button** to record NEW attendance
3. Click **📅 calendar button** to view history
4. Most recent record has ✏️ edit and 🗑️ delete buttons
5. Edit times or delete if mistake made

**Important:**
- Old records show "-" (cannot edit)
- Only latest record can be corrected
- Prevents payroll fraud

**Files Changed:**
- `js/staff-management.js` (~250 lines added)

---

### 3. Sales Reports Enhancement
Tax and discount now visible in sale details.

**Features:**
- Discount shown in yellow box
- Tax shown in blue box
- Both percentage and dollar amounts displayed

**How to Use:**
1. Reports → Sales Report
2. Find sale with tax/discount
3. Expand details
4. See colored boxes with amounts

**Files Changed:**
- `js/reports.js` (updated display)

---

## 🐛 Bugs Fixed

### Partial Payments
- ✅ Invoices disappearing from unpaid orders (query filtering)
- ✅ Tax/discount buttons freezing (async/await handling)
- ✅ Balance not updating (added dual loader calls)

### Staff Attendance
- ✅ JavaScript syntax error (null values in onclick)
- ✅ Electron prompt() error (replaced with modals)
- ✅ Wrong column name (timestamp → attendanceDate)
- ✅ User confusion (added separate buttons)

---

## 📊 Database Changes

### New Table
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

### Updated Table
```sql
-- sales table
ALTER TABLE sales ADD COLUMN paymentStatus TEXT DEFAULT 'paid';
ALTER TABLE sales ADD COLUMN remainingBalance REAL DEFAULT 0;
ALTER TABLE sales ADD COLUMN downPayment REAL DEFAULT 0;
```

---

## 🎬 UI Changes

### Staff Management
**Before:** Single 📅 button (confusing)  
**After:** Two buttons
- ⏰ Register Attendance (green) - for NEW check-in/check-out
- 📅 View History (calendar) - for reviewing and correcting

### Payment Modal
**Before:** No partial payment option  
**After:** Checkbox + input for down payment with real-time balance calculation

### Sales Reports
**Before:** Tax/discount not visible  
**After:** Color-coded boxes showing amounts

---

## 🔧 Technical Changes

### Better Error Handling
- Extensive console.log debugging in partial-payments.js
- Tracks: oldBalance, newBalance, paymentStatus, willStayInList
- Database confirmation logs after queries

### Electron Compatibility
- Replaced prompt() with modal dialogs
- Used datetime-local inputs instead of text
- Data attributes instead of inline onclick parameters

### Query Optimization
- Changed runQuery to runExec with await
- Added remainingBalance > 0 filter
- Fixed column name references (attendanceDate vs timestamp)

---

## 📦 Build Info

**Installer:** dist\Ayn Beirut POS-1.0.0-win.exe  
**Size:** ~125 MB  
**Platform:** Windows x64  
**Build Date:** January 31, 2026

**Build Command:**
```powershell
npm run dist
```

---

## 📚 Documentation Updates

**New Files:**
- NEW-CONTRIBUTOR-GUIDE.md (complete onboarding)
- LATEST-CHANGES.md (this file)

**Updated Files:**
- README.md (added new features)
- IMPLEMENTATION-STATUS.md (current status)

---

## 🎯 Testing Checklist

### Partial Payments
- [ ] Create sale with down payment
- [ ] Verify appears in unpaid orders
- [ ] Make additional payment
- [ ] Verify balance reduces
- [ ] Pay full amount
- [ ] Verify disappears from list

### Staff Attendance
- [ ] Register new attendance (⏰ button)
- [ ] View history (📅 button)
- [ ] Edit most recent record
- [ ] Verify changes save
- [ ] Delete most recent record
- [ ] Verify removal

### Sales Reports
- [ ] Create sale with tax
- [ ] Create sale with discount
- [ ] View sales report
- [ ] Expand sale details
- [ ] Verify tax/discount boxes show

---

## 🚀 Quick Commands

```powershell
# Run app
cd c:\Users\Alaa\Documents\githup\pos\posfinal\pos-v1
npm start

# Build installer
npm run dist

# Git workflow
git status
git add -A
git commit -m "Your message"
git push origin main
```

---

## 📞 Need Help?

Read these files in order:
1. **NEW-CONTRIBUTOR-GUIDE.md** - Start here
2. **IMPLEMENTATION-STATUS.md** - Current status
3. **LATEST-CHANGES.md** - This file
4. **PARTIAL-PAYMENT-IMPLEMENTATION.md** - Payment details
5. **README.md** - Full documentation
