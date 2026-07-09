# Finance Firestore Schema (Phase 3)

**Status:** Planning doc — Firebase-native Invoice Manager module. Do not dual-write Supabase.

## Collections

### `stores/{storeId}/financeEstimates/{estimateId}`

| Field | Type | Notes |
|-------|------|-------|
| `number` | string | EST-YYYY-NNNN |
| `clientId` | string | Link to customers |
| `clientName` | string | Snapshot |
| `status` | string | `draft` \| `sent` \| `accepted` \| `converted` \| `expired` |
| `currency` | string | USD, LBP, etc. |
| `lineItems` | array | `{ description, qty, unitPrice, taxRate }` |
| `subtotal` | number | |
| `taxTotal` | number | |
| `total` | number | |
| `validUntil` | timestamp | |
| `convertedInvoiceId` | string? | When accepted → invoice |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `stores/{storeId}/financeReceipts/{receiptId}`

| Field | Type |
|-------|------|
| `number` | string |
| `invoiceId` | string? |
| `clientId` | string |
| `amount` | number |
| `currency` | string |
| `paymentMethod` | string |
| `paidAt` | timestamp |
| `pdfUrl` | string? |

### `stores/{storeId}/financePortfolioExports/{exportId}`

| Field | Type |
|-------|------|
| `clientId` | string |
| `generatedAt` | timestamp |
| `pdfStoragePath` | string |
| `invoiceIds` | string[] |

## Rules

- Owner + authorized sub-accounts with `view_reports` or finance permission
- No composed-product authoring in Invoice Manager app (billing only)

## Port mapping (Finance reference)

| Feature ID | Grabio route |
|------------|--------------|
| CORE-INV-02 | `/admin/finance/estimates` |
| CORE-INV-03 | `/admin/finance/receipts` |
| INV-02 | `/admin/finance/portfolio` |
| INV-03 | storeProfile multi-currency (existing) |
