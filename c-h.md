# Conversation History - Session Summary

## Date: January 31 - February 6, 2026

---

## Key Changes Implemented

### 1. Stock Display Fix (Priority: HIGH)
**Problem**: Products page showing 0 stock for composed products instead of actual Finished Goods inventory values.

**Solution**:
- Added `finishedGoodsStock` state in `AdminProducts.tsx`
- Fetches from `finishedGoodsInventory` collection (not `finishedGoods`)
- Maps `productId` to `currentBalance` field (not `current`)
- Display now shows real stock: 237.5, 231, 127, 232 units

**Files Modified**:
- `src/pages/admin/AdminProducts.tsx`
  - Line 28: Added state `Record<string, number>`
  - Lines 48-70: Modified useEffect to fetch from `finishedGoodsInventory`
  - Lines 480-495: Updated stock display JSX to use `finishedGoodsStock[product.id]`

**Code Pattern**:
```typescript
const [finishedGoodsStock, setFinishedGoodsStock] = useState<Record<string, number>>({});

// Fetch finished goods stock
const finishedGoodsRef = collection(db, 'finishedGoodsInventory');
const fgQuery = query(finishedGoodsRef, where('storeId', '==', user.storeId));
const fgSnapshot = await getDocs(fgQuery);
const stockMap: Record<string, number> = {};
fgSnapshot.docs.forEach(doc => {
  const data = doc.data();
  if (data.productId && typeof data.currentBalance === 'number') {
    stockMap[data.productId] = data.currentBalance;
  }
});
setFinishedGoodsStock(stockMap);
```

---

### 2. Permissions Display Enhancement
**Problem**: Sub-account permissions showing as "view_orders" instead of "View Orders"

**Solution**:
- Added `permissionLabels` mapping object
- Converts snake_case to Title Case with proper formatting

**Files Modified**:
- `src/pages/admin/SubAccountDashboard.tsx` (Lines 258-275)

**Mapping**:
```typescript
const permissionLabels: Record<string, string> = {
  'view_orders': 'View Orders',
  'create_orders': 'Create Orders',
  'manage_orders': 'Manage Orders',
  'view_inventory': 'View Inventory',
  'manage_inventory': 'Manage Inventory',
  'view_customers': 'View Customers',
  'manage_customers': 'Manage Customers',
  'view_reports': 'View Reports',
  'manage_deliveries': 'Manage Deliveries',
  'process_payments': 'Process Payments',
};
```

---

### 3. Role Management System
**Status**: Manager role reactivated with limits

**Configuration**:
```typescript
const ROLE_LIMITS = {
  manager: 1,    // Full access to all features
  sales: 4,      // Can create orders, manage customers
  delivery: 5,   // Can view orders and manage deliveries
};
const MAX_SUB_ACCOUNTS = 10; // Total limit
```

**Sales Role Permissions** (view_inventory REMOVED):
- `view_orders`
- `create_orders`
- `view_customers`
- `manage_customers`
- `process_payments`

**Files Modified**:
- `src/types/subaccount.ts`
- `src/pages/admin/AdminSubAccounts.tsx`
- `src/pages/admin/SubAccountDashboard.tsx`

**Validation Logic**:
```typescript
const activeRoleCount = subAccounts.filter(a => a.status === 'active' && a.role === newAccount.role).length;
const roleLimit = ROLE_LIMITS[newAccount.role as SubAccountRole];
if (activeRoleCount >= roleLimit) {
  toast({ 
    title: "Error", 
    description: `Maximum ${roleLimit} ${newAccount.role} account${roleLimit > 1 ? 's' : ''} allowed`, 
    variant: "destructive" 
  });
  return;
}
```

---

### 4. Account Statement Fixes
**Problem 1**: Customer Balances showing 0 for unpaid orders
**Problem 2**: Sales History Balance column calculation incorrect

**Root Cause**: Code was checking `order.status === 'delivered'` instead of `order.paymentStatus === 'paid'`

**Solution**:
```typescript
// Customer Balances Calculation
const paid = order.paymentStatus === 'paid' ? total : 0;
customer.totalPayments += paid;
customer.balance = customer.totalPurchases - customer.totalPayments;

// Sales Record Loading
amountPaid: order.paymentStatus === 'paid' ? (order.total || 0) : (order.amountPaid || 0),

// Running Balance Calculation
runningBalance += total - sale.amountPaid;
```

**Files Modified**:
- `src/pages/admin/AdminAccountStatement.tsx`
  - Line 165: Customer balance calculation
  - Line 498: Sales record amountPaid assignment
  - Line 2665: Running balance display

---

## Technical Specifications

### Database Collections Structure

#### `finishedGoodsInventory` Collection
```typescript
{
  id: string;
  itemCode: string;          // "FG-001"
  productId: string;         // Links to products collection
  productName: string;
  currentBalance: number;    // Real stock quantity
  openingBalance: number;
  quantityManufactured: number;
  quantitySold: number;
  quantityAdjusted: number;
  costPrice: number;
  sellingPrice: number;
  totalValue: number;
  storeId: string;
}
```

