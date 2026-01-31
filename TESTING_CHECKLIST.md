# Market Flow - Testing Checklist

## Current Issues to Test

### 1. ✅ Invoice Display - FIXED
**Issue:** Item-level discounts not showing on printed/downloaded invoices  
**Status:** Fixed  
**Test Steps:**
1. Create an order with items that have discounts
2. Print or download the invoice
3. Verify discounts show below item names
4. Verify original prices show with strikethrough when discounted
5. Verify final prices are correct

### 2. ✅ Decimal Quantities - FIXED
**Issue:** Cannot enter decimal quantities (e.g., 1.5) in order items  
**Status:** Fixed  
**Test Steps:**
1. Go to Orders > Create New Order
2. Add an item
3. Try entering quantity: 1.5
4. Verify it accepts the decimal value
5. Try other decimals: 0.5, 2.75, 10.25
6. Create the order and verify calculations are correct

### 3. ✅ Customer Navigation - FIXED
**Issue:** Clicking "Customers" card on dashboard doesn't navigate  
**Status:** Fixed  
**Test Steps:**
1. Go to Admin Dashboard
2. Click on the "Customers" card (shows customer count)
3. Verify it navigates to /admin/customers page
4. Verify you can view, add, edit customers

### 4. ✅ Cancelled Invoices in Account Statement - FIXED
**Issue:** Cancelled orders still showing in Account Statement as unpaid  
**Status:** Fixed  
**Test Steps:**
1. Create an order (e.g., INV-020)
2. Note it appears in Account Statement > Sales History
3. Cancel the order from Orders page
4. Go back to Account Statement
5. Verify INV-020 no longer appears in Sales History
6. Verify customer balance is correct (doesn't include cancelled order)
7. Test detailed customer statement - cancelled orders should not appear

### 5. ⏳ Raw Materials Not Reducing - PENDING
**Issue:** When completing production, finished goods are created but raw materials stock doesn't reduce  
**Status:** Investigating  
**Test Steps:**
1. Check current raw material stock (e.g., Flour: 100kg)
2. Create a production batch requiring 10kg Flour
3. Start the production batch
4. Complete the production batch (enter actual quantity)
5. Check raw materials - verify Flour reduced to 90kg
6. Check finished goods - verify new items added
7. Verify cost calculation is correct

**Debug Points:**
- Check if recipe has ingredients linked
- Check if raw material IDs match in recipe
- Check browser console for errors during completion
- Verify the production goes to "completed" status
- Check if materials have stock available

---

## Recently Fixed Features

### ✅ Swipe Gesture Navigation
**Status:** Deployed  
**Test:**
- Open on mobile device
- Navigate to Inventory Overview
- Swipe right from left edge
- Verify returns to Dashboard
- Verify tutorial shows on first visit only

### ✅ Item-Level Discounts
**Status:** Deployed  
**Test:**
- Create order with item discounts (percentage and fixed)
- Verify calculations are correct
- Verify order-level discount still works
- Verify both discounts can be applied together

### ✅ Production Date Filters
**Status:** Deployed  
**Test:**
- Go to Production Planning
- Set "From" date
- Set "To" date
- Verify only batches in range show
- Click "Clear Dates" - verify all batches show

---

## Full System Test Suite

### Authentication
- [ ] Sign up with new account
- [ ] Login with existing account
- [ ] Logout
- [ ] Password reset (if implemented)
- [ ] Session persistence

### Products Management
- [ ] Add new product
- [ ] Edit existing product
- [ ] Delete product (with zero stock)
- [ ] View product details
- [ ] Search/filter products
- [ ] Product categories work correctly

### Raw Materials
- [ ] Add raw material
- [ ] Edit raw material cost
- [ ] Delete raw material (with zero stock)
- [ ] View stock levels
- [ ] Purchase raw materials (increases stock)

### Recipes
- [ ] Create recipe with ingredients
- [ ] Edit recipe
- [ ] Delete recipe
- [ ] View recipe cost breakdown
- [ ] Recipe calculations correct

### Composed Products
- [ ] Link product to recipe
- [ ] View composed product details
- [ ] Edit composed product
- [ ] Delete composed product

### Production Planning
- [ ] Create production batch
- [ ] Start production (status changes)
- [ ] Complete production:
  - [ ] Raw materials reduce correctly
  - [ ] Finished goods increase correctly
  - [ ] Cost per unit calculated correctly
  - [ ] FIFO batches created
- [ ] Cancel production batch
- [ ] Filter by date range
- [ ] Filter by status

### Orders/Sales
- [ ] Create order with single item
- [ ] Create order with multiple items
- [ ] Apply item-level discount (percentage)
- [ ] Apply item-level discount (fixed amount)
- [ ] Apply order-level discount
- [ ] Apply both item and order discounts
- [ ] Enter decimal quantities (1.5, 0.75, etc.)
- [ ] Calculate tax correctly
- [ ] Record payment (partial)
- [ ] Record payment (full)
- [ ] Print invoice (verify discounts show)
- [ ] Download PDF invoice
- [ ] Share invoice (mobile)
- [ ] View order details
- [ ] Edit order (if allowed)
- [ ] Cancel order
- [ ] Verify stock reduces on order creation

### Customers
- [ ] Add new customer
- [ ] Edit customer details
- [ ] Delete customer (with no orders)
- [ ] View customer orders
- [ ] View customer balance
- [ ] Record customer payment
- [ ] View customer statement
- [ ] Navigate from dashboard card

### Sales Returns
- [ ] Create return from order
- [ ] Select items to return
- [ ] Specify quantities
- [ ] Process return
- [ ] Verify stock increases
- [ ] Verify customer credit issued

### Suppliers
- [ ] Add new supplier
- [ ] Edit supplier
- [ ] Delete supplier (with no purchases)
- [ ] View supplier balance
- [ ] Make payment to supplier

### Purchases
- [ ] Create purchase order
- [ ] Add raw materials to purchase
- [ ] Calculate totals
- [ ] Record purchase
- [ ] Verify raw materials stock increases
- [ ] Print purchase order
- [ ] Record payment
- [ ] View purchase history

### Expenses
- [ ] Add expense
- [ ] Categorize expense
- [ ] Edit expense
- [ ] Delete expense
- [ ] View expense report
- [ ] Filter by date
- [ ] Filter by category

### Staff Management
- [ ] Add staff member
- [ ] Assign role
- [ ] Set salary
- [ ] Edit staff details
- [ ] Terminate staff:
  - [ ] Verify future salaries deleted
  - [ ] Verify historical data preserved
- [ ] View staff list

### Account Statement
- [ ] View overall account summary
- [ ] View supplier statements
- [ ] View customer statements:
  - [ ] Verify cancelled orders excluded
  - [ ] Verify balance calculations correct
- [ ] View sales history:
  - [ ] Verify cancelled orders excluded
  - [ ] Verify totals correct
- [ ] Export reports (if available)

### Dashboard
- [ ] View metrics (Products, Orders, Revenue, Customers)
- [ ] Click each metric card navigates correctly
- [ ] View recent activity
- [ ] USD to LBP conversion displays
- [ ] All quick actions work

### Mobile Experience
- [ ] Responsive layout on phone
- [ ] Responsive layout on tablet
- [ ] Swipe gesture works
- [ ] Touch controls work smoothly
- [ ] Keyboard doesn't overlap inputs
- [ ] Tutorial appears on first visit
- [ ] Can install as PWA

### Navigation
- [ ] Desktop sidebar navigation works
- [ ] Mobile menu works
- [ ] Breadcrumbs work
- [ ] Back button works
- [ ] All links navigate correctly

### Data Integrity
- [ ] Stock levels accurate across pages
- [ ] Balances calculate correctly
- [ ] FIFO costing works correctly
- [ ] Transactions history accurate
- [ ] No duplicate entries
- [ ] Deleted items don't show in lists

### Performance
- [ ] Pages load quickly
- [ ] No console errors
- [ ] Real-time updates work
- [ ] Offline capability (PWA)
- [ ] No memory leaks

---

## Priority Testing Order

**High Priority (Test First):**
1. Raw Materials Reduction in Production ⏳
2. Cancelled Orders in Account Statement ✅
3. Customer Navigation ✅
4. Decimal Quantities ✅
5. Invoice Display ✅

**Medium Priority:**
6. FIFO Costing Accuracy
7. Stock Levels After Transactions
8. Balance Calculations
9. Order Discounts (both types)
10. Production Date Filters

**Low Priority:**
11. PDF Generation
12. Mobile Swipe Gesture
13. UI/UX Polish
14. Tutorial System
15. Export Features

---

## Bug Report Template

When reporting issues, please include:

```
**Issue Title:** [Brief description]

**Page/Feature:** [Where the issue occurs]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [etc.]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Error Messages:**
[If applicable]

**Browser/Device:**
[Chrome/Firefox/Safari, Desktop/Mobile]

**User Role:**
[Admin/Manager/Staff]
```

---

## Notes

- Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- Test on different screen sizes
- Test with different user roles
- Clear browser cache between major tests
- Check browser console for errors
- Note any performance issues
- Document any unexpected behavior

**Last Updated:** January 31, 2026
