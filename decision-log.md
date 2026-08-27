# Decision Log

> **Canonical decision log:** `~/Documents/grabio-platform-docs/Decision-Log/`  
> Mirror significant decisions there when closing a sprint.

## 2026-08-27 — Accounting AM fixes (locked defaults)

- Currency label **LBP** (never L£/LE); report amounts **full** digits; picker LBP | USD | both.
- SOA/GL: one account per page; posted Edit = reverse + new voucher (never mutate posted lines).
- Party subaccounts: client **4010001…** under **401** sales; supplier **5010001…** under **501** COGS (4-digit suffix).
- Deferred: 65-account COA audit until AM sends the account list.
- P&L: match AM print (Class 7, B.I/Purchases/E.I, expenses, difference of exchange). LBP, 3 decimals, parentheses.

## 2026-08-22 — V·Purchase + V·Expense (manual entry like V·POS)

**Shipped (code):** Fullscreen quick entry matching V·POS patterns.
- `/admin/v-purchase` — tap materials, supplier chips, cart, Save; Scan optional
- `/admin/v-expense` — amount keypad, category tiles, Save; Scan optional
- Daily Ops: **V·Buy** / **V·Exp**; Purchases/Expenses pages link to Quick buy / Quick expense

**Deploy:** hosting (and already-live api unchanged for this UX).

## 2026-08-22 — OCR receipt scan → Purchase / Expense (LOCKED A — implementing)

**Locked**
- Engine: **A Google Cloud Vision** (server `POST /ocr/receipt`)
- Image: **not saved** — base64 in request only, discarded after OCR
- Confirm UI before save; ambiguous → user picks (v1: destination locked by page — Purchases page → purchase, Expenses → expense; OCR still suggests type)
- Shared module: `src/features/ocr/*` + `functions/src/api/ocrReceipt.ts`

**Deploy note:** Enable **Cloud Vision API** on GCP project `market-flow-7b074` and grant the Functions runtime SA `roles/vision.user` (or Cloud Vision access). Then `firebase deploy --only functions:api,hosting`.

**Status:** Vision API **ENABLED**; `functions:api` + hosting **deployed** 2026-08-22. Hard-refresh admin; smoke Scan receipt on phone.

## 2026-08-22 — Grabio store events Phase 3 (pricing + reservations)

**Shipped:**
- Server-side event discount enforcement on `POST /pos/orders` when `discountEnabled`
- Entry fee enforcement: unpaid tickets block link to POS sale; optional `includeEventEntryFee` on order
- Event reservations: `eventReservations` subcollection + merged calendar tab
- Orders admin shows Event badge, ticket #, guest name

**Deploy:** `firebase deploy --only functions:api,firestore:rules,firestore:indexes,hosting`

**Still open:** Windows POS UI for ticket lookup/pricing; free-drink package enforcement.

## 2026-08-22 — Grabio store events Phase 2 (tickets + admin UI)

**Shipped:**
- Admin UI: `/admin/events` — calendar, list, create/edit, set active, issue tickets
- Tickets: `stores/{storeId}/storeEvents/{eventId}/eventTickets/{ticketId}` with auto `# T-0001` numbers
- Settings flags: entry fee, discount, require guest name, link tickets↔sales, reservations (stored; pricing still not enforced)
- POS: `GET /pos/event-tickets`, `GET /pos/event-tickets/sync`, `POST /pos/event-tickets/link`
- `POST /pos/orders` accepts `eventTicketId` — links guest name/ticket to sale

**Deploy:** `firebase deploy --only functions:api,firestore:rules,hosting`

**Phase 3 (not started):** enforce entry fee + event discount on totals; full reservations merge; Windows POS UI for ticket lookup.

## 2026-08-22 — Grabio store events + POS sync (v1 backend)

**Scope:** Event CRUD, active event pointer, POS pull sync, online-order polling, event-tagged POS sales. Pricing rules stored but not enforced.