#### `orders` Collection (Payment Fields)
```typescript
{
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  amountPaid: number;
  total: number;
  status: 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';
}
```

**Critical Rule**: ONLY use `paymentStatus === 'paid'` to determine if an order is paid. Do NOT use delivery status.

---

## Workflow & Best Practices

### Development Workflow
1. Make code changes
2. Test locally: `npm run dev` (usually runs on port 8081)
3. Build: `npm run build`
4. Deploy: `firebase deploy`
5. Commit: `git add -A && git commit -m "message" && git push`

### Firebase Deployment
- Project: market-flow-7b074
- URL: https://market-flow-7b074.web.app
- Console: https://console.firebase.google.com/project/market-flow-7b074/overview

### Code Standards
- Always include 3-5 lines of context in replace operations
- Use proper TypeScript types
- Handle edge cases (null/undefined checks)
- Use semantic search before making changes
- Test locally before deploying

---

## Outstanding Issues & TODO

### High Priority
1. ⏳ **Cash Collection Page** - Track payments sent to bank
2. ⏳ **Order Editing** - Allow sellers to edit orders before delivery
3. 🚧 **Premium/Pro Features** - NOT FINISHED YET
   - Monthly subscription plans
   - Yearly subscription plans
   - Premium tier features and limitations
   - Pro tier features and limitations
   - Subscription management interface
   - Payment processing for subscriptions
   - Feature gating based on subscription tier

### Known Issues
- Customer Balances may still show 0 if old orders lack `paymentStatus` field
  - **Solution**: Need to migrate old orders to add `paymentStatus: 'paid'` for delivered orders
  - **Workaround**: Users should use "Record Payment" feature in Orders page

### Data Migration Needed
If Customer Balances still showing 0 after fix:
```typescript
// Need to run migration to update old orders
orders.forEach(order => {
  if (!order.paymentStatus) {
    // Set based on old logic
    order.paymentStatus = order.status === 'delivered' ? 'paid' : 'unpaid';
  }
});
```

---

## Important File Locations

### Product Management
- `src/pages/admin/AdminProducts.tsx` - Product display & stock
- `src/pages/admin/AdminFinishedGoods.tsx` - Finished goods inventory

### Account Management
- `src/pages/admin/AdminSubAccounts.tsx` - Create/manage team members
- `src/pages/admin/SubAccountDashboard.tsx` - Team member dashboard
- `src/types/subaccount.ts` - Role & permission definitions

### Financial
- `src/pages/admin/AdminAccountStatement.tsx` - Customer balances, sales history
- `src/pages/admin/AdminOrders.tsx` - Order management & payment recording

### Inventory
- `src/types/finishedGoods.ts` - Finished goods type definitions
- Collection name: `finishedGoodsInventory` (NOT `finishedGoods`)

---

## Key Learnings

1. **Collection Names Matter**: Used wrong collection name (`finishedGoods` vs `finishedGoodsInventory`) causing stock display failure

2. **Field Names Matter**: Used `current` instead of `currentBalance` field

3. **Payment Status Priority**: Always use `paymentStatus` field, not delivery status, for financial calculations

4. **Role Limits**: Implemented per-role account limits (1 manager, 4 sales, 5 delivery) instead of just total limit

5. **Permission Scope**: Sales people should NOT have `view_inventory` - they only see products, not raw materials/manufacturing

6. **State Management**: Use `Record<string, number>` for mapping IDs to values (e.g., stock quantities)

---

## Commands Reference

### Local Development
```bash
npm run dev          # Start dev server (port 8080 or 8081)
npm run build        # Build for production
```

### Firebase
```bash
firebase deploy      # Deploy all (hosting, functions, firestore)
firebase serve       # Test locally with Firebase emulators
```

### Git
```bash
git status
git add -A
git commit -m "message"
git push
```

---

## Notes for Future Development

1. **Cash Collection Feature**: Create new page to track when cash is deposited to bank
   - Track collection date
   - Amount collected
   - Orders included in collection
   - Bank deposit reference

2. **Order Editing**: Add edit capability for orders in 'pending' or 'confirmed' status
   - Only before delivery
   - Log changes in audit trail
   - Recalculate totals

3. **Data Migration**: Consider adding migration script for old orders without `paymentStatus`

4. **Performance**: Large product lists may benefit from pagination or virtualization

5. **Permissions**: Consider adding more granular permissions if needed (e.g., view_payments separate from process_payments)

---

## Session Statistics
- Files Modified: 5 main files
- Deployments: 6 successful
- Git Commits: 6
- Critical Bugs Fixed: 3
- Features Enhanced: 4

## Last Deployment
- Date: February 6, 2026
- Commit: "feat: Implement automated service cost allocation system"
- Hash: ed982f5
- Status: ✅ Live in production

---

### 5. Automated Service Cost Allocation System (February 6, 2026)
**Problem**: Manual service cost entry in composed products causing double-counting of expenses already tracked in expenses collection.

