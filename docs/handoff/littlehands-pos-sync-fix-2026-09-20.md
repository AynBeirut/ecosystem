# Little Hands — POS must fix (post data migration) — 2026-09-20

**Store:** `8WgfKtgaE8aAXdqFhIfweEo5WFq2` (Little Hands)  
**Owner action:** Treat **tonight** on Windows POS (`pos-v1` per `docs/planning/pos-windows-handoff.md`) + cloud `functions/src/api/posSync.ts`.  
**Context:** Platform **data migration** (Sep 2026) renumbered purchases/orders/expenses in Firebase; **POS offline sync was not updated** — live ops on 20 Sep exposed gaps.

---

## Evidence (reporting/data)

| File | What it proves |
|------|----------------|
| `littlehands-pos-sync-after-refresh-2026-09-20.json` | After reconnect: 10 POS sales today, $376.23, locals 1334–1344 |
| `littlehands-pos-refund-live-check-2026-09-20.json` | No refund registered; #1337 still paid $41.50 |
| `chronological-document-numbers-8WgfKtga-2026-09-19.json` | Migration dry-run / write (5434 doc updates on `--write`) |
| `littlehands-pos-refund-live-check-2026-09-20.json` | `salesReturnsToday: []`, device lastSync OK |

---

## A. POS app (Windows) — required fixes

1. **Refunds** — Every refund must queue **POST `/pos/refunds`**; local DB must mark sale refunded/partial. **Today/shift total = sales − refunds − voids** (currently gross only → total unchanged after refund).
2. **Delete** — Local delete is **not** synced; cloud keeps full **paid** sale. Need **void/cancel sync** (or treat delete as void + push).
3. **Sale identity** — **Do not reuse** `localSaleId` across business days without a new global id. Reusing **1325–1334** caused cloud rows to keep **13 Sep / 19 Sep** amounts while POS showed **20 Sep** tickets (merge on `pos-{storeId}-{localId}`).
4. **Display vs Grabio** — POS ticket **#1328** ≠ Grabio **`ORD-001328`** ($1,366.50, Gaelle, 13 Sep). **$41.50** today was local **#1337**, not #1328. UI should show **Grabio ORD** after sync or “pending sync”.
5. **Catalog push** — Stop pushing **raw materials** into sellable menu; send `productType` / `catalogRole: inventory` for ingredients (cloud routes to `rawMaterials` when fixed — verify POS payload).
6. **Purchases on POS** — If POS syncs purchases, send **`amountPaid` + `paymentStatus`** (not only `paidAmount`) so supplier statements match (cloud API fixed 20 Sep; POS must send fields).

---

## B. Cloud API (`posSync.ts`) — follow-ups

1. **`createPosOrder` / order sync** — **Reject or fork** when existing doc same `localSaleId` but different `posSaleTimestamp` or `total` (no silent overwrite).
2. **`syncPosRefunds`** — After GL reversal, **patch order**: `paymentStatus`, `amountPaid`, `refundedAmount`, `paymentHistory` refund line.
3. **New: void/delete sync** — Endpoint or flag on order push: `status: cancelled`, exclude from revenue.
4. **Invoice numbers from POS** — POS sends `ORD-2026-09-20-00000N`; platform migrated to **`ORD-000001`** global sequence. **Assign numbers on cloud** after insert (`renumberStoreOrders`) or stop sending dated ORD from POS.
5. **`GET /pos/catalog`** — Menu = sellable only; `rawMaterials` not on menu (partially done; POS must not merge inventory into menu client-side).

---

## C. Grabio web admin — related (not POS binary)

1. **Orders dashboard** — `sumCountedSaleOrderRevenue` uses **gross `order.total`**; does not net **refunds** (even when `salesReturns` exist).
2. **Purchases date filter** — Fixed 20 Sep: custom range uses **order date only** (not import `createdAt`).
3. **Purchase numbering** — **`PO-000001`** global per store (migration applied Little Hands); independent of POS purchase sync.
4. **Supplier payments** — `paidAmount` on POS purchase sync mapped to `amountPaid` (deployed `functions:api`).

---

## D. Data migration interaction (do not re-run blindly)

- **`migrateChronologicalDocumentNumbers.cjs --write`** on Little Hands updated **PO / ORD / EXP / vouchers** to **PREFIX-000001** style (date hidden in label; sort by business date).
- **POS historical orders** may still carry **old `invoiceNumber`** until next renumber or resync — reconcile POS export vs `orders.invoiceNumber` + `localSaleId`.
- **Cash-book purchases** (`lh-cashbook-*`) are separate from POS; migration did not fix POS id collision.
- **No backfill** yet for POS refunds missing from `salesReturns` on 20 Sep.

---

## E. Acceptance checks (after POS fix deploy)

1. Refund local **#1337** → cloud `salesReturns` row + order not full paid; POS today total drops.
2. Void/delete → cloud order `cancelled` or excluded; not in today revenue.
3. New sale gets **unique** id; second day does not overwrite prior `localSaleId` in Firebase.
4. Grabio Admin Orders **20 Sep** total matches POS net (± sync delay).
5. Pairing device **lastSyncAt** updates; failed refund shows in POS outbox retry.

---

## F. Decision log

Canonical entry: **`decision-log.md`** → **2026-09-20 — POS sync fix (Little Hands) — treat tonight**.
