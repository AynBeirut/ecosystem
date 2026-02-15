# 🔧 TODO LIST - Tomorrow Morning
**Date:** February 15, 2026

---

## ⚡ PRIORITY ORDER

### 1. 🔴 Production Complete Button (CRITICAL)
**Issue:** Button not responding, creates duplicate entries in finish goods

**Tasks:**
- [ ] Disable button after first click
- [ ] Add loading spinner/state
- [ ] Prevent multiple submissions
- [ ] Auto-generate completion date (don't require manual entry)
- [ ] Show success message after completion

**Test:**
- [ ] Click complete once → verify single entry in finish goods
- [ ] Try clicking multiple times → should be disabled after first click
- [ ] Check date is auto-filled correctly
- [ ] Verify production moves to correct status

---

### 2. 🔴 Account Statement Filter Bug (CRITICAL)
**Issue:** Filter shows correct items but calculates totals from ALL items

**Tasks:**
- [ ] Fix calculation to use only filtered items
- [ ] Update total sold amount
- [ ] Update total quantity
- [ ] Update total revenue

**Test:**
- [ ] Filter by single product → verify total matches only that product
- [ ] Filter by date range → verify totals match filtered dates only
- [ ] Filter by customer → verify totals match only that customer
- [ ] Clear filter → verify totals show all items again

---

### 3. 🔴 Account Statement Print - Net Amount (CRITICAL)
**Issue:** Net amount wrong on printed statement

**Tasks:**
- [ ] Find net amount calculation in print template
- [ ] Debug what values are being used
- [ ] Fix calculation formula
- [ ] Test with different scenarios

**Test:**
- [ ] Print statement with payments → verify net = total - payments
- [ ] Print statement without payments → verify net = total
- [ ] Print statement with discounts → verify net calculation correct
- [ ] Compare printed vs screen display

---

### 4. 🟡 Input Fields - Decimal Entry
**Issue:** Can enter 0.0006 but not 1.9456, unremovable zeros

**Tasks:**
- [ ] Allow any decimal format in all number inputs
- [ ] Add validation for empty fields with clear error messages
- [ ] Fix unremovable zero behavior
- [ ] Test edge cases (0, 0.0, 1.9456, 0.007, etc.)

**Test:**
- [ ] Enter 1.9456 → should accept
- [ ] Enter 0.007 → should accept
- [ ] Enter 123.456789 → should accept
- [ ] Leave empty and submit → should show error
- [ ] Enter invalid text → should show error

---

### 5. 🟡 Products Page - Total Revenue
**Issue:** Total revenue showing incorrect amount

**Tasks:**
- [ ] Review revenue calculation logic
- [ ] Check if it includes all order statuses
- [ ] Check if it excludes voided/cancelled orders
- [ ] Fix calculation

**Test:**
- [ ] Create test order → verify revenue updates
- [ ] Complete order → verify revenue correct
- [ ] Cancel order → verify revenue excludes it
- [ ] Compare with actual order totals

---

### 6. 🟡 Recipe Edit Behavior
**Issue:** Need to ask user how to handle cost changes

**Tasks:**
- [ ] Add dialog when editing recipe
- [ ] Option 1: "Apply only to new production" (recommended)
- [ ] Option 2: "Update existing inventory costs"
- [ ] Show warning about retroactive changes
- [ ] Implement selected option logic

**Test:**
- [ ] Edit recipe → dialog appears
- [ ] Select "new production only" → old inventory unchanged
- [ ] Select "update existing" → inventory costs update
- [ ] Check past orders remain unchanged

---

### 7. 🟢 Seller Orders - Search Bar
**Tasks:**
- [ ] Add search input at top of orders page
- [ ] Search by: order ID, customer name, product name
- [ ] Real-time filtering as user types
- [ ] Clear search button

**Test:**
- [ ] Search by customer name → shows only their orders
- [ ] Search by product → shows orders containing that product
- [ ] Search by order ID → shows exact match
- [ ] Clear search → shows all orders

---

### 8. 🟢 Client Numbering System
**Tasks:**
- [ ] Add clientNumber field to customer collection
- [ ] Auto-generate on customer creation (C-00001, C-00002...)
- [ ] Display in customer list
- [ ] Use in invoices/statements

**Test:**
- [ ] Create new customer → auto-assigned number
- [ ] Check number is unique
- [ ] Verify number shows in customer details
- [ ] Verify number shows on invoice

---

### 9. 🟢 Invoice - Client Tax ID
**Tasks:**
- [ ] Add Tax ID field to customer form (if not exists)
- [ ] Display Tax ID at bottom of invoice/facture
- [ ] Show only if Tax ID exists

**Test:**
- [ ] Add Tax ID to customer
- [ ] Generate invoice → Tax ID appears
- [ ] Customer without Tax ID → invoice prints without issue

---

## 📋 END OF DAY CHECKLIST

- [ ] All critical bugs (🔴) fixed and tested
- [ ] Git commit with descriptive message
- [ ] Test on localhost before deploying
- [ ] Deploy to Firebase
- [ ] Test on live site
- [ ] Update this TODO with completion status
- [ ] Move incomplete items to next day

---

## ⏰ ESTIMATED TIME

| Task | Estimate |
|------|----------|
| Production Complete | 1-2 hours |
| Account Filter Bug | 1 hour |
| Print Net Amount | 30 min |
| Input Decimals | 1 hour |
| Products Revenue | 1 hour |
| Recipe Edit Dialog | 2 hours |
| Search Bar | 1 hour |
| Client Numbers | 1 hour |
| Invoice Tax ID | 30 min |
| **TOTAL** | **9-10 hours** |

**Recommendation:** Focus on critical bugs first (items 1-3), test thoroughly, then deploy.