**Firestore:**
- `stores/{storeId}/storeEvents/{eventId}`
- `stores/{storeId}/posSettings/activeEvent`
- `orders/{orderId}` optional: `isEventSale`, `eventId`, `eventName`, `eventSnapshot`

**API (Bearer owner auth unless noted):**
- `POST/GET /store/events`, `GET/PATCH /store/events/:eventId`, `POST /store/events/:eventId/cancel`
- `GET/PUT/DELETE /store/events/active`
- `GET /pos/events?since=`, `GET /pos/active-event`, `GET /pos/online-orders?since=` (device token auth)
- `POST /pos/orders` accepts optional event fields

**Not in v1:** POS PATCH active event, percent/entry/free-drink enforcement, FCM to POS.

**Deploy:** `firebase deploy --only functions:api,firestore:rules` after staging checks — **no prod until Anwar approves.**

**Next:** Linux Grabio builder Events UI (calendar/list/form); Windows POS event tagging after endpoint verification.

## 2026-08-21 — Grabio Guide agent (Cursor API)

**Shipped in repo:**
- `POST /agent/guide` — onboarding specialist for store setup, features, and package choice
- Cursor Cloud Agents API with **composer-2.5-fast** only (`functions/src/lib/cursorCloudAgent.ts`)
- Tenant-scoped context + guardrails (`functions/src/lib/grabioGuideKnowledge.ts`, `functions/src/api/grabioGuide.ts`)
- Knowledge doc: `docs/grabio-guide-knowledge.md`

**Deploy:** `firebase deploy --only functions:api` (requires `CURSOR_API_KEY` on Cloud Functions — see `.credentials.md` / `SEO pending/cursor`)

**Module gate:** `ai_agent` on store profile. UI still "Coming soon" — API-first; wire frontend next.

**Credit controls (2026-08-21):** Off-topic prompts blocked locally (no Cursor call). Compact knowledge prompt. Max 4 history turns. 40 guide calls/store/day. Responses capped ~180 words in system rules.

## 2026-08-21 — Grabio SEO Phase 9: Link Building Tracker

**Shipped in repo:**
- `/admin/seo-links` — prospect pipeline, acquired links log, monthly target progress bar, dead link recheck, CSV export
- Cloud Function `POST /seo/check-link` (HTTP status via server-side HEAD/GET)
- Firestore: `seo_link_prospects`, `seo_links_acquired`, `seo_links_settings`
- Dashboard nav: **SEO Links**

**Deploy:** `firebase deploy --only hosting,firestore:rules,functions:api`

**Status:** All 9 phases of `plan-seo.md` admin modules are now implemented.

## 2026-08-21 — Grabio SEO Phase 8: Programmatic SEO Engine

**Shipped in repo:**
- `/admin/seo-programmatic` — templates, seed data, batch generator, publish queue, dead page scan, volume vs target, sitemap snippet export
- Public route `/pages/:slug` renders published programmatic pages from Firestore
- Firestore: `seo_prog_templates`, `seo_prog_seeds`, `seo_prog_settings`, `seo_prog_pages`
- Dashboard nav: **SEO Programmatic**

**Deploy:** `firebase deploy --only hosting,firestore:rules`

**Next:** Phase 9 link building tracker (`/admin/seo-links`)

## 2026-08-21 — Grabio SEO Phase 7: GEO Module

**Shipped in repo:**
- `/admin/seo-geo` — per-city metrics (Beirut/Tripoli/Sidon/Other), LocalBusiness JSON-LD generator, NAP consistency panel, citation tracker, GBP checklist, entity SEO flags
- Firestore: `seo_geo/config`, `seo_geo_cities`, `seo_geo_citations`, `seo_geo_nap_comparisons`
- Dashboard nav: **SEO GEO**

**Deploy:** `firebase deploy --only hosting,firestore:rules`

**Next:** Phase 8 programmatic SEO (`/admin/seo-programmatic`)

## 2026-08-21 — Grabio SEO Phase 6: AEO Module

