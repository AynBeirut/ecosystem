# Grabio — Structure map (Accounting vs Business Tools)

**Scope of this file:** How **Accounting** (accountant-only) and **Business Tools** (owner / manager / cashier / sales) relate.  
**Out of scope for UI work (leave as-is):** Dashboard Home, Daily Operations, Sales & Customers, Profile & Store Setup — POS, orders, products, CRM, etc.

**Principle:** Grabio is a full store platform, not an accounting app. **Accounting terms, PCG codes, vouchers, TB, GL** live **only** inside Accounting. Business Tools use **everyday language** but **post to the same ledger** in the background.

---

## 1. Accounting (accountants & bookkeepers only)

**UI:** Admin → Business Tools → **Business Finance** (`Landmark` icon)  
**Home route:** `/admin/finance/quotations`  
**Top tabs:** Quotation · Accounting (hub: vouchers only) · Receipts · Reports · Settings  
**Accounting default:** Card hub — Vouchers, Workspace, Party statement. Reports/COA/FX live on **Reports** and **Settings** tabs (not duplicated on Accounting).  
**Engine:** `vendor/beirut-finance-flow-main/src/pages/Accounting.tsx`  
**Audience:** Owner-accountant, external accountant, finance admin — **not** cashier / waiter / field sales.  
**Language:** Trial Balance, Balance Sheet, P&L, Party SOA, AR/AP Aging, VAT Filing, PCG client codes, vouchers, reconciliation.

**Data:** Firestore `stores/{storeId}/ledgerAccounts`, `journalEntries`, `journalLines`, `pcgClientAccounts`  
**Lebanese mode:** Reports show **PCG / client account numbers**; posting stays on **Grabio 3-digit** codes.

### Financial statements (GL-derived)

| Report | Tab id | Purpose | Builder |
|--------|--------|---------|---------|
| **Trial Balance** | `trial-balance` | All ledger accounts; debits = credits check. Views: 2 / 4 / 6 column. | `lib/ledger/trialBalance.ts`, `trialBalanceExtended.ts` |
| **Balance Sheet** | `balance-sheet` | Assets, liabilities, equity as of date. | `lib/ledger/balanceSheet.ts` |
| **P&L** | `profit-loss` | Revenue, COGS, expenses, net result for period. | `lib/ledger/incomeStatement.ts` |

**Depends on:** posted journal entries only · **As-of date** (header) · TB must balance before close period.

**Lebanese display:** account column uses `displayPcgCodeForLedgerRow` + `pcgClientAccounts` (e.g. `53001000001` not `102`).

### Ledger detail

| Report | Tab id | Purpose | Builder / UI |
|--------|--------|---------|--------------|
| **Party SOA** | `party-soa` | Statement of account for one **customer (AR)** or **supplier (AP)** over a date range. | `lib/ledger/partyStatement.ts`, `PartyStatementPanel.tsx` |
| **GL Report** | `general-ledger` | Full general ledger: accounts, vouchers, debits/credits, drill-down. | `GeneralLedgerPanel.tsx` |

**Party SOA accounts:** AR Grabio **110** · AP Grabio **201** (PCG **4111** / **4011** when client codes seeded).

### Subledger aging (operational + GL tie-out)

| Report | Tab id | Purpose | GL tie | Builder |
|--------|--------|---------|--------|---------|
| **AR Aging** | `ar-aging` | Unpaid **customer invoices** by age bucket (0–30, 31–60, 61–90, 91+). | Grabio **110** | `lib/ledger/agedReceivables.ts` |
| **AP Aging** | `ap-aging` | Unpaid **supplier purchase orders** by age bucket. | Grabio **201** | `lib/ledger/agedPayables.ts` |

**Buckets:** `current` · `days31_60` · `days61_90` · `days91_plus`  
**Shows:** subledger total vs GL balance (variance if mismatch).

**Lebanese client codes (Little Hands examples):** AR `41111000001` · AP `40111000001`.

### Tax

| Report | Tab id | Purpose | Key Grabio accounts | Builder |
|--------|--------|---------|---------------------|---------|
| **VAT Filing** | `vat-filing` | Period VAT summary: output, input, net; CSV / MoF worksheet export. | Output **220** · Input **140** · Settlement **222** | `lib/ledger/vatFilingSummary.ts`, `vatFilingMofExport.ts` |

**Period:** month picker on tab · **11%** Lebanon default on seeded accounts.

### Workspace tabs (same Accounting page)

Not in the user report list but same shell: Chart of Accounts · Vouchers · Cash Flow · Depreciation · Opening Balances · Reconciliation · Bank Rec · FX Reval · Tax (R10/CNSS) · Recurring · Checks · Cost Centers · Bulk Import · Accountant Workspace.

### Stores (reference)

| Store | ID | accountingMode | pcgClientAccounts |
|-------|-----|----------------|-------------------|
| E-Moove (pilot) | `EZfuoNQFTJVU4cubNuckpp4K7zw2` | lebanese | seeded |
| Little Hands | `8WgfKtgaE8aAXdqFhIfweEo5WFq2` | lebanese | 66 (full Grabio map) |

### Verify scripts (accounting)

