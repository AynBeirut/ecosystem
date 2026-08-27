# Finishing — account manager capture

**Last updated:** 2026-08-27 (with account manager — GL range, TB empty / class zeros)

Living list of polish / closure items before accounting is “done” for clients. Implementation stays in backlog until confirmed.

**Refs:** `docs/planning/accounting-ref.md` (66-account Grabio SMB chart), `docs/planning/lebanese-pcg-v2-plan.md` (Lebanese PCG display + extensions).

---

## Accounting

### Chart of Accounts — add new account

- [ ] **Add new account** from Accounting → Chart of Accounts (not only “Initialize / Refresh COA”).
- [ ] **Account number:** auto-generate next valid code under parent/type **or** allow **manual edit** before save (accountant override).
- [ ] Validate: no duplicate codes; parent/type/normal balance consistent; inactive PCG headers vs detail (G/D) rules in Lebanese mode.
- [ ] Persist to `ledgerAccounts` (Firestore); reflect in COA table + manual journal account picker.
- [ ] **Existing partial:** Lebanese PCG panel supports “add client working account” under a PCG parent (right-click detail row) — extend / unify with flat international COA add flow.

### COA audit — 65 accounts to check

- [ ] **65 accounts** flagged by account manager for review (names, codes, active vs inactive, mapping to auto-posting).
- [ ] Cross-check against `INTERNATIONAL_CHART_OF_ACCOUNTS` in `vendor/beirut-finance-flow-main/src/lib/ledger/coaTemplates.ts` (66 seeded rows — confirm which one is excluded or if count is post-audit).
- [ ] Document sign-off: corrected list → update `coaTemplates.ts` + `docs/planning/accounting-ref.md` + re-seed policy (new stores only vs migration).

### Trial Balance — UI/UX (AM 2026-08-27)

**Current code:** `vendor/beirut-finance-flow-main/src/components/TrialBalancePanel.tsx` — From/To uses `LedgerAccountCombobox`; amounts use `formatCurrency(…, 'compact')` (K/M); GL drill calls `onOpenGl` → navigates away to General Ledger tab; table capped `max-h-[min(36rem,70vh)]`.

- [ ] **Account range entry (From / To):** improve picker UX — clearer search, code + name, Lebanese PCG codes, validation feedback before Search. AM: “enter account” flow needs polish.
- [ ] **LE / currency label not clear:** show explicit currency on TB (e.g. **LBP** / **LL** / full “Lebanese Pound”) — not ambiguous **L£** or cramped headers. Align with accountant convention (confirm LE vs LL vs LBP with AM).
- [ ] **No K / M abbreviations:** trial balance must show **full amounts** with grouping (e.g. `89,500,000`) — not compact `89.5M`. Switch TB cells from `compact` to `full` style; respect LBP 0 decimals / USD 2.
- [ ] **Currency choice + display:** let user pick reporting currency (LBP / USD / both) on TB; column headers and footer must state active currency; optional dual-line if store has secondary currency + rate.
- [ ] **Voucher drill-down without leaving page:** clicking account / movement opens **voucher detail in-panel** (sheet or dialog — reuse `VoucherDetailDialog` / `PcgAccountMovementsSheet` pattern). Do **not** navigate to General Ledger tab for routine review.
- [ ] **Full-screen trial balance:** expand TB to full viewport (toggle or default in workspace) — accountants need wide grid, not ~36rem scroll box.

### P&L (Profit & Loss) — layout from AM

**Status:** **Implemented 2026-08-27** — AM print attached (`docs/planning/am-profit-loss-form.png`).

**Code:** `lebaneseProfitLoss.ts` + `LebaneseProfitLossDocument.tsx` on Accounting → P&L. Sections: INCOME / Total Class 7; C.O.S (B.I, Purchases Goods, E.I); Gross Profit; EXPENSES; PBT; Others (FX); Additions; Taxable; TAX; NET PROFIT; Difference of Exchange footer. LBP header, 3 decimals, parentheses for losses.

