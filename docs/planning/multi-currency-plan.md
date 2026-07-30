# Multi-Currency Support — Implementation Plan

Status: **AWAITING APPROVAL (scope/time review)** — no code written yet.
Owner: Anwar. Environment: **staging only** until explicit prod approval.

## Core principle (locked)
One **base currency** drives ALL math / GL / calculations. **Secondary currency is a pure display overlay** — never touches totals, never persisted as a converted value, never enters GL.

## Source of truth for the current state
See `docs/planning/` audit results (main app `src/`, Invoice Manager `vendor/beirut-finance-flow-main/`, backend `functions/`). Key facts driving this plan:
- `StoreProfile.mainCurrency` / `secondaryCurrency` / `customExchangeRate` / `exchangeRateMode` already exist but have **no UI** and are mostly dead/hardcoded.
- GL journal lines carry **no currency**; entry header defaults `'USD'`; auto-posters omit currency.
- ~40 main-app files use raw `$` + `.toFixed(2)`; Invoice Manager uses a broken `/1000 + "K"` LBP hack.
- Two conflicting currency lists (8 in `CurrencySettings.tsx`, 3 in `mockData.ts`).
- "Auto" rate = refresh-on-dashboard-open (no cron); silent `rate:1` fallback on failure.

---

## Cross-cutting foundation (built once, used by all phases)

### F1. Single source of truth: `SUPPORTED_CURRENCIES`
New canonical module with per-currency metadata:
```
{ code, symbol, name, decimals, symbolPosition }   // LBP decimals=0, USD decimals=2
```
Replaces both `CurrencySettings.tsx:27` (8 codes) and `mockData.ts:81` (3 codes+symbols).
Decision D1 (below) governs where this physically lives given the vendored Invoice Manager.

### F2. Unified formatter `formatMoney()`
```
formatMoney(amount, {
  currency,                 // code from SSOT; decimals derived from metadata
  style?: 'full' | 'compact',   // 89,500,000  vs  89.5M   (per-store default from profile)
  withSymbol?: boolean,
  secondary?: { currency, rate } // optional display overlay -> returns base + secondary string
})
```
- `full` = `Intl.NumberFormat` with grouping + currency-correct decimals.
- `compact` = `Intl.NumberFormat(notation:'compact')`.
- No silent 1:1 fallback anywhere.

---

## Phase 1 — Base currency, made real
1. **Store Profile UI**: currency selector (from SSOT) writing `mainCurrency`. Located in AdminProfile settings.
2. **Remove hardcoded `'USD'`** at every write path, stamp `storeProfile.mainCurrency`:
   - `functions/src/api/checkout.ts:132,190`, `squareCheckout.ts:119`, `stripeCheckout.ts:142`, `subscription.ts:277,624,740`, `ai.ts:184`, `index.ts:640`.
3. **GL currency labeling** (no multi-currency math — accurate label only):
   - `functions/src/lib/ledger/postingService.ts:94` — take currency from input, no `'USD'` default.
   - Thread `currency` through `platformAutoPosting.ts` + vendor `autoPosting.ts` (load store `mainCurrency`).
   - Add `currency` to `journalLines` write (`postingService.ts:118`).
- **Runtime proof**: create order + trigger GL post on a staging store set to LBP; show journal entry + lines stamped `LBP`.
- **Decision D3** (backfill historical vs new-writes-only).

## Phase 2 — Unified money formatter (largest phase)
1. Build F1 + F2.
2. Replace raw formatting across main app (~40 files) — storefront, orders, purchases, dashboard, reports, delivery wallet, account statement, WhatsApp (`whatsapp.ts`), invoice HTML (`invoiceTemplates.ts`).
3. Replace Invoice Manager sites + delete the `/1000+"K"` hack (`vendor/.../lib/utils.ts:9`), unify the two number-to-words impls' currency handling.
4. **Large-number toggle** (`full`|`compact`) persisted per store (new `StoreProfile.numberFormat` field) + Settings UI.
5. **PDF/statement column widths**: rework fixed x-coord columns in `AdminAccountStatement.tsx` PDF and `vendor/.../pdfExport.ts` jsPDF tables to fit large numbers (dynamic width / right-edge anchoring).
- **Runtime proof**: render a store in LBP with an 89,500,000 value — screen, invoice PDF, email, WhatsApp all show correct, non-overflowing output in both `full` and `compact`.

## Phase 3 — Secondary/display currency
1. Wire `secondaryCurrency` + `customExchangeRate` into `formatMoney`'s `secondary` option.
2. Show **both** base + secondary on product pages, cart, invoices when secondary enabled — computed at display time only.
3. Settings UI toggle to enable/choose secondary currency.
- **Guardrail check**: grep proof that no converted secondary value is written to Firestore.
- **Runtime proof**: product + invoice show dual amounts; Firestore doc still stores only base.

## Phase 4 — Rate fetching
1. **Consolidate manual entry** into Settings (remove the dashboard-buried editor `AdminDashboard.tsx:1046`).
2. **Real scheduled Cloud Function** (`onSchedule` cron) that fetches rates for configured pairs, writes to `storeProfiles`, and on failure keeps **last known good** + sets `exchangeRateLastAutoStatus:'error'` + message. **No `rate:1` fallback.**
3. Remove client `currency.ts` silent 1:1 fallback; single SSOT currency list (finishes F1 rollout).
- **Decision D4** (which pairs the cron fetches).
- **Runtime proof**: cron logs on staging showing a successful fetch + a simulated failure preserving last-good.

