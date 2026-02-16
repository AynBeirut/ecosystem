# Sales Filter Calculation Bug Fix

## Issue Description
When filtering sales by product (e.g., "Interfold"), the system was showing **entire invoice totals** instead of calculating only the **filtered product's amounts**.

### Example:
- Total sales: $4200
- Filtering by "Interfold" showed: $3349 (entire invoice)
- **Should show**: $2058 (only Interfold items: 500 pieces)

## Root Cause
The code was correctly **filtering which sales to display** (checking if sale contains the product), but then using the **full invoice amounts** (`sale.total`, `sale.amountPaid`, etc.) instead of calculating the filtered product's portion.

## Solution Applied
Fixed three locations in `AdminAccountStatement.tsx`:

### 1. Sales History Table Display (Lines ~2800-3050)
**Before:**
```typescript
filteredSales.map(sale => {
  const total = sale.total;  // ❌ Full invoice total
  const credit = sale.amountPaid;  // ❌ Full payment
  ...
})
```

**After:**
```typescript
filteredSales.map(sale => {
  if (filterProduct && sale.items) {
    // ✅ Calculate only filtered product's amounts
    let itemSubtotal = 0;
    sale.items.forEach((item: any) => {
      if (item.productId === filterProduct) {
        itemSubtotal += item.quantity * item.price;
      }
    });
    
    // ✅ Apply proportional discount
    const orderSubtotal = sale.subtotal || sale.total || 0;
    const orderDiscount = sale.discountAmount || 0;
    discount = (itemSubtotal / orderSubtotal) * orderDiscount;
    total = itemSubtotal - discount;
    
    // ✅ Calculate proportional payment
    credit = (total / sale.total) * sale.amountPaid;
  }
  ...
})
```

### 2. PDF Export (Lines ~1380-1420)
Applied same logic to PDF generation:
- Calculate filtered product subtotal
- Apply proportional discount
- Calculate proportional payment
- Calculate accurate balance

### 3. Excel Export (Lines ~1230-1290)
Applied same logic to CSV/Excel export:
- Calculate filtered product subtotal
- Apply proportional discount
- Calculate proportional payment
- Calculate accurate balance

## Calculation Logic
When a product filter is active:

1. **Item Subtotal**: Sum only filtered product's `quantity × price`
2. **Proportional Discount**: `(itemSubtotal / orderSubtotal) × orderDiscount`
3. **Item Total**: `itemSubtotal - proportional discount`
4. **Proportional Payment**: `(itemTotal / saleTotal) × amountPaid`
5. **Item Balance**: `itemTotal - proportional payment`

## Testing
Test the fix by:
1. Go to Admin → Account Statement → Sales History
2. Select a product filter (e.g., "Interfold")
3. Verify totals show only that product's amounts
4. Export to PDF and Excel - verify exports match screen totals
5. Remove filter - verify full invoice totals appear correctly

## Files Modified
- `src/pages/admin/AdminAccountStatement.tsx`
  - Sales History table display (tbody and tfoot)
  - `exportSalesToPDF()` function
  - `exportSalesToExcel()` function

## Impact
- ✅ Accurate product-specific revenue reporting
- ✅ Correct calculations in exports
- ✅ Reliable financial analysis per product
- ✅ No impact when filter is not applied (shows full invoices)