- [x] Receive AM **P&L image/form**.
- [x] Map form → report sections.
- [x] Full numbers (no K/M), currency label LBP, Print + CSV.
- [ ] AM sign-off on live store numbers vs print.

### General Ledger (GL) — display voucher

**Current code:** `GeneralLedgerPanel.tsx` — columns Type / Voucher show `voucherType` + truncated `voucherNumber`; **View** button calls `onOpenEntry` → `VoucherDetailDialog` (partial).

**AM requirement:** GL must **display the voucher** clearly — accountant can open full voucher from the ledger line without hunting elsewhere.

- [ ] **Clickable voucher number** (and/or Type badge) on every GL row — opens `VoucherDetailDialog` with full JE: serial, date, memo, all debit/credit lines, party, ref, cost center.
- [ ] Show **full voucher serial** (e.g. `JV-2026-00042`) — not truncated `entryId`.
- [ ] Stay on GL (dialog/sheet overlay) — same pattern as TB voucher drill-down.
- [ ] If voucher is draft vs posted, badge state visible on GL row.
- [ ] Verify `onOpenEntry` wired on all GL embed paths (Reports workspace + any account drill from TB).

### Account statement (SOA) — search, opening Dr/Cr, per-account page

**Current code:** `AccountRangeStatementPanel.tsx` (+ `AccountStatement.tsx` embed) — **plain text** From/To codes (not account search combobox); max **40 accounts** per range; multiple accounts stacked on one scroll; opening row shows **net balance only** (Dr/Cr columns empty); movement lines capped at **200** on screen; Lebanese mode excludes PCG group headers from selectable set.

**Also:** `PartyStatementPanel.tsx` (Party SOA tab) — AR/AP only, separate supplier filter.

**AM requirement (2026-08-27):**

- [ ] **All accounts in search** — flexible account picker (`LedgerAccountCombobox` or equivalent): every active ledger account searchable by code, name, Arabic, PCG display code; support single account or range; no arbitrary 40-account wall without UX path (widen limit or paginate range).
- [ ] **Starting debit + credit** — opening line must show **opening Dr** and **opening Cr** (and balance), not net-only in Balance column; full detail on opening row (date = period start, label per AM convention).
- [ ] **Full movement detail** — voucher serial, party, ref, type — align with GL/TB voucher display; clickable voucher → `VoucherDetailDialog`.
- [ ] **One statement = one page** — each account’s statement on its **own page** (pagination, tabs, or print page-break) — not one long stacked list of sections.
- [ ] Shared finishing: full amounts (no K/M), currency label clarity, optional full-screen / print layout per page.
- [ ] Party SOA: confirm same search + opening Dr/Cr rules for AR/AP party statements, or scope as separate follow-up.

### Quick statement — still not displaying correctly (AM 2026-08-27)

**Status:** **Broken / incomplete** — AM confirms quick statement preview is **not correct** yet.

**Current code:** `QuickStatementDialog.tsx` (toolbar **Quick statement** in `AccountingQuickBar`) — small dialog; plain From/To **text codes**; preview shows per-account **Open/Close net only**; movements flattened across accounts (Date / Voucher / Balance only — **no Dr/Cr**, no account column); capped **80** movement rows; no Lebanese PCG display codes; currency from default `formatCurrency()` not store-aware label.

**Must fix (align with full SOA above):**

- [ ] Correct **layout and numbers** — AM sign-off on what “correct” looks like (screenshot from AM if possible).
- [ ] **Opening debit + credit** (not net-only Open column).
- [ ] Movement lines: **Dr / Cr / balance**, voucher serial, description; **group by account** (not one mixed list).
- [ ] **Account search** — combobox with all accounts (same flexible search as full SOA).
- [ ] Lebanese mode: PCG / client subaccount codes and names.
- [ ] Full amounts, currency label; optional expand to full statement without losing context.
- [ ] Regression: “Display” builds report, CSV export, “Full statement” handoff to `AccountRangeStatementPanel` prefill.

### GL — from account to account (AM 2026-08-27)

**Current code:** `GeneralLedgerPanel.tsx` — **single account** combobox only; period From/To are **dates**, not account range.

