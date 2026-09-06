# Handoff — Little Hands Accounting / Trial Balance (2026-08-31)

**Paste this into a new Cursor chat.** Repo: `/home/anwar/Documents/grabio space`

## Goal
Fix Lebanese COA Trial Balance for **Little Hands** store so posted Grabio operational accounts (102, 601, etc.) roll up into PCG client working numbers (53001000001…) with real Dr/Cr — not all `0 LBP`.

## Store
| Field | Value |
|-------|-------|
| Store ID | `8WgfKtgaE8aAXdqFhIfweEo5WFq2` |
| Brand | Little Hands · B.F. |
| Cash (Grabio) | `102` → PCG client `53001000001` (parent `5300`) |
| Currency | LBP |

## Symptom (user report)
TB range `53001000001` → `70901000001`, period Jan–Aug 2026: **29 accounts, all zeros**. Rows shown were class 2/4/6 PCG headers (2231, 4426.6…) — wrong subtree for a 53xx–70xx range.

## Root cause (diagnosed)
1. **Comma-separated From codes** — picking a PCG parent (e.g. `5300`) stored `53001000001, 53001000002` in `fromCode`, breaking `isAccountInCodeRange` and rollup.
2. **Chart filter ignored client working numbers** — `filterPcgChartByAccountRange` only marked PCG chart rows, not client-account parents, so tree could be empty/wrong for client-code ranges.
3. **`rangedRows` filter** stripped operational ledger rows from tree rollup (fixed: pass full `rowByAccountId`).
4. **Default Lebanese range `1`–`7`** showed inactive class 2/4/6 headers with no movement when user expected client-code range.

## Fix shipped (2026-08-31 ~20:53 UTC+3)
- `normalizeRangeEndpoint` / `normalizeAccountRangeBounds` in `accountCodeRange.ts`
- `TrialBalancePanel.tsx`: normalize on Search; `accountRangeEndpoint` on picker; default range = min→max `pcgClientAccounts.clientCode`
- `trialBalanceHierarchy.ts`: mark chart ancestors from client accounts; full `rowByAccountId` for rollup
- Tests added in `accountCodeRange.test.ts`, `trialBalanceHierarchy.test.ts` (10 tests pass)
- **Deployed:** `firebase deploy --only hosting` → `market-flow-7b074.web.app`

## Verify (new chat must do this first)
1. Hard refresh (Ctrl+Shift+R)
2. Little Hands → Accounting → Trial balance
3. From `53001000001`, To `70901000001`, period `2026-01-01` → `2026-08-31`, click **Search**
4. Expect class **5** / cash `53001000001` with movement (~86k Dr / ~57k Cr on 102 historically)
5. If still zero: pull Firestore `journalEntries`/`journalLines` for store + check `report.rows` in React devtools — don't guess

## Key files
```
vendor/beirut-finance-flow-main/src/components/
  TrialBalancePanel.tsx
  AccountRangePicker.tsx
  AccountActivitySheet.tsx
  AccountingSideSheet.tsx
  VoucherEditSheet.tsx
  VoucherDetailDialog.tsx
  GeneralLedgerPanel.tsx
vendor/beirut-finance-flow-main/src/lib/ledger/
  accountCodeRange.ts
  trialBalanceHierarchy.ts
  grabioToPcgMap.ts
  lebanesePcgTree.ts
  trialBalanceExtended.ts
```

## Also done this session (same branch, uncommitted)
- In-page voucher edit (`VoucherEditSheet`, `AccountingPostedEditContext`)
- Unified accounting slide sheets (`AccountingSideSheet`)
- GL popup matches GL columns (`GlVoucherSummaryStrip`, `presentGlEntry`)
- Reversed 4 test vouchers — `scripts/reverseTestVouchersLittleHands.cjs`, report `reporting/data/littlehands-test-voucher-cleanup-2026-08-31.json`
- Payroll GL structure (631/428 subaccounts) — `payrollPosting.ts`, backfill script; **functions may need deploy**

## Not done / backlog
- [ ] Confirm TB fix live on Little Hands (user verification)
- [ ] Migrate `ReconciliationVarianceSheet`, `PcgAccountMovementsSheet` to `AccountingSideSheet`
- [ ] `firebase deploy --only functions:api` if payroll posting not live
- [ ] Historical payroll JE cleanup (old 601→102 duplicate expense lines)
- [ ] Git commit + dual push (large uncommitted diff — **do not commit `.env.production`**)

## Build / deploy
```bash
cd "/home/anwar/Documents/grabio space"
npm run build:main
firebase deploy --only hosting
# functions (if payroll):
cd functions && npm run build && firebase deploy --only functions:api
```

## Prior transcript
`/home/anwar/.cursor/projects/home-anwar-Documents-grabio-space/agent-transcripts/1053ff64-603b-4117-8d13-3e2c00687fce/1053ff64-603b-4117-8d13-3e2c00687fce.jsonl`