**Shipped in repo:**
- `/admin/seo-aeo` — FAQ bank CRUD, FAQPage JSON-LD generator (copy), Phase 3 content AEO checklist, AI citation log, featured snippet tracker, JSON-LD validator
- Firestore: `seo_aeo_faqs`, `seo_aeo_citations`, `seo_aeo_snippets`
- Cloud Function `POST /seo/validate-schema` (server-side fetch + JSON-LD parse)
- Dashboard nav: **SEO AEO**

**Deploy:** `firebase deploy --only hosting,firestore:rules,functions`

**Next:** Phase 7 GEO module (`/admin/seo-geo`)

## 2026-08-21 — Grabio SEO Phase 5: Competitor Gap Engine

**Shipped in repo:**
- `/admin/seo-competitors` — competitor CRUD, paste keyword gaps, gap table with status (new / added / rejected)
- One-click **Add to keywords** → Phase 1 with `keywordOrigin: competitor`
- Compares pasted keywords against existing keyword engine; skips duplicates
- SerpAPI stub hook in `seoCompetitors.ts` for future auto-fetch
- Firestore: `seo_competitors`, `seo_competitor_gaps`
- Dashboard nav: **SEO Competitors**

**Deploy:** `firebase deploy --only hosting,firestore:rules`

**Next:** Phase 6 AEO module (`/admin/seo-aeo`)

## 2026-08-21 — Grabio SEO Phase 4: Reporting Dashboard

**Shipped in repo:**
- Enhanced `/admin/seo-analytics` — Keywords, Technical, Content, MoM Trends tabs
- Pulls Phase 1–3 data: rankings, intent breakdown, CWV snapshot, content pipeline
- Manual monthly organic target (Firestore `seo_reporting/settings`)
- **Export PDF** — browser print one-page summary (traffic, keywords, content, 404s, health)

**Deploy:** `firebase deploy --only hosting,firestore:rules`

**Note:** AI drafts (Phase 3) can be wired to Cursor API when ready — replace `/seo/content-draft` caller in `seoContent.ts`.

**Next:** Phase 5 competitor gap engine (`/admin/seo-competitors`)

## 2026-08-21 — Grabio SEO Phase 3: Content Engine

**Shipped in repo:**
- `/admin/seo-content` — content calendar, pillar/cluster map, gap alerts (&lt;5 cluster articles), on-page checklist, AI draft, copy + HTML export
- Firestore `seo_content` + admin-only rules
- Cloud Function `POST /seo/content-draft` (platform admin + `OPENAI_API_KEY`)
- Dashboard nav: **SEO Content**

**Deploy:** `firebase deploy --only hosting,firestore:rules,functions`

**Owner follow-up:** Ensure `OPENAI_API_KEY` is set on Cloud Functions for AI drafts; link content items to Phase 1 keywords.

**Next:** Phase 4 reporting completion (`/admin/seo-analytics` enhancements)

## 2026-08-21 — Grabio SEO Phase 2: Technical Health Monitor

**Shipped in repo:**
- `/admin/seo-technical` — health score, broken 404 list with fix/redirect status, PageSpeed CWV table, redirect chain log, GSC sitemap + URL inspection
- `src/lib/seoTechnical.ts` + Firestore `seo_technical`, `seo_broken_links`
- `scripts/seo-audit-upload.mjs` (root) — adds `top_404_urls` to `seo_audits/grabio_space`
- Dashboard nav: **SEO Technical**

**Deploy:** `firebase deploy --only hosting,firestore:rules`

**Owner follow-up:** Run `node scripts/seo-audit-upload.mjs` on VPS cron; add `VITE_PAGESPEED_API_KEY` for automated CWV checks; connect GSC on SEO Audit page before using inspection tab.

**Next:** Phase 3 content engine (`/admin/seo-content`)

## 2026-08-21 — Grabio SEO Phase 1: Keyword Engine

