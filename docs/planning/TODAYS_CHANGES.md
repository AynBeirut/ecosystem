# Remaining Issues - January 31, 2026

## 🧪 Testing URL
**Live:** https://market-flow-7b074.web.app  
**Local:** http://localhost:8080/  
**Network (Mobile):** http://192.168.0.106:8080/

---

## ✅ DEPLOYED & FIXED

### 1. **Invoice Discount Display** ✅
**Status:** FIXED & DEPLOYED  
**Change:** Better formatting with "Before" and "After" prices in green  
**Test:**
1. Create order with item discounts
2. Print/download invoice
3. **Expected:** Discount shows as separate line, "Before: $X" and "After: $Y" in green

### 2. **Account Statement VAT Calculation** ✅
**Status:** FIXED & DEPLOYED  
**Change:** Uses actual tax from order, not hardcoded 11%  
**Test:**
1. Create order WITHOUT tax
2. Go to Account Statement
3. **Expected:** VAT column shows $0.00, Net = Total

### 3. **Decimal Quantities** ✅
**Status:** WORKING  

### 4. **Customer Navigation** ✅
**Status:** WORKING

---

## ⏳ PENDING ISSUES (Need Your Testing/Feedback)

### 1. **Raw Materials Not Reducing in Production** ⏳
**Status:** CODE IS CORRECT - Need debugging  
**What to do:**
1. Open browser console (F12) before completing production
2. Complete a production batch
3. Take screenshot of:
   - Raw materials before
   - Raw materials after
   - Console errors (if any)
   - Recipe ingredients list
4. Share screenshots so I can identify the issue

---

### 2. **Cancelled Orders Still Showing** ⏳
**Status:** Need more info  
**You said:** "still not canceled"  
**What I need:**
1. Which page are you checking? (Orders list? Account Statement? Somewhere else?)
2. What's the invoice number?
3. Screenshot of where it's still showing
4. The code filters cancelled orders - need to see where it's not working

---

### 3. **Sales Person Dropdown Empty** ⏳
**Status:** Fixed code but need verification  
**What changed:** Now fetches both Staff AND Sub-Accounts collections  
**What to do:**
1. Go to Sub-Accounts
2. Create new sub-account with Role = "Sales"
3. Go to Orders → Create New Order
4. Click "Sales Person" dropdown
5. **Does the sub-account appear?**
6. If not, press F12, check Console for errors, take screenshot

---

## 📝 Testing Instructions

### For Each Pending Issue:

**Raw Materials:**
```bash
# Before completing production
1. Note raw material quantities
2. Open F12 console
3. Complete production
4. Check console for errors
5. Check raw materials again
```

**Cancelled Orders:**
```bash
# Tell me exactly where you see it
1. Cancel order INV-XXX
2. Where does it still show up?
3. Screenshot that page
```

**Sales Person:**
```bash
# Step by step
1. Sub-Accounts → Add (Role: Sales)
2. Save
3. Orders → Create Order
4. Sales Person dropdown
5. See the person? (Yes/No + screenshot if No)
```

---

## 🐛 Report Format

```
Issue: [Which one from above]
Browser: [Chrome/Firefox/Safari]
What I See: [Screenshot or description]
Console Errors: [Screenshot of F12 console red errors]
```

---

## 📊 Summary

**Deployed Today:**
- ✅ Better invoice discount display
- ✅ Correct VAT calculations (no more forced 11%)
- ✅ Sales person dropdown includes sub-accounts

**Awaiting Your Testing:**
- ⏳ Raw materials reduction (need debug info)
- ⏳ Cancelled orders visibility (need location)
- ⏳ Sales dropdown working (need confirmation)

---

**Live URL:** https://market-flow-7b074.web.app 🚀