**AM requirement:** GL account selection = **From account → To account** (same flexible search as TB/SOA), then show movements for all accounts in range.

- [ ] Replace single-account picker with **From / To** `LedgerAccountCombobox`.
- [ ] Multi-account GL: sections per account or combined register — align with SOA pagination rules.
- [ ] Keep voucher display, opening Dr/Cr, cost-center filter.

### Trial balance — accounts not showing / classes 1–7 all zero (AM 2026-08-27)

**AM report:** Trial balance **does not display accounts**; wide range shows **7 accounts all zero**.

**Likely causes (code — verify on AM store):**

1. **Lebanese empty grid:** if PCG `hierarchyRoots` is empty, UI returns **no rows** even when operational accounts match.
2. **Range `1` → `7`:** shows PCG **class headers** (1–7) with **0** rollups — real activity is on Grabio codes (102, 601, …) not summed into those headers.
3. **Grabio vs PCG codes** in From/To — range matches wrong set.
4. User must click **Search**; filters may hide expected rows.

**Must fix:**

- [ ] Fallback to **flat operational account list** when tree build fails or is empty.
- [ ] Class 1–7 rollups from mapped operational + client subaccounts.
- [ ] Clear errors vs true zero activity; re-test with AM on live store.

### Vouchers (JV / PV / RV / CV) — currency, JV party, edit, subaccounts

**Note:** AM may say “GV” — treat as **voucher entry** scope (`VoucherEntryPanel.tsx`).

**Current code:** JV has FX amount + rate fields on some layouts; `transactionCurrency` on line model but **no clear currency picker**; **no exchange preview** before post; posts immediately via `finalizePost` (allocation dialog for PV/RV only); **reverse** exists but **no edit posted JE**; PV/RV have optional supplier/client pickers — **JV has no forced party**; `pcgClientAccounts` subaccounts are **manual** (COA right-click / CSV import), not auto on client/supplier create.

**AM requirement (2026-08-27):**

- [ ] **Currency choice** on voucher lines — pick transaction currency (LBP / USD / …) per line or per voucher; use store rates from currency settings.
- [ ] **Display exchange result** — show converted base amount live (FX × rate → LBP/USD posting amount) on each line and in totals.
- [ ] **Preview before post** — confirm screen: full voucher layout (accounts, Dr/Cr, FX, party, memo) before final post; not post-on-click without review.
- [ ] **JV — force client or supplier** — required party selector on every JV (which side depends on accounts touched, or AM rule: always pick one).
- [ ] **Edit after post** — allow correcting posted vouchers (amend entry + audit log), not reverse-only; define rules: open period only, audit trail, reprint serial vs amendment number.
- [ ] **Auto subaccount** — on **every new client** → create AR subaccount under PCG parent (411x / 110); on **every new supplier** → AP subaccount (401x / 201); sync `pcgClientAccounts` + link `clientId`/`supplierId`; backfill job for existing clients/suppliers missing subaccounts.

---

## Open questions (account manager)

| # | Question | Owner |
|---|----------|-------|
| 1 | Auto-number rule: next sibling under parent, or next free code in range (e.g. 601 → 6011)? | AM |
| 2 | Manual code edit: allowed for all types or detail (D) only? | AM |
| 3 | Which **65** accounts are in the audit set (export / spreadsheet)? | AM |
| 4 | TB currency label: **LE**, **LL**, or **LBP** on screen? | AM |
| 5 | TB currency: store main only, or user toggle LBP/USD per report? | AM |
| 6 | P&L form image — received; live-store sign-off vs print | AM |
| 7 | SOA pagination: prev/next account vs tab list vs print page-break only? | AM |
| 8 | Posted voucher edit: amend same serial vs new correction JV? | AM |
| 9 | JV party rule: always client **or** supplier, or derive from account type? | AM |
| 10 | Subaccount code pattern (e.g. parent + sequential suffix) | AM |
| 11 | Quick statement — AM screenshot of **correct** layout | AM |
| 12 | TB test range on AM store (which From/To codes were used when 7 zeros)? | AM |
