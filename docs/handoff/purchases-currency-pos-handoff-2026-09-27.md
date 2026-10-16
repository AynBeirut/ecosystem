# Handoff — purchases, currency, payroll, POS voids (2026-09-27)

Paste everything below the line into a new chat.

---

```text
You are working in /home/anwar/Documents/grabio space.

Owner: Anwar. Short answers (≤8 lines) + trust line. No git commit/push unless asked. No prod deploy without an explicit "deploy". Never show Firebase doc ids in UI (Rule 34). Tenant queries scoped to store only (Rule 35). Do not change the Windows POS (`pos-v1`).

Read README.md session 2026-09-25 first. This file is the continuation.

## Stores

- Little Hands: storeId `8WgfKtgaE8aAXdqFhIfweEo5WFq2`
- E-Moove: `mooveelectro@gmail.com` · store `EZfuoNQFTJVU4cubNuckpp4K7zw2`

## Live now (hosting https://grabio.space)

Confirm with `curl -sS https://grabio.space/ | rg -o 'index-[A-Za-z0-9_-]+\.js'`. Expected main bundle: `index-DZMx0tCw.js`. Invoice manager bundle unchanged: `index-WT_DLiee.js`. Not committed.

| What | Where | Notes |
|------|--------|--------|
| One currency per invoice/purchase (USD or LBP). Totals always both | `AdminPurchases.tsx`, Invoice Manager `PurchaseOrders.tsx` / `InvoiceManager.tsx` | Rate: store `customExchangeRate` / `usdToLbpRate`, else live USD→LBP. Little Hands profile rate was 0 |
| Line total uses document currency | `AdminPurchases.tsx` `moneyIn(lineTotal, newPurchase.currency)` | |
| Item search: prefix/word-start first, cap 40 | `src/lib/rankedSearch.ts`, `RankedOptionSelect.tsx`, Invoice Manager `SearchableCombobox` | V-Purchase material search ranked. Supplier search on V-Purchase is still plain `.includes` |
| Statement currency select on the statement card | `PartyAccountStatementPage.tsx` | USD / LBP / both. Do not add currencies |
| Payroll Hours + Amount for the selected month | `AdminStaff.tsx` | Hourly = Daily Presence hours × rate (Excel hours only if presence hours are 0). September stays 0 until hours are marked. Store-scoped |
| Create Purchase line type | `AdminPurchases.tsx` | Raw material / Item / Expenses (`V_EXPENSE_CATEGORIES`). Expense lines are not received into stock |
| Create Purchase browser draft | `AdminPurchases.tsx` key `po_create_draft_${storeId}` | 7-day TTL. Reopens the dialog if `items.length`. Cleared only after a successful Create. Not in Firestore |

## Why a client lost a long purchase (2026-09-27)

Create Purchase lived only in React state until Create. After a hosting deploy, a stale lazy chunk calls `hardRecoverFromStaleChunk` in `src/main.tsx` and `index.html` (`grabio_chunk_reload_v4`), which `location.replace`s the tab. Auth flicker can then send her Home via `ProtectedRoute`. Supplier date keys `po_dates_${storeId}_${supplierId}` do not hold lines. That order was never written. It cannot be recovered. Do not invent lines.

## POS voids (functions already live)

`POST /pos/voids` on `https://us-central1-market-flow-7b074.cloudfunctions.net/api`. Auth `{ storeId, deviceId, deviceToken }`. Body `{ voids: [{ localSaleId, displayTicket, reason, timestamp, status }] }`. Finds the order by `localSaleId`. Does not create a new order. Marks `status: cancelled`, `paymentStatus: voided`, `amountPaid: 0`, `voided: true`. Idempotency `stores/{storeId}/posOrdersByLocalSaleId/{localSaleId}` with `voided: true` blocks reuse. Returns `200 { success: true }`. Empty body is `400 {"error":"Missing fields"}` (route exists). Deploy functions with `firebase deploy --only functions:api --project market-flow-7b074` (full functions deploy blocked by orphan schedulers).

ORD-000182 (laptops, $1000, E-Moove) is cancelled. Evidence: `reporting/data/pos-void-ord-000182-2026-09-25.json`.

Builder paste already given: keep the existing payload, expect 200, use the sale’s existing `localSaleId`.

## Open — do not start unless Anwar asks

1. ORD-000181 is still `status: completed`, `paymentStatus: paid`. Refund path (`syncPosRefunds`) writes `salesReturns` and reverses GL but does not patch the order, so Admin Orders revenue (`sumCountedSaleOrderRevenue` in `src/lib/salesRules.ts`) still counts it. Counted statuses: `delivered|paid|completed` only. Cancelled voids drop out. Refunded-but-still-completed orders do not.
2. 20 Sep refund #1337 was not backfilled.
3. Functions `ensurePartyLedgerAccount` still creates one account. Web client/supplier create creates USD + LL. POS sync supplier account create is not hooked.
4. V-Purchase supplier search is still `.includes` (materials are ranked).
5. Windows POS app was not changed.
6. Nothing from this stretch is committed.

## Deploy

```bash
npm run build && firebase deploy --only hosting --project market-flow-7b074
firebase deploy --only functions:api --project market-flow-7b074
```

GCP project `market-flow-7b074`. Hosting URL https://grabio.space.

## First message

"Read docs/handoff/purchases-currency-pos-handoff-2026-09-27.md. Continue from the open list only if I name one."
```
