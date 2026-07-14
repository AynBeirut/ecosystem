# Refactoring Notes: Free-Tier System

## Changes Made:

### 1. Removed Credit System
- Deleted all `credits` references
- Deleted all `watchAd` functionality
- Removed `isPremium` property (replaced with `plan: "free" | "pro"`)

### 2. Property Name Changes
- `Product.unitPrice` → `Product.salePrice`
- `Invoice.customer` → `Invoice.clientId` 
- `Estimate.customer` → `Estimate.clientId`
- `PurchaseOrder.supplier` → `PurchaseOrder.supplierId`
- `Receipt.type` field removed

### 3. Free-Tier Limits
- 10 invoices/month
- 10 estimates/month  
- 10 receipts/month
- 10 purchase orders/month
- 10 clients total
- 10 products total

### 4. Files Needing Updates
Due to extensive changes, the following files need systematic updates:
- src/pages/InvoiceManager.tsx
- src/pages/EstimateManager.tsx
- src/pages/PurchaseOrders.tsx
- src/pages/ReceiptManager.tsx
- src/pages/Settings.tsx
- src/components/Dashboard.tsx

These files reference old properties and need to be updated to work with the new free-tier system.