- `scripts/verifyLittleHandsAccountingSuite.cjs` — TB balance + mode + client accounts  
- `scripts/verifyAgedReceivablesE2E.cjs` / `verifyAgedPayablesE2E.cjs`  
- `scripts/verifyVatFilingSummaryE2E.cjs`  
- `scripts/verifyPosGlSyncE2E.cjs` — POS → GL posting

---

## 2. Business Tools (operational money — plain language)

**Nav group:** Admin sidebar → **Business Tools** (`useAdminNavigation.ts` → `setup_system`)  
**Audience:** Store owner, manager, admin — **not** accounting jargon on screen.  
**Rule:** Every action here should **feed Accounting automatically** (GL post or subledger row). Users never need to open Accounting to run the store.

**Do not rename Daily Operations or Sales screens.** Cashiers use **Orders / POS / Payments**; managers use **Reports / Customers** — unchanged.

### Current routes (as shipped)

| User-facing label | Route | Plain purpose | Feeds accounting (backend) | UI workstream |
|-------------------|-------|---------------|----------------------------|---------------|
| **Invoice Manager** | `/admin/finance/*` (embed) | Invoices, estimates, receipts, clients, suppliers, products for documents | Finance invoices → GL sales / AR; PO receipts → AP | Keep document UX; **Accounting tab stays inside IM for accountants only** |
| **Account Statement** | `/admin/account-statement` | “Who owes us / we owe” — customers, suppliers, products | Reads `orders`, `purchases`, `accountPayments`; **not yet full GL view** | **Active:** plain labels, clickable invoice/order lines, no PCG on screen |
| **Cash Collection** | `/admin/cash-collection` | “Take cash to the bank” — pick orders, record deposit | `cashCollections` → **Dr Bank 103 / Cr Cash 102** | **Active:** merge deposit + undeposited list; no “reconciliation” wording |
| **Delivery Wallets** | `/admin/delivery-wallet` | Driver COD held vs settled | Delivery wallet GL bridge | Later phase |
| **Staff (Payroll)** | `/admin/staff` | Pay staff, salary runs | Payroll → expense + cash/bank GL | Later phase |
| **Sub-Accounts** | `/admin/sub-accounts` | Cashier / seller logins | Access only — no GL | **No change** |
| **Marketplace Sync** | `/admin/marketplace` | Dropship catalog sync | Inventory only | **No change** |
| **Store Logs** | `/admin/audit-logs` | Who changed what | Audit trail | **No change** |
| **AI Agent** | `/admin/ai-agent` | Store assistant | None | **No change** |
| Finance Suite (legacy hub) | `/admin/finance` | Shown only when Invoice Manager embed off | — | Hide when IM enabled |

### Language boundary (examples)

| ❌ Do not show in Business Tools | ✅ Show instead |
|----------------------------------|-----------------|
| Party SOA, AR 110, AP 201 | Customer balance / Supplier balance |
| Undeposited cash subledger | Cash not yet at the bank |
| Journal entry, voucher, PCG 53001000001 | (hidden — posts silently) |
| Debit / credit columns on owner screens | Invoiced / Paid / Still due |
| Trial balance, GL report | (Accounting only) |

Accountants who need debits, PCG, and TB use **Invoice Manager → Accounting** — never mixed into Cash Collection or Account Statement.

### Business Tools → GL map (developer reference)

| Operational event | Source collection / screen | GL event (Grabio codes) |
|-------------------|----------------------------|-------------------------|
| POS / order sale (cash or credit) | `orders` via POS / Orders | Sale + COGS + cash or AR **110** |
| Customer payment recorded | `accountPayments` / order payment | Cr AR **110** / Dr cash **102** or bank **103** |
| Bank deposit from drawer | `cashCollections` / Cash Collection | Dr bank **103** / Cr cash **102** |
| Purchase received | `purchases` / Purchases admin | Dr inventory / VAT **140** / Cr AP **201** |
| Supplier payment | purchase payment flow | Dr AP **201** / Cr cash or bank |
| Payroll paid | `salaryPayments` / Staff | Dr salary expense / Cr cash or bank |
| Invoice Manager invoice paid | finance invoices | Same as AR/cash rules via `glBridge` |

### UI reorg — Business Tools only (planned)

**Phase A (now):** Account Statement + Cash Collection — everyday copy, drill-down to order/invoice, export PDF unchanged for accountant handoff.  
**Phase B:** Customer/supplier “balance” home cards; deposit wizard tied to undeposited list.  
**Phase C:** Retire duplicate “Finance Suite” paths; single Business Tools sub-nav (no Accounting links for non-accountants).

**Explicitly not in this workstream:** Orders, POS, Products, Purchases (operational screens), CRM, Analytics, Profile, nav groups outside Business Tools.

### Known gaps (Business Tools vs Accounting)

1. **Account Statement Ledger modal** — print-only; no click-through to order (fix in Phase A).  
2. **Two paradigms** — admin account statement vs GL Party SOA; owner screen should stay simple; accountant uses Accounting tab for GL-accurate SOA.  
3. **Payment double-count risk** — account-level payments + order cash on same customer (review allocations before trusting closing balance). **Phase 2 (2026-08-02):** `onAccountPaymentCreated` CF auto-posts RV/PV + `financeReceipts` doc; invoice/payment-order GL now tagged RV/PV; feed dedupes auto receipts vs raw sources.

---

*Last updated: 2026-08-02*
