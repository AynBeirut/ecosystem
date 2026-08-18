# Nipco — task handoff (new conversation)

**Created:** 2026-08-18  
**Owner contact:** y.malek@nip-lb.com  
**Store ID:** `DfIhBAEZ5NR7yNX0HboZvv58Nf82`  
**Accounting mode:** Lebanese PCG (migrated 2026-07-29 — TB unchanged at migration)

Use this file to start a **fresh Cursor chat** for Nipco work. Paste or `@`-mention this file plus any updates from the prior session.

---

## Context (5-minute read)

Nipco runs Lebanese PCG on Grabio. AP posts to control account **4011** (Suppliers - Invoices Payable). Unlike Little Hands (66 `pcgClientAccounts`), **Nipco has 0 per-supplier PCG client sub-accounts** — so all suppliers share one GL bucket until filtered in UI or sub-accounts are seeded.

Purchase receive / payment GL runs from the **main Grabio app** via `src/lib/platformGl.ts` → `vendor/.../glBridge.ts` (chunk name e.g. `glBridge-*.js`), **not** only the `/invoice/` embed.

---

## Done (2026-08-16 session)

| Item | Status | Notes |
|------|--------|-------|
| Party SOA — supplier filter + Supplier/Description columns | **Deployed** | `PartyStatementPanel.tsx`, `partyStatement.ts` |
| Party SOA — explain 4011 = all suppliers combined | **Deployed** | Card description + filter dropdown |
| `resolvePostingAccount` missing import (purchase-received GL crash) | **Fixed + deployed** | `autoPosting.ts` — import from `postingAccountResolver.ts` |
| Full main app rebuild + hosting deploy | **Done** | Must load **`glBridge-CevJtSdq.js`** (not `glBridge-xnAXJV8O.js`) |
| Purchase payment memo improvement (future posts) | **Code only** | `Purchase payment — {supplier} ({poId})` + `voucherMeta.payee` |

**Deploy commands used:**
```bash
cd "/home/anwar/Documents/grabio space"
npm run build
firebase deploy --only hosting:production
```

**Cache bust after deploy:** Unregister service worker → Ctrl+Shift+R → confirm new `glBridge-*.js` in Network tab.

---

## Open — verify in prod (Nipco)

- [ ] **Purchase receive** — no `[GL][purchase-received] resolvePostingAccount is not defined` after hard refresh
- [ ] **Party SOA** — Admin → Finance → Accounting → Reports → party-soa → account **4011** → **Supplier filter** shows per-supplier lines (not one blob)
- [ ] **Ref column** — shows PO/voucher where memo has `Purchase {id} — {supplier}`; older rows may still show JE ids
- [ ] **Closing balance** — filtered supplier balance vs aged payables / supplier expectations (spot-check one supplier)

---

## Open — product / data (Nipco)

- [ ] **Seed PCG client sub-accounts for suppliers** under 4011 (optional but proper sub-ledger) — template pattern: `imports/littlehands-pcg-client-accounts.template.csv`, script `scripts/seedLebanesePcgClientAccounts.cjs` / `seedEmoovePcgClientAccounts.cjs`
- [ ] **Backfill journal memos** for existing purchase payments (`Purchase payment {firestoreId}` → `Purchase payment — PO-xxx (Supplier Name)`) — data migration script if client needs readable history
- [ ] **Resolve PO display** — platform purchases use Firestore doc id in memos; map to `invoiceNumber` / `purchaseOrderNumber` / PO-189 style refs in party SOA lookup
- [ ] **610 vs 6111** — Nipco “expenses” on P&L may be COGS (6111) from Grabio 501 postings, not rent/electricity on 610 — confirm with owner what they expect to see
- [ ] **AP residual / VAT** — scripts exist if needed: `scripts/auditNipco201ApResidual.cjs`, `scripts/nipcoApVatTrueup.cjs`, `scripts/nipcoPostPurchasePaymentRelief.cjs`, `scripts/nipcoDedupePurchaseReceives.cjs`

---

## Key files

| Area | Path |
|------|------|
| Party SOA logic | `vendor/beirut-finance-flow-main/src/lib/ledger/partyStatement.ts` |
| Party SOA UI | `vendor/beirut-finance-flow-main/src/components/PartyStatementPanel.tsx` |
| GL bridge (main app) | `vendor/beirut-finance-flow-main/src/lib/ledger/glBridge.ts` |
| Re-export | `src/lib/platformGl.ts` |
| Auto-post purchases | `vendor/beirut-finance-flow-main/src/lib/ledger/autoPosting.ts` |
| Posting account resolver | `vendor/beirut-finance-flow-main/src/lib/ledger/postingAccountResolver.ts` |
| Supplier filter helper | `vendor/beirut-finance-flow-main/src/lib/ledger/ledgerActivity.ts` (`entriesForSupplier`) |
| Admin purchases (receive) | `src/pages/admin/AdminPurchases.tsx` |