---

## Sequencing & dependencies
F1/F2 (foundation) → Phase 1 can partly parallel → Phase 2 depends on F2 → Phase 3 depends on F2 → Phase 4 depends on F1. Recommend **phase-by-phase staging deploy + runtime proof** before moving on.

## Rough effort estimate (focused agent build sessions)
- Foundation F1+F2: 0.5 day
- Phase 1: 0.5–1 day
- Phase 2: 2–3 days (broadest; ~40 files + PDFs)
- Phase 3: 1 day
- Phase 4: 1–1.5 days
- **Total: ~5.5–7 days**, phased, staging-verified.

## Locked decisions (Anwar, 2026-07-13)
- **D1 sharing** → Canonical module in `src/lib`, **synced/copied into vendor at build time** (one real source).
- **D2 default format** → **Full with separators** (`89,500,000`); per-store toggle still added.
- **D3 backfill** → **New writes only** — no historical migration.
- **D4 cron scope** → **USD↔LBP only** for now.
- **D5 rollout** → **Deploy + runtime-prove each phase** before the next.

## Progress
- [x] Phase 1 — code complete, builds green, emulator runtime proof PASSED (2026-07-13)
- [~] Phase 2 — foundation + vendor IM done; admin back-office sweep pending (see below)
- [~] Phase 3 — secondary/display currency: settings UI + storefront (ProductCard/ProductDetail/Cart) DONE & deployed; admin dual display pending
- [x] Phase 4 — `fetchExchangeRates` cron deployed prod 2026-07-29 (every 6h, USD↔LBP, no 1:1 fallback)

## Phase 3 status (2026-07-13)
DONE & deployed to staging:
- AdminProfile: Display (secondary) currency selector + manual exchange-rate input (with live preview). Persists `secondaryCurrency` + `customExchangeRate`; '' / 0 sentinels clear cleanly.
- `useStoreCurrency` hook (base currency + numberFormat + secondary + bound `money()`); live profile subscription.
- Storefront dual display via `formatMoney` secondary overlay: ProductCard (listings), ProductDetail (product page), Cart (items + subtotal + total). Removed Cart's hardcoded `89000` silent rate.
- Guarantee: secondary computed at display time only; never written to Firestore. No silent 1:1 fallback.

## Remaining admin back-office sweep (Phase 2 + admin dual display)
Site-by-site inline `$`+`.toFixed(2)` conversion (NO shared helper in these files — AdminOrders' local `formatCurrency` was dead code):
- AdminAccountStatement (~100 + manual-column PDF widths), AdminReports (~51), AdminOrders (~45), AdminRevenue (~24), AdminPurchases (~18), AdminBankReconciliation (~14), AdminComposedProducts (~14), AdminSalaries/SubAccounts (~11 each), plus receipts/invoice HTML strings.
- Vendor IM pdfExport column widths for large numbers.
- Estimated ~500 inline edits; recommend batching by screen with deploy+prove each.

## Phase 2 status (2026-07-13)
DONE:
- `src/lib/money/format.ts` — `formatMoney()` (full/compact, per-currency decimals, symbol position, safe secondary overlay, no silent 1:1). Self-check passed.
- Module-level default style (`setDefaultNumberFormat`) so the toggle applies app-wide without editing every call site.
- `StoreProfile.numberFormat` field + Base Currency + Large-Number toggle UI in AdminProfile.
- Vendor Invoice Manager: `formatCurrency` now delegates to `formatMoney` (kills the `/1000+"K"` LBP hack, correct decimals); `useGrabioStore` sets the default style from the profile.
- Builds: functions + frontend + vendor IM all green.

SCOPE CORRECTION — main-app rollout is much larger than the design's "~40 files":
- Actual: **~600 `toFixed(` occurrences across ~50 files**, plus hardcoded `$` inside JSX and PDF/receipt HTML strings.
- Heaviest: AdminAccountStatement (100), AdminReports (51), AdminOrders (45), AdminRevenue (24), AdminPurchases (18), AdminBankReconciliation (14), AdminComposedProducts (14), AdminSalaries/SubAccounts (11), Cart (8)…
- Even files with a local `formatCurrency`/`formatMoney` helper still hardcode `$` inline in many spots, so helper-only edits are insufficient.

PENDING:
- Main-app sweep (batched by screen — needs go-ahead on batching).
- PDF/statement column widths (AdminAccountStatement PDF + vendor pdfExport) for large numbers.
- Staging deploy + runtime proof (LBP 89,500,000 renders correctly, no overflow, both formats).

## Phase 1 result (2026-07-13)
- SSOT `src/lib/money/currencies.ts` synced into vendor + functions via `scripts/sync-currency-lib.cjs`.
- Base-currency selector added to `AdminProfile.tsx` (persists `mainCurrency`).
- Order record (`functions/src/index.ts`) + GL entries + all journal LINES stamp the store's real currency (central resolve in both `postingService`s). Payment-rail/platform billing left USD (Anwar decision).
- **Runtime proof** (`functions/scripts/proofPhase1CurrencyGl.cjs`, Firestore emulator): LBP→LBP, USD→USD, no-profile→USD, invalid(ZZZ)→USD, explicit override→EUR. ALL PASSED.
- Env note: Firestore emulator needs Java 21+. Local JRE installed at `~/.local/jdks/jdk-21.0.11+10-jre` (set `JAVA_HOME` to it for future emulator runs).
