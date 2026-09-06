# Handoff — JV voucher line UI (Little Hands / Lebanese COA)

**Date:** 2026-09-04  
**Store:** `8WgfKtgaE8aAXdqFhIfweEo5WFq2` (Little Hands)  
**Status:** **CSS fix applied (Path A), build OK — pending deploy + user screenshot**  
**Agent session:** ended — do not continue same approach (full layout swaps)

---

## What the user wants (30-minute scope)

Fix **only** the JV line row UI:

- Debit, Credit, Foreign amount — **same width, same height, aligned columns**
- Every amount cell looks like a **boxed input** (not plain text on one row and input on another)
- **Do not** redesign header, footer, tabs, mirror help, or add/remove columns unless asked
- Keep accounting logic (mirror lines 1–2, delete line, preview/post)

Reference screenshot (user, 2026-09-04): Account | Ccy | Debit | Credit | Foreign amount | Line memo — Dr/Cr boxes staggered, foreign amount inconsistent.

---

## Current code state (uncommitted)

| File | State |
|------|--------|
| `vendor/beirut-finance-flow-main/src/components/VoucherLinesEditor.tsx` | **New file (??)** — extracted editor; Lebanese block uses `legacy-erp-excel-grid` + `data-ui="voucher-grid-v2"` |
| `vendor/beirut-finance-flow-main/src/components/VoucherEntryPanel.tsx` | **Modified** — all voucher tabs call `VoucherLinesEditor` |
| `vendor/beirut-finance-flow-main/src/components/VoucherAmountInput.tsx` | **New (??)** — comma formatting for amounts |
| `vendor/beirut-finance-flow-main/src/lib/ledger/voucherDraftLineUtils.ts` | **New/modified** — mirror, matrix totals, FX helpers |
| `vendor/beirut-finance-flow-main/src/legacy-erp.css` | **Modified** — `legacy-erp-excel-*` voucher grid styles re-added |

Last known good **git** voucher UI: commit `bfac116` — inline `<table>` inside `VoucherEntryPanel.tsx` JV tab (blue header `#316ac5`, `legacy-erp-input h-8` per cell). **No** `VoucherLinesEditor.tsx` in git.

```bash
git show bfac116:vendor/beirut-finance-flow-main/src/components/VoucherEntryPanel.tsx
# search: "TabsContent value=\"JV\""
```

---

## What was deployed (2026-09-04 ~13:38 UTC+3)

- `npm run build` → `dist/assets/Accounting-C_vq7Qr-.js` contains `voucher-grid-v2`
- `firebase deploy --only hosting` → project `market-flow-7b074` (grabio.space)

**If user still sees old UI:** PWA/service worker cache. Hard refresh or clear site data. Verify in DevTools → Network → `Accounting-*.js` → search `voucher-grid-v2`.

---

## What went wrong (avoid repeating)

1. **Scope creep** — swapped entire layouts (excel sheet ↔ blue header ↔ Ln column) instead of CSS on one table.
2. **Broken builds** — JSX errors in `VoucherLinesEditor.tsx` blocked deploy for hours; user kept seeing old bundle.
3. **Wrong “restore”** — user asked to undo last agent change; agent restored wrong version twice.
4. **No visual proof** — no screenshot from agent after deploy confirming alignment fixed.

---

## Recommended fix (next developer — ~30 min)

### Path A — Minimal (keep current structure)

**Files:** `VoucherLinesEditor.tsx` + `legacy-erp.css` only.

1. Open JV on Little Hands, confirm columns: Account, Ccy, Debit, Credit, Foreign amount, Line memo.
2. In `legacy-erp.css`, under `.legacy-erp-excel-grid`:
   - `table-layout: fixed` (already set)
   - Debit/Credit cols: equal width (e.g. both `96px` in `<colgroup>`)
   - Force every amount cell: `.legacy-erp-excel-td--num .legacy-erp-excel-slot { display: block; width: 100%; }`
   - Inputs: `width: 100%; height: 32px; box-sizing: border-box`
   - **Never** `disabled` on foreign amount — use `readOnly` or always enabled so row 1 and row 2 look the same
3. Remove **Ln** column if user didn’t ask for it (extra column was agent-added).
4. `npm run build` — must exit 0 before deploy.
5. Deploy + screenshot from live JV.

### Path B — Revert UI, keep logic (safest for user trust)

1. `git show bfac116:.../VoucherEntryPanel.tsx` — copy Lebanese JV `<table>` markup.
2. Wire mirror/delete via existing `voucherDraftLineUtils` (`mirrorJvAmount`, `resyncJvMirrorPairs`).
3. Delete or slim `VoucherLinesEditor` to wrapper only.
4. One CSS pass: `legacy-erp-input h-8 w-full` on **every** numeric cell.

---

## Accounting logic (do not break)

- **Mirror:** lines 0↔1 only; editing line 2 sets `mirrorDetached: true`
- **JV pattern (AM):** L1 total Dr → L2 copies → change L2 to bill → L3+ FX/tips/cash
- **Balance:** `draftMatrixBalanced` for US/LL buckets when `matrixJvFooter` + `jdEdwardsGrid`
- **Tests:** `vendor/beirut-finance-flow-main/src/lib/ledger/voucherJdEdwardsAllTypes.test.ts` (run from `beirut-finance-flow-main` with vitest alias configured)

---

## Build & deploy

```bash
cd "/home/anwar/Documents/grabio space"
npm run build                    # must succeed
firebase deploy --only hosting   # only after Anwar confirms build OK
```

Hosting: Firebase `market-flow-7b074` → grabio.space / invoice path.

---

## Verify done

- [ ] Screenshot: 2-line JV with Dr on L1, Cr on L2, foreign amount — **all boxes same size, columns aligned**
- [ ] Preview JV works (no page reset)
- [ ] Post still blocked when unbalanced
- [ ] User sign-off on Little Hands JV tab

---

## Contact / context

- Lebanese COA voucher shell: `VoucherEntryPanel.tsx` → `legacy-erp-voucher--classic`
- `jdEdwardsGrid` + `mirrorPair` props on `VoucherLinesEditor` for JV/CRN/DRN/PV/RV

**Do not** open client emails or change accounting rules without AM (Abdul) confirmation.