**Solution**: 
- Removed manual service cost input completely
- Created automated monthly calculation system
- Service cost displayed VIEW ONLY (doesn't affect costPrice or profit calculations)
- Calculates from actual expenses and production data

**Features**:
1. **Monthly Calculation Dialog**
   - Select month from dropdown (last 12 months)
   - Calculates: Total Expenses ÷ Total Production = Rate per Unit
   - Shows expense breakdown by category
   - Shows production breakdown by product
   - Current month uses partial dates (Feb 1-6), past months use full month

2. **Service Cost Display**
   - Added column to Finished Goods table showing rate and month badge
   - Mobile view shows service cost in card display
   - "Not Calculated" badge for items without service cost

3. **Calculation History**
   - Stores in `monthlyServiceCosts` collection
   - Shows recent calculations in UI card
   - Tracks who calculated and when

4. **Fix Values Button**
   - Recalculates totalValue = currentBalance × costPrice
   - Fixes discrepancies (e.g., $2083.81 vs expected $2082.88)

**Files Modified**:
- `src/types/finishedGoods.ts`
  - Added `MonthlyServiceCost` interface
  - Added service cost fields to `FinishedGoodsItem`: `serviceCostCalculated`, `serviceCostMonth`, `serviceCostRate`, `serviceCostTotal`

- `src/pages/admin/AdminComposedProducts.tsx`
  - Line 120: `calculateTotalCost()` returns only material costs
  - Lines 209, 227: Set `serviceCost: 0` in product creation
  - Removed manual service cost input section (~20 lines)

- `src/pages/admin/AdminFinishedGoods.tsx` (~350 lines added)
  - Line 128-139: `getMonthOptions()` - generates last 12 months (FIXED timezone bug)
  - Line 141-220: `calculateMonthlyServiceCost()` - main calculation with partial month support
  - Line 233-318: `applyServiceCostToProducts()` - applies VIEW ONLY (doesn't update costPrice)
  - Line 320-363: `recalculateAllTotalValues()` - fixes totalValue discrepancies
  - Lines 715-732: Service cost card UI with recent calculations
  - Lines 1188-1282: Service cost calculation dialog (scrollable month dropdown)
  - Line 876: Added "Service Cost" column header
  - Lines 894-907: Service cost cell display with rate and month badge
  - Lines 783-798: Service cost in mobile card view

**Bugs Fixed**:
1. **Timezone Bug**: Month dropdown showing wrong month (February → January)
   - Cause: `.toISOString()` converts to UTC causing date shift
   - Fix: Manual date formatting `${year}-${month}` instead of `.toISOString().slice(0, 7)`

2. **Zero Data Handling**: Dialog not updating when 0 production
   - Cause: Function returning early with 0 data
   - Fix: Set serviceCostCalculation state even with 0 values

3. **Current Month Calculation**: Using full month instead of partial (Feb 1-6)
   - Fix: Added `isCurrentMonth` detection, uses today as end date for current month

**Firestore Indexes Created**:
- `expenses`: storeId (Ascending) + date (Ascending)
- `finishedGoodsInventory`: storeId (Ascending) + createdAt (Ascending)

**Example Data** (January 2026):
- Total Expenses: $4,400.00
- Total Production: 1,679 kg
- Service Cost Rate: $2.6206/kg
- Items Updated: 26 products

**Code Pattern**:
```typescript
// Calculate service cost
const isCurrentMonth = selectedMonth === today.toISOString().slice(0, 7);
const monthEnd = isCurrentMonth 
  ? today.toISOString().slice(0, 10)
  : nextMonth.toISOString().slice(0, 10);

const expensesRef = collection(db, 'expenses');
const expensesQuery = query(
  expensesRef,
  where('storeId', '==', user.storeId),
  where('date', '>=', monthStart),
  where('date', '<=', monthEnd)
);

// Apply VIEW ONLY (doesn't update costPrice)
await updateDoc(doc(db, 'finishedGoodsInventory', docSnapshot.id), {
  serviceCostCalculated: true,
  serviceCostMonth: selectedMonth,
  serviceCostRate: serviceCostCalculation.serviceRate,
  serviceCostTotal: serviceCostTotal,
  // NO UPDATE to costPrice or totalValue
});
```

---

### 6. Revenue Report Discount Fix (February 6, 2026)
**Problem**: Revenue Report showing $2,231.73 instead of correct $1,726.83 (not applying customer discounts).

**Root Cause**: Code was reading `order.discount` field which doesn't exist in orders collection. Discounts are calculated from `subtotal - total` difference.

**Solution**:
```typescript
// Before (WRONG - field doesn't exist)
const orderDiscount = order.discount || 0;

// After (CORRECT - calculate from subtotal-total)
const orderDiscount = Math.max(0, orderSubtotal - orderTotal);
```

**Files Modified**:
- `src/pages/admin/AdminRevenue.tsx` (Line 107-111)

**Validation**: Revenue Report now correctly shows $1,726.83 matching Account Statement after discounts applied.
