# Firestore schema — Grabio Invoice Manager

**Project:** `market-flow-7b074`  
**URL:** `https://grabio.space/invoice`  
**Tenant key:** `storeId` (from `storeProfiles`, same as Grabio admin)

## Shared collections (ecosystem)

### `storeProfiles/{storeId}`
Company profile, subscription, `enabledModules`. Finance app reads/writes branding fields; subscription fields are owner/Functions-only.

### `customers/{customerId}`
Finance **clients**. Fields: `storeId`, `name`, `email`, `phone`, `address`, `city`, `notes`, plus optional CRM fields when module enabled.

### `products/{productId}`
Finance **products/services**. Fields: `storeId`, `name`, `price`, `costPrice`, `productType`, `stock`, `sku`, `listedInStore` (false until marketplace module lists them).

## Store-scoped finance collections

All under `stores/{storeId}/`:

| Collection | Purpose |
|------------|---------|
| `financeInvoices` | Invoices + embedded `lineItems` |
| `financeEstimates` | Estimates / quotes |
| `financeReceipts` | Payment receipts |
| `financePayments` | Invoice payment records |
| `financeExpenses` | Expense tracking |
| `financeSuppliers` | Suppliers |
| `financePurchaseOrders` | Purchase orders |
| `financeInventoryMovements` | Stock movements |
| `financeProjects` | PSA projects |
| `financeProposals` | Proposals / RFP responses |
| `financeTasks` | Project tasks |
| `financeTimesheets` | Billable time |
| `financeCurrencySettings` | FX rates |
| `financePaymentMethods` | Saved payment methods |
| `financeActivityLogs` | Audit log |
| `financeMembers` | Finance sub-users |

## Module gate

Requires `invoice_manager` or `invoicing` in `storeProfiles.enabledModules` when `VITE_ECOSYSTEM_ENFORCE_MODULES=true`.

## Phase status

| Phase | Status |
|-------|--------|
| A0 — Firebase auth + store bootstrap | **Done** |
| A1 — Core billing Firestore CRUD | **Done (local)** — rules deploy pending |
| A2–A6 | Pending |

Rules for new collections: root `firestore.rules` (deploy with owner approval).
