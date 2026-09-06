# Little Hands — pre-audit handoff (2026-09-05)

**Store:** `8WgfKtgaE8aAXdqFhIfweEo5WFq2` · **Mode:** Lebanese PCG · **Hosting:** grabio.space / market-flow-7b074

## Deployed tonight

- **Hosting** — bundle `Accounting-BfDXx8YL.js` (discount RV UX, PCG-only UI, voucher detail totals)
- **Functions** — `onOrderCreated`, `onOrderStatusChanged` (POS sale GL: gross revenue + Dr 7090/410), `api`

Hard refresh (Ctrl+Shift+R) before demo.

## Ledger state (verified)

| Check | Result |
|--------|--------|
| TB balanced | $157,625.90 Dr = Cr |
| Bulk 401 | $0 |
| Test JVs in posted TB | 0 |
| PCG client accounts | 460 |
| Discounted POS orders w/ GL line | 10/10 |

**Reports:** `reporting/data/littlehands-pre-audit-2026-09-05.json`, `littlehands-sales-discount-backfill-2026-09-05.json`, `littlehands-ledger-fix-2026-09-05.json`

## Audit demo path

1. **Trial Balance** — classes 1–7, full numbers, search `102` / `7010` / `7090`
2. **GL** — double-click any RV; voucher detail shows Subtotal / Discount / Net when discount meta present
3. **P&L** — class 7 gross sales; 7090 discounts in class 7 contra
4. **POS** — new discounted sale posts Dr cash (net), Cr client revenue (gross), Dr 7090

## Re-run gates

```bash
node scripts/auditLittleHandsPreAudit.cjs
node scripts/verifyLittleHandsAccountingSuite.cjs
```

## Known limits

- Historical discount backfill adjusted 10 orders (Jul POS); rounding fixed to ±$0.01 on 2 JEs
- New POS orders only get discount GL after deploy (live from tonight forward)
