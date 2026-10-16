# Builder Prompt — Windows POS sync (platform app)

Use this prompt in the Windows POS execution conversation.

You already have: `docs/handoff/littlehands-pos-sync-fix-2026-09-20.md`, `docs/planning/pos-windows-handoff.md`, `docs/planning/pos-sync-contract.md`, `decision-log.md` (2026-09-20 POS section). Those files list bugs and APIs. **This prompt is the scope.** The 2026-09-20 Little Hands note is a repro, not a tenant lock.

---

You are building the **Grabio Windows POS app** (`pos-v1`). This is a **product** used by every paired store. Fix the sync layer for all stores. Do not add Little Hands branches, store-id hardcodes, or one-client patches.

## Read first

1. `docs/handoff/littlehands-pos-sync-fix-2026-09-20.md` — bug list (section A is your job)
2. `docs/planning/pos-sync-contract.md` — pairing + device auth shape
3. `docs/planning/pos-windows-handoff.md` — POS folder layout only
4. `decision-log.md` → **2026-09-20 — POS sync fix**

## Stale-doc warning

`pos-windows-handoff.md` (2026-06-30) and parts of `pos-sync-contract.md` still say catalog/orders are “not deployed.” **That is false.** Production already has:

API base: `https://us-central1-market-flow-7b074.cloudfunctions.net/api`

Auth on every call: `{ storeId, deviceId, deviceToken }` from pairing. Never email-only. Never unscoped lookups.

Live POS routes (use these; do not rebuild pairing unless it is broken):

- `POST /pos/orders`
- `POST /pos/refunds`
- `POST /pos/purchases`
- `POST /pos/products`
- `POST /pos/customers`
- `POST /pos/suppliers`
- `POST /pos/expenses`
- `POST /pos/raw-materials`
- `POST /pos/recipes`
- `GET /pos/catalog`
- heartbeat / pair (already live)

## What you are fixing (POS binary)

1. **Refunds** — Every refund queues `POST /pos/refunds`. Local sale marked refunded/partial. Shift/today total = sales − refunds − voids (not gross).
2. **Delete / void** — Local delete must not leave a paid sale in the cloud. Queue a void/cancel. If cloud has no `/pos/voids` yet, queue locally with a clear outbox state; do not overwrite another sale to fake a delete.
3. **Sale identity** — Display ticket `#1328` may recycle per day. **`localSaleId` sent to Grabio must be unique for the life of that sale** (date+seq or uuid). Reusing the same `localSaleId` the next day skips or overwrites the old cloud sale. Ticket number ≠ Grabio `invoiceNumber`.
4. **Labels** — After sync, show Grabio `ORD-00000N` (or “pending sync”). Never show `pos-{storeId}-…` or Firestore ids on the ticket, receipt, or totals.
5. **Catalog** — Ingredients/raw materials are inventory. Send `productType` / `catalogRole: "inventory"`. Do not merge inventory into the sellable menu. Menu pull from `GET /pos/catalog` stays sellable only.
6. **Purchases** — If POS syncs purchases, send `amountPaid` and `paymentStatus` (`paid` | `partial` | `unpaid`), not only `paidAmount`.

## Verification store (QA only)

After the **app** fix, prove it on Little Hands live data. That store is the known failure, not the only customer.

- Store: `8WgfKtgaE8aAXdqFhIfweEo5WFq2`
- Evidence of the bug: refund `#1337` ($41.50) never hit `salesReturns`; locals `1325–1334` reused across days; POS `#1328` ≠ Grabio `ORD-001328`.

Acceptance (same behavior must work on any paired store):

1. Refund a sale → cloud `salesReturns` row; POS today total drops.
2. Void/delete → cloud order not counted as paid revenue.
3. Next business day does not reuse yesterday’s `localSaleId`.
4. Ticket UI shows local # and Grabio ORD after sync.
5. Failed refund stays in outbox and retries. Heartbeat still updates `lastSyncAt`.

## Do not do

- Do not hardcode Little Hands or any store id.
- Do not deploy Cloud Functions, hosting, or Firestore rules.
- Do not re-run chronological document migration.
- Do not treat POS local cashier/manager roles as Firebase `subAccounts`.
- Do not delete legacy VPS `sync-manager.js` until Grabio path is proven.
- Do not show opaque ids on receipts or lists.
- Do not mix tenants. Each device is bound to the `storeId` from pairing only.

## Cloud / web (not this chat)

Leave for Linux/Anwar: reject-on-`localSaleId` mismatch, refund patch on the order, void endpoint if missing, Admin Orders net of refunds. If POS cannot void because the API is missing, report the exact payload you need — do not invent a second order-id scheme.

## Required final report

- Files changed in `pos-v1`
- How `localSaleId` is unique
- Refund and void/outbox paths
- Catalog inventory vs menu payload
- Purchase payment fields
- What you could not verify on Windows vs what needs a live Little Hands check
- No deploy/push without Anwar