**Shipped in repo:**
- `/admin/seo-keywords` — CRUD, filters, sort, CSV import/export, priority flag (KD &lt; 40, vol 1k–10k)
- Firestore collection `seo_keywords` + admin-only rules
- Seed button loads software pillar keywords from `/solutions` data
- Dashboard nav: **SEO Keywords**

**Deploy:** `firebase deploy --only hosting,firestore:rules`

**Next:** Phase 2 technical health monitor (`/admin/seo-technical`)

## 2026-08-01 — Grabio SEO pivot: software pillars + AEO + social tracking

**Decision:** Continue Grabio SEO (not GJ Properties) with **software-first** positioning — inventory, accounting/GL, POS, mobile apps, CRM/PSA, restaurant, manufacturing, AI. Storefront/template builder is secondary (`/solutions/platform` only).

**Shipped in repo:**
- `/solutions` index + 9 pillar pages with FAQPage + Organization + SoftwareApplication JSON-LD
- `public/llms.txt` for AI research crawlers; `robots.txt` allows GPTBot, ClaudeBot, PerplexityBot, etc.
- GTM helper (`VITE_GTM_ID`) + marketing dataLayer events on solution CTAs
- Sitemap updated; nav adds **Solutions**
- Env placeholders: `VITE_META_PIXEL_ID`, `VITE_GA4_ID`, `VITE_GTM_ID`

**Blocked on owner:** Create Meta Pixel + GA4 + GTM in Business Manager / Google Analytics; paste IDs into production `.env` and deploy. Submit sitemap in GSC after deploy.

**Next:** Blog clusters per pillar; keyword engine admin (plan-seo Phase 1); Google Business Profile + Ads account registration.

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

## 2026-07-30 — Full accounting engine (Phases 1–6)

**Decision:** Ship Omega/Dolphin-class ERP features on Firestore (not SQL), pilot Emoove `EZfuoNQFTJVU4cubNuckpp4K7zw2` first.

**Shipped:**
- Phase 1: `voucherLineSettlements`, PV/RV knock-off modal, unified Party SOA tab
- Phase 2: Line FX fields + cost center per JV line; AR/AP FX reval expansion
- Phase 3: Draft/post workflow, storno reversal, `ledgerAuditLog`, block delete on posted
- Phase 4: TB 2/4/6-col, GL report tab, R10/CNSS tax exports, CSV pack
- Phase 5: Year-end wizard checklist, `runRecurringVouchers` scheduler, check clear/void UI
- Phase 6: Keyboard JV entry, bulk CSV → draft import

**Verify (Emoove):** `verifyPaymentKnockOffE2E`, `verifyVoucherDraftPostE2E` PASS. Little Hands read-only: `verifyLittleHandsReadOnlyGate.cjs`.

**Git (2026-07-30):** Commit on `main` pushed to `ecosystem/main` after stripping OAuth text from historical `.gitignore` (commit `c9d3867`). No credential rotation required.

**Little Hands gate (2026-07-30):** Fresh backup `backups/emoove-lebanese-pre-8WgfKtgaE8aAXdqFhIfweEo5WFq2-2026-07-30T20-55-25-620Z` (588 accounts, 2056 posted JEs). Read-only verify PASS (TB $35,520.32 balanced). AR aging + cash flow PASS (`--store-id=8WgfKtgaE8aAXdqFhIfweEo5WFq2`). `verifyTrialBalance6ColE2E` fixed (vitest). **Blocked:** `ClientCode` column empty in `imports/littlehands-pcg-client-accounts.template.csv` — owner must fill before `seedLittleHandsPcgClientAccounts.cjs --apply`.

**Little Hands complete (2026-07-31):** PCG client codes seeded (18 rows, pattern `53001000001`… until owner replaces with legacy ERP codes). `verifyLittleHandsAccountingSuite.cjs` PASS. Deployed hosting + rules. Polish: GL drill-down (P&L/TB → GL → voucher), XLSX exports, `pending_approval` JV workflow.

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