---

## Related reports / backups

- `docs/reports/nipco-finished-goods-correction-client-summary.md`
- `backups/emoove-lebanese-pre-DfIhBAEZ5NR7yNX0HboZvv58Nf82-2026-07-29T18-29-44-357Z/`
- `decision-log.md` — Nipco Lebanese migration entry (2026-07-29)

---

## Pending from owner — inventory & stock reporting (2026-08-18)

**Requested for Nipco (and likely platform-wide).** Stock / inventory views must support period-based movement reports, not only current snapshot totals.

### 1. Sales list

| View | Requirement |
|------|-------------|
| **By product** | List sales aggregated or detailed **per product** (qty, value, period) |
| **By customer** | List sales aggregated or detailed **per customer** (qty, value, period) |

### 2. Purchases list

| View | Requirement |
|------|-------------|
| **By product** | Show purchase **movement per product** (received qty, cost, period) |
| **By supplier** | Show purchase **movement per supplier** (POs, amounts, period) |

### 3. Inventory & stock

| View | Requirement |
|------|-------------|
| **Stock movement** | Movement ledger (in/out/adjust) — not only on-hand qty |
| **Period filter** | **Day**, **month**, **year**, or **custom date range** (any selected period) |

### Acceptance (suggested)

- User picks date range (presets: today, this month, this year + custom from/to).
- Sales tab: toggle or sub-tabs **By product** | **By customer**; totals match orders/invoices in range.
- Purchases tab: toggle **By product** | **By supplier**; ties to `purchases` / receive lines in range.
- Stock tab: movement lines with opening → ins → outs → closing for selected period (per SKU/material where applicable).
- Export CSV for each view.

### Implemented (2026-08-18)

| Report | Route | Component |
|--------|-------|-----------|
| List of sales | Finance → Stock → **List of sales** | `StockSalesReport.tsx` — By customer \| By product |
| List of purchases | Finance → Stock → **List of purchases** | `StockPurchasesReport.tsx` — By supplier \| By product |
| Inventory & stock | Finance → Stock → **Inventory & stock** | `StockMovementReport.tsx` — line in/out + period presets |
| Movement (admin inventory) | `/admin/inventory` → **Movement** tab | Same `StockMovementReport` |

Period presets: **Today · This month · This year · Custom range**. Deploy: full `npm run build` + `hosting:production`.

### Current codebase (gap analysis — do not assume done)

| Area | Exists today | Gap |
|------|----------------|-----|
| Sales by customer | Partial — `AdminAccountStatement.tsx` sales tab groups by customer | Needs dedicated product breakdown + period UX on stock/inventory module |
| Sales by product | Tests in `src/__tests__/systemIntegration.test.ts` | Not exposed as admin report UI |
| Purchases by supplier | Partial — `AdminAccountStatement.tsx` purchases tab, supplier grouping | Product-level purchase movement not first-class |
| Stock movement | Tests in `src/__tests__/stockMovements.test.ts` | `AdminInventory.tsx` = **snapshot stats hub only** — no movement-by-period report |
| Finance embed stock | `BusinessFinanceStockReportEmbed.tsx` → `AdminInventory` | Same gap |

### Likely touch points (next agent)

- `src/pages/admin/AdminInventory.tsx` — add movement report tabs + period picker
- `src/pages/admin/AdminAccountStatement.tsx` — align or split sales/purchase list UX
- `src/pages/admin/AdminPurchases.tsx` / `AdminOrders.tsx` — data sources for lines
- New lib: e.g. `src/lib/stockMovementReport.ts` (aggregate orders, purchases, adjustments by period)
- Collections: `orders`, `purchases`, `products`, `rawMaterials`, `finishedGoods`, stock adjustment logs if any

---

## Rules for next agent

1. Read `README.md` + this file before acting on Nipco.
2. **No prod deploy** without explicit owner OK after verify steps.
3. **Nipco data fixes** — backup first (`migrateStoreLebaneseAccounting.cjs` pattern / store snapshot scripts).
4. Real numbers in client docs only from live exports — no guesses (Rule 27).
5. Short answers to Anwar; expand on “more” / “detail”.
