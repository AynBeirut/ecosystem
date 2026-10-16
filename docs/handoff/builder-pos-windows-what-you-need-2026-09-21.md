# Windows POS builder — what you need (2026-09-21)

You work only in `pos-v1` on Windows. Do not hunt a Linux `functions` folder. Do not deploy `functions:api`. Cloud deploy stays on the Linux machine.

API: `https://us-central1-market-flow-7b074.cloudfunctions.net/api`  
Auth every call: `{ storeId, deviceId, deviceToken }` from pairing.  
This is the POS **product** for every store. No store-id hardcode.

## Document numbers (locked)

Date is saved on the sale/purchase (`timestamp` / `date`). **Date is not part of the number.**

Wrong: `ORD-2026-09-21-000009`, `PO-2026-09-21-001`  
Right: `INV-000001`, `INV-000002` … and `PO-000001`, `PO-000002` …

- One continuous counter per store per type. Do not reset at midnight.
- Invoices / POS sales display: `INV-000001` (6 digits).
- Purchases: `PO-000001` (6 digits).
- Ticket `#1328` may stay as a local UI number. It is not the Grabio document number.
- `localSaleId` for sync must still be unique forever (uuid or `yyyyMMdd-seq`). That id is internal. Do not print it.

If cloud returns `invoiceNumber` / `poNumber`, show that after sync. If you allocate locally, use the sequential format above — never `PREFIX-YYYY-MM-DD-seq`.

## Your job in pos-v1

1. Stop sending dated `ORD-2026-…` / `PO-2026-…`.
2. Refunds: queue `POST /pos/refunds`. Today total = sales − refunds − voids.
3. Delete/void: queue a void; do not leave a paid sale in the cloud.
4. Do not reuse `localSaleId` the next day.
5. After sync, show `INV-000001` / `PO-000001` or “pending sync”. Never show `pos-{storeId}-…`.
6. Raw materials: `productType` / `catalogRole: "inventory"`. Do not put them on the sellable menu.
7. Purchases: send `amountPaid` and `paymentStatus` (`paid` | `partial` | `unpaid`).

## Do not do

- Deploy functions, hosting, or rules
- Re-run document migration
- Ask Linux for another functions copy
- Little-Hands-only branches

## Done when

New sale/purchase numbers look like `INV-000001` / `PO-000001`, date is on the record only, refunds sync, next day does not overwrite yesterday’s sale, menu is sellable-only.
