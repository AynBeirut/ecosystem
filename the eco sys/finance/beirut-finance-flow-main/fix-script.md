# Systematic Refactoring Script

## Changes needed across all manager files:

### 1. Property name changes:
- `product.unitPrice` → `product.salePrice` 
- `user?.isPremium` → `user?.plan === "pro"`
- Remove `user?.credits` checks
- `customer:` → `clientId:` (in createInvoice/createEstimate)
- `supplier:` → `supplierId:` (in createPurchaseOrder)
- Remove `type:` field (in createReceipt)
- `receipt.type` → remove all references
- `receipt.client` → `receipt.clientId`
- `paymentOrder.supplier` → `paymentOrder.supplierId`
-  Remove `client:` parameter from createInvoice (only use `clientId`)

### 2. Free-tier logic changes:
- Remove all credit checks: `if (!user?.isPremium && (user?.credits || 0) < 3)`
- Remove disabled states based on credits
- Remove "earn credits" prompts
- AppContext handles limits automatically

### 3. Files to fix:
- src/pages/InvoiceManager.tsx (867 lines)
- src/pages/EstimateManager.tsx (889 lines)
- src/pages/PurchaseOrders.tsx (783 lines)
- src/pages/ReceiptManager.tsx (1084 lines)

