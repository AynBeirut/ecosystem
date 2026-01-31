# Today's Changes - January 31, 2026

## 🧪 Testing URL
**Local:** http://localhost:8080/  
**Network (Mobile):** http://192.168.0.106:8080/

---

## ✅ Fixed Issues (Ready to Test)

### 1. **Invoice Discounts Display**
**What Changed:** Item-level discounts now appear on printed/downloaded invoices  
**How to Test:**
1. Go to Orders → Create New Order
2. Add 2-3 items with different discounts:
   - Item 1: 10% discount
   - Item 2: $5.00 fixed discount
   - Item 3: No discount
3. Create the order
4. Click "Print" or "Download PDF"
5. **Expected:** 
   - Discount type/value shown below item name in red
   - Original price shown with strikethrough
   - Final discounted price displayed correctly

---

### 2. **Decimal Quantities Support**
**What Changed:** Can now enter decimal quantities (1.5, 2.75, etc.)  
**How to Test:**
1. Go to Orders → Create New Order
2. Add an item
3. Try entering quantities: `1.5`, `0.75`, `2.3`, `10.25`
4. **Expected:** 
   - All decimal values accepted
   - Calculations correct
   - Order creates successfully

---

### 3. **Customer Card Navigation**
**What Changed:** Clicking "Customers" card on dashboard now navigates to customers page  
**How to Test:**
1. Go to Admin Dashboard
2. Find the "Customers" card (shows count: "2")
3. Click anywhere on the card
4. **Expected:** 
   - Navigates to `/admin/customers`
   - Shows customer list
   - Hover shows shadow effect

---

### 4. **Cancelled Orders Filtering**
**What Changed:** Cancelled orders no longer appear in Account Statement  
**How to Test:**
1. Create a test order (e.g., INV-025)
2. Go to Account Statement → verify it appears in Sales History
3. Go back to Orders → Cancel the order
4. Return to Account Statement
5. **Expected:**
   - INV-025 no longer in Sales History table
   - Customer balance doesn't include cancelled order
   - Detailed customer statement also excludes it

---

### 5. **Sales Person Dropdown**
**What Changed:** Sub-accounts with "Sales" role now appear in sales person dropdown  
**How to Test:**
1. Go to Sub-Accounts → Add a new sub-account
2. Set Role: "Sales"
3. Save the sub-account
4. Go to Orders → Create New Order
5. Click "Sales Person" dropdown
6. **Expected:**
   - The sales sub-account appears in the list
   - Can select and assign to order
   - Both staff and sub-accounts visible

---

## 📋 Quick Test Checklist

```
[ ] 1. Invoice shows item discounts correctly
[ ] 2. Can enter quantity: 1.5
[ ] 3. Can enter quantity: 0.75
[ ] 4. Dashboard → Customers card navigates
[ ] 5. Cancelled order disappears from Account Statement
[ ] 6. Sales sub-account appears in dropdown
```

---

## 🔍 Known Issues (Not Yet Fixed)

### ⏳ Raw Materials Not Reducing in Production
**Status:** Under investigation  
**What to Check:**
1. Create a production batch
2. Click "Complete Production" (not just "Start")
3. Check browser console (F12) for errors
4. Verify raw materials stock actually reduces

**Please report:**
- Does raw material stock change?
- Any console errors?
- Does finished goods increase?
- Screenshots if possible

---

## 📝 Testing Tips

1. **Clear Browser Cache:** Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) to hard refresh
2. **Check Console:** Press `F12` to open Developer Tools → Console tab for errors
3. **Test on Mobile:** Use http://192.168.0.106:8080/ on your phone
4. **Multiple Scenarios:** Try edge cases (0 discount, 100% discount, very small decimals like 0.01)

---

## 🐛 Bug Report Format

If you find issues, please report:
```
Issue: [Brief description]
Page: [Where it occurs]
Steps: 
1. [What you did]
2. [What you clicked]
Expected: [What should happen]
Actual: [What actually happened]
Console Errors: [Any red errors in F12 console]
```

---

## ⚙️ Changes Made Today

**Files Modified:**
- `src/lib/invoiceTemplates.ts` - Added discount display to invoice items
- `src/pages/admin/AdminOrders.tsx` - Decimal quantities + sub-accounts in dropdown
- `src/pages/admin/AdminDashboard.tsx` - Customer card navigation
- `src/pages/admin/AdminAccountStatement.tsx` - Filter cancelled orders
- `TESTING_CHECKLIST.md` - Comprehensive test document created

**Next Deployment:** After you confirm all tests pass

---

**Ready to test!** 🚀
