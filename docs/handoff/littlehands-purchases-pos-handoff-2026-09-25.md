# Handoff — Little Hands purchases, suppliers, POS sync (2026-09-25)

Paste everything below the line into a new chat.

---

```text
You are working in /home/anwar/Documents/grabio space.

Client: Little Hands · storeId `8WgfKtgaE8aAXdqFhIfweEo5WFq2`.
Owner: Anwar. Short answers. No git commit/push unless asked. No prod deploy without explicit OK after build. Never show Firebase doc ids in UI (Rule 34). Tenant queries scoped to store only (Rule 35).

## What we were fixing

Admin **Purchases / PO**: sequential **PO-000001** (migration done), delivery fee → COA **653**, paid/unpaid badges, **order-date-only** filters (not import createdAt), Create PO validation + inline supplier, supplier dropdown visibility for cash-book stores.

**POS ↔ Firebase**: refunds/voids not synced, localSaleId reuse overwrites cloud orders, POS gross today total vs net, dated ORD from POS vs migrated ORD-00000N, menu vs raw materials on catalog sync, purchase payment fields on POS push.

**Spinneys (23 Sep):** Staff created **one** admin supplier today — not a duplicate pair. Old cash-book `lh-sup-*` Spinneys rows are inactive noise. Evidence: `reporting/data/littlehands-supplier-spynes-live-2026-09-23.json`. Dropdown was empty before filter fix because new admin vendors were hidden by cash-book-only filter.

## Done (code + some deploys)

| Area | What |
|------|------|
| Doc numbers | `PO/ORD/EXP-000001` per store; LH migration `--write` (5434 updates). `chronologicalDocumentNumbers.ts`, `documentSerial.ts`, `scripts/migrateChronologicalDocumentNumbers.cjs` |
| Purchases UI | `AdminPurchases.tsx` — delivery, filters, Create PO, payments display via `purchasePaymentStatement.ts`, `purchaseDateFilter.ts` |
| Suppliers on PO | `src/lib/littleHandsPurchasesVisibility.ts` — `isAdminManagedSupplier`, `filterSuppliersForStore`; new suppliers `source: admin_manual`, `purchasesPageEligible: true` in `AdminSuppliers.tsx` / `AdminPurchases.tsx` |
| Cloud POS API | `functions/src/api/posSync.ts` — `amountPaid`, `paymentStatus` on purchase sync; catalog/menu vs inventory (`sellableMenuProduct`, `posCatalog.ts`). Deploy with `firebase deploy --only functions:api` (full functions deploy blocked by orphan schedulers) |
| Hosting | Purchases/supplier UI ships with main web app (`grabio.space` / `market-flow-7b074.web.app`). Re-verify live bundle if unsure: build id in `<meta name="grabio-build">` and `/assets/index-*.js` hash vs local `npm run build` |

## Open — prioritize with owner

1. **Windows POS** (`pos-v1`, external tree): refund/void/delete sync, net shift total, stable sale ids, void endpoint, stop merging raw materials into menu, send purchase payment fields. Full checklist: `docs/handoff/littlehands-pos-sync-fix-2026-09-20.md` · builder copy: `docs/handoff/builder-pos-windows-sync-fix-2026-09-21.md` · contract: `docs/planning/pos-sync-contract.md`
2. **Cloud follow-ups** (`posSync.ts`): block `localSaleId` overwrite on total/timestamp mismatch; patch order on refund; cancelled/void revenue; align ORD numbering on sync; net Admin Orders revenue when returns exist
3. **Optional data:** backfill `purchasesPageEligible: true` on older admin suppliers missing flags (only if dropdown still gaps after UI deploy)
4. **20 Sep incident data:** no backfill for missing `salesReturns` for refund #1337 — fix sync first, then reconcile

## Live findings (20 Sep — still valid until POS fixed)

- Refund on POS not in cloud; order stays paid; today total gross only locally
- `localSaleId` 1328 cloud ≠ POS ticket semantics; **ORD-001328** is Grabio doc ($1,366.50 Gaelle, 13 Sep), not POS #1328
- After reconnect: 10 sales 20 Sep $376.23 (locals 1334–1344)
- Evidence: `reporting/data/littlehands-pos-sync-after-refresh-2026-09-20.json`, `littlehands-pos-refund-live-check-2026-09-20.json`

## Key paths

- Purchases: `src/pages/admin/AdminPurchases.tsx`
- LH visibility: `src/lib/littleHandsPurchasesVisibility.ts`, `littleHandsPurchasesEligibility.ts`, `littleHandsSupplierListEligibility.ts`
- Delivery COA: search `deliveryExpenseAccount` / account **653**
- POS API: `functions/src/api/posSync.ts`, `posCatalog.ts`
- Decisions: `decision-log.md` (2026-09-20 POS + sequential numbers; 2026-09-23 purchase edit lines)

## Deploy / session gotchas

- GCP project: `market-flow-7b074` · API `https://us-central1-market-flow-7b074.cloudfunctions.net/api`
- If Firebase CLI auth fails, see `docs/handoff/invoice-manager-edit-currency-2026-09-25.md` for gcloud hosting release pattern
- Cash-book SOT flag on store profile: `littlehands-cash-book-2026-09-12` — drives purchase/supplier filtering
- README session notes: 2026-09-20 POS, 2026-09-25 Invoice Manager edit/currency (separate track)

## First message in new chat (suggested)

"Read `docs/handoff/littlehands-purchases-pos-handoff-2026-09-25.md` and `docs/handoff/littlehands-pos-sync-fix-2026-09-20.md`. Continue from open items — [POS Windows | cloud posSync | purchase QA | supplier backfill]."
```
