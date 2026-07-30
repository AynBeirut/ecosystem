# GL Phase 4 — Platform Bridge (staging approval file list)

**Branch:** `feat/gl-phase4-platform-bridge`  
**Scope:** Platform orders/production/payroll/bank recon → GL (no prod deploy without approval)

## Posting rules implemented

| Event | GL entry | Source |
|-------|----------|--------|
| Order paid/delivered | Dr Cash/AR, Cr Revenue; Dr COGS, Cr FG | `order` / `sale-recognized` |
| Order return/refund | Reverse revenue + COGS | `order` / `reversal-*` |
| Production complete | Dr FG Inventory, Cr Raw Materials (1200) | `production` / `complete` |
| Payroll payment | Dr Payroll (6020), Cr Bank | `payroll` / `paid` |
| Cash collection deposit | Dr Bank, Cr Cash | `cash_collection` / `deposited` |

COGS uses **FG `costPrice` at deduction time** (weighted-average subledger).

Errors **throw** (no silent skip) via `glBridge` `logGlError` rethrow.

## Files changed (approval list)

### Cloud Functions
- `functions/src/lib/ledger/defaultChartOfAccounts.ts` — **new**
- `functions/src/lib/ledger/postingService.ts` — **new**
- `functions/src/lib/ledger/platformAutoPosting.ts` — **new**
- `functions/src/lib/ledger/platformGlBridge.ts` — **new**
- `functions/src/lib/ledger/resolveOrderCogs.ts` — **new**
- `functions/src/services/orderInventory.ts` — GL after paid inventory deduction

### Finance (Invoice Manager GL)
- `suba eco sys/finance/beirut-finance-flow-main/src/lib/ledger/autoPosting.ts` — order/production/payroll/cash
- `suba eco sys/finance/beirut-finance-flow-main/src/lib/ledger/glBridge.ts` — platform hooks + throw on failure
- `suba eco sys/finance/beirut-finance-flow-main/src/lib/ledger/defaultChartOfAccounts.ts` — `PAYROLL` code

### Main Grabio admin hooks
- `src/lib/platformGl.ts` — **new** re-export bridge
- `src/lib/resolveOrderCogs.ts` — **new** FG cost at sale time
- `src/pages/admin/AdminOrders.tsx` — delivered + refund GL
- `src/pages/admin/AdminProduction.tsx` — production complete GL
- `src/pages/admin/AdminSalaries.tsx` — payroll GL
- `src/pages/admin/AdminBankReconciliation.tsx` — bank deposit GL

### Verification
- `scripts/verifyGlPhase4E2E.cjs` — **new** runtime E2E

## Out of scope (deferred)
- Multi-currency, period lock, audit-grade close
- Delivery-wallet UI (GL hook `autoPostDeliveryWalletSettlement` in functions only; no UI yet)
- WIP account (optional — posts Dr FG / Cr Raw Materials directly)

## Runtime proof

```bash
cd functions && npm run build
node scripts/verifyGlPhase4E2E.cjs
```

Expected: `=== GL Phase 4 E2E PASSED ===`

## Staging deploy (after approval)

```bash
firebase deploy --only functions,hosting --project market-flow-7b074
# Staging channel if used:
# firebase hosting:channel:deploy staging --expires 7d
```

**Not included:** firestore.rules changes (none required for GL paths under `stores/{storeId}/`).
