# Decision Log

> **Canonical decision log:** `~/Documents/grabio-platform-docs/Decision-Log/`  
> Mirror significant decisions there when closing a sprint.

## 2026-07-29 — CRM Phase 1: Sales Team Tracking

**Decision:** Extend Sales CRM from pipeline-only to **field visit tracking** per `the eco sys/Phase 1 Sales Team Tracking System.pdf`.

**Shipped in repo:**
- Customer fields: code, type, district, area, GPS, assigned rep, status, **lastVisitDate** (auto on completed visit)
- Rep fields: assigned territory, daily visit target
- Visit log: time in/out, GPS, visit completed, order taken, notes
- **Morning dashboard:** per-rep today metrics + per-district weekly coverage
- Customer list, colour-coded map (today / week / not visited)
- Pipeline retained for future expansion

**Next:** Prod deploy, rep mobile UI for check-in/out, bulk customer import.

**Decision:** v1 Lebanese mode (66 Grabio codes + `nameAr`) is insufficient for accountant UX. v2 adds full **522-account PCG tree** from `the eco sys/Chart of Accounts.xlsx` for display; **posting map unchanged** until Phase 2.

**Plan:** [docs/planning/lebanese-pcg-v2-plan.md](docs/planning/lebanese-pcg-v2-plan.md)

**Phase 2 shipped (staging):** `grabioToPcgMap.ts` — Trial Balance / Balance Sheet / active COA show PCG codes (e.g. 102→5300, 120→3110, 201→4011). GL posting unchanged. **User verified PASS** on staging.

**Phase 3 shipped + verified (prod 2026-07-29):** `pcgClientAccounts` + COA panel (add/edit/delete, CSV import/export). Trial Balance shows client 8–11 digit codes when mapped. E-Moove test: 102→`53001000002`, totals unchanged.

**Sprint closed (2026-07-29):** Phases 1–3 **shipped prod**. AP aging draft-PO fix deployed (main bundle rebuild). AR aging **PASS**. AP server verify **PASS** ($181,796.77 = GL 201, variance $0).

**Batch Lebanese migration (2026-07-29):** All stores **with GL data** migrated — E-Service, Yvonne's, 3 POS test stores. Each: backup + verify PASS. **13 stores skipped** (no ledger/COA yet — get lebanese on first finance setup if profile default changes).

**Nipco (2026-07-29):** Migrated `DfIhBAEZ5NR7yNX0HboZvv58Nf82` to Lebanese — backup + verify PASS (365 posted JEs, TB $502,309.31 unchanged). AP/AR variance $0.

**Little Hands (2026-07-29):** Migrated `8WgfKtgaE8aAXdqFhIfweEo5WFq2` to `accountingMode=lebanese` — backup + verify PASS (2055 posted JEs, GL totals unchanged). AP/AR aging variance $0. Template: `imports/littlehands-pcg-client-accounts.template.csv`; seed: `scripts/seedLittleHandsPcgClientAccounts.cjs`. **Owner:** fill client ERP codes then import.

**Blocked on owner (E-Moove only):** Fill `imports/emoove-pcg-client-accounts.template.csv` with legacy ERP client codes (17 rows blank) → Import CSV in Accounting or `node scripts/seedEmoovePcgClientAccounts.cjs --apply`. **Nipco untouched.**

**Multi-currency Phase 4:** `fetchExchangeRates` deployed (USD↔LBP, 6h cron). Human test: set E-Moove `exchangeRateMode: auto` on profile.

**Phase 1 shipped in repo:** Excel import script, `LebanesePcgCoaPanel` (Code | Name | ArabicNa | M | Cur), Accounting COA tab shows PCG tree when `accountingMode=lebanese`.

**E-Moove:** GL backup preserved; Balance Sheet totals must stay identical through Phase 1 UI deploy.

## 2026-07-29 — Admin UI: Mercedes polish (CSS-only, zero logic risk)

**Goal:** Elevate admin/POS UX from generic Tailwind CRUD to obsidian enterprise surfaces — **no changes to Firebase, functions, hooks, or business logic.**

**Rollback:** Remove `data-admin-theme="obsidian"` from `AdminLayout` → instant revert to current light panels.

### Safe (tomorrow — ship first)

| Layer | Files | What changes |
|-------|-------|--------------|
| **Scope** | `AdminLayout.tsx` | Add `data-admin-theme="obsidian"` on root wrapper only |
| **Tokens** | `src/index.css` | CSS vars under `[data-admin-theme="obsidian"]` — zinc-950 bg, white/5 borders, soft ring glow |
| **Surfaces** | `src/lib/adminStyles.ts` | `adminPanelClass`, list items, section labels → obsidian layering |
| **Primitives** | `index.css` (scoped) | Input/table/button focus glow + row hover under admin scope |
| **Layout shell** | `AdminLayout.tsx` | Main area `bg-zinc-950`, footer darkened (className only) |
| **POS touch** | `AdminPos.tsx`, `PosPairing.tsx` | Larger tap targets via className only |

**Out of scope (needs logic — later sprint):** inline table edit, keyboard shortcuts, sparklines, AI structured cards, offline POS cache.

### Verify before deploy

1. `npm run build` — no TS errors
2. Smoke: Dashboard, Orders, Inventory, Finance embed, POS pairing — click through, no console errors
3. Public storefront `/` unchanged (admin scope only)
4. Mobile admin sidebar + hero still readable

**Status:** Implemented in repo (CSS + classNames only). Rollback: remove `data-admin-theme="obsidian"` from `AdminLayout`.
