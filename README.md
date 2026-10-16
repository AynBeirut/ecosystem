# Market Flow - Grabio Space

**Modern Multi-Vendor Marketplace Platform**

> **Docs:** Canonical platform documentation is in the Obsidian vault `~/Documents/grabio-platform-docs/` (architecture, backlog, deploy protocol, gotchas). Code-repo `backlog.md` is legacy.

**Developer landing map:** `~/Documents/grabio-platform-docs/Architecture/Developer-Landing-Map.md`.

**Product pivot:** Grabio is now focused on fine-dining restaurant daily operations plus CRM. Canonical map: `~/Documents/grabio-platform-docs/Architecture/Fine-Dining-Platform-Map.md`.

**No-risk runbook for 2026-09-11 accounting setup:** `~/Documents/grabio-platform-docs/Runbooks/Client-Accounting-Setup-No-Risk.md`.

## Git — dual push (required)

**Every code or doc update must be pushed to both GitHub accounts** (primary + backup). Never leave one mirror behind.

| What | Primary (`AynBeirut`) | Backup (`a-nooor`) | Git remote |
|------|----------------------|-------------------|------------|
| Main / ecosystem code | `ecosystem` | `backup` | this repo (`grabio space`) |
| Platform docs | `origin` | `backup` | `~/Documents/grabio-platform-docs` |

```bash
# Code (from grabio space, branch main)
git push ecosystem main && gh auth switch -u a-nooor && git push backup main && gh auth switch -u AynBeirut

# Docs (from grabio-platform-docs)
git push origin main && gh auth switch -u a-nooor && git push backup main && gh auth switch -u AynBeirut
```

Do not commit `.env.production`, credentials, or local backup folders.

**GCP session (agents):** Before any `gcloud`/Indexing/GSC work, set project **`market-flow-7b074`** (default `gcloud` config often points at `gj-real-estate-346907`). Full checklist: [`docs/deployment/GCP-SESSION.md`](docs/deployment/GCP-SESSION.md).

### Session 2026-09-28 — Online table reservations
**Problem:** The store page table form only sent an email. **Method:** Style 11 now writes a store-scoped table reservation (guest, date, time, party). Admin Reservations lists them and can confirm, seat, or cancel by table name. Event tickets were not changed. **Result:** Staging https://market-flow-7b074--staging-qj6e98fx.web.app (`index-Dn3Aakhr.js`). Live hosting was not released. **Handoff:** `docs/handoff/online-table-reservations-2026-09-28.md`.

### Session 2026-09-28 — Venue Ops reference fields
**Problem:** Venue Ops was a generic form, so it could not be called complete. **Method:** Screens now follow the reference documents: allergen columns, bible meaning and description, cocktail or batch specs, briefing buzz words, seat numbers, and standards checklists. **Result:** Staging https://market-flow-7b074--staging-qj6e98fx.web.app (`index-DzstbxAn.js`). A dish row saved with gluten, sesame, and the cross-contamination marker. Live hosting was not released. **Handoff:** `docs/handoff/hr-venue-ops-builder-roadmap-2026-09-28.md`.

### Session 2026-09-28 — HR and Venue Ops on staging
**Problem:** Phases 1–5 were local, the reports tab crashed, and import had no preview. **Method:** Published the admin app to the staging channel. Released the store-scoped HR and venue collection rules. Import preview maps a spreadsheet and does not save. Reports now count training assignments. **Result:** Staging https://market-flow-7b074--staging-qj6e98fx.web.app . Live hosting was not released. E-Moove test rows were written on that test store. **Handoff:** `docs/handoff/hr-venue-ops-staging-2026-09-28.md`.

### Session 2026-09-28 — Optional HR and Venue Ops bridges
**Problem:** Payroll, inventory, reservations, and CRM links could show even when those modules are off. **Method:** Phase 5 bridges only. Links appear when the matching gate passes. No payroll or stock posting. **Result:** Local only. Not published. **Handoff:** `docs/handoff/hr-venue-ops-phase5-bridges-2026-09-28.md`. **Next:** Phase 6 waits for Anwar to name a store and approve a preview import.

### Session 2026-09-28 — HR schedule, notes, assets, reports
**Problem:** Schedule, notes, assets, and reports were empty tabs. **Method:** Store-scoped `hrSchedules`, `hrNotes`, and `hrAssets`. Notes stay on the owner/manager gate. Report counts use the same records. Payroll screens were not rewritten. **Result:** Local only. Not published. **Handoff:** `docs/handoff/hr-advanced-2026-09-28.md`.

### Session 2026-09-28 — Venue Ops add/edit
**Problem:** Venue Ops could add cards but not edit them, and several required fields were missing. **Method:** Same store collections. Allergen, menu bible, spec, and briefing now add and edit. No price or stock. **Result:** Local only. Not published. Previous staging bundle does not include this pass. **Handoff:** `docs/handoff/venue-ops-actions-2026-09-28.md`.

### Session 2026-09-28 — HR actions (not placeholders)
**Problem:** HR could add records but could not edit an employee, approve leave, or complete training. **Method:** Same `staff` and HR collections. Edit writes no salary. Leave decision and training completion are status updates. Dashboard counts active employees, pending leave, overdue training, and expiring documents. **Result:** Staging hosting only: https://market-flow-7b074--staging-qj6e98fx.web.app (`index-ryGUiGT_.js`). Live hosting and Firestore rules were not released. **Handoff:** `docs/handoff/hr-core-actions-2026-09-28.md`.

### Session 2026-09-28 — Venue Ops core (phase 3)
**Problem:** `/admin/venue-ops` was a shell with no allergen, menu, spec, briefing, floor, or standard records. **Method:** Store-scoped writes on `venueKnowledgeItems`, `venueBriefings`, `venueFloorMaps`, `venueStandards`. No price or stock. Cashiers can open the hub; managers edit. HR training link stays behind the HR gate. **Result:** Local only. Not deployed. Venue rules are still local, so saves fail permissions until a later rules release. **Handoff:** `docs/handoff/venue-ops-phase3-2026-09-28.md`. **Next:** Anwar tests on his own store with Venue operations on.

### Session 2026-09-28 — Official HR core (phase 2)
**Problem:** `/admin/hr` was a shell with no employee, leave, training, or document records. **Method:** Reuse `staff` (no wage, `payrollExcluded`), keep `staffPresence` and payroll screens, add store-scoped leave/training/document writes. **Result:** Local only. Not deployed. HR collection rules are still local, so leave/training/documents fail permissions until a later rules release. Employee directory uses `staff`, which already allows a store admin. **Handoff:** `docs/handoff/hr-core-phase2-2026-09-28.md`. **Next:** Anwar tests on his own store with Official HR on.

### Session 2026-09-27 — HR + Venue Ops phase 1 shells
**Problem:** Official HR and Venue Ops had no shared gates or admin shells, and payroll was mixed into finance paths. **Method:** Phase 1 only — store toggles, `/admin/hr` and `/admin/venue-ops` shells, nav and route gates, Firestore rule skeleton, focused gate tests. Finance and inventory stay optional. **Result:** Staging hosting only: https://market-flow-7b074--staging-qj6e98fx.web.app (`index-BppWzMzj.js`). Live hosting, functions, and Firestore rules were not released. **Handoff:** `docs/handoff/hr-venue-ops-phase1-2026-09-27.md`. **Next:** Anwar tests the shells, then Phase 2 in a new chat.

### Session 2026-10-09 — Staff pay + hourly rate
**Problem:** Mark as paid showed “Missing or insufficient permissions.” Nancy’s hourly rate saved as 4 and reloaded as 3. **Method:** Rules allow the missing salary-payment check. Excel stays the rate until a UI edit sets `hourlyRateSource: ui`. **Result:** Hosting and Firestore rules deployed. Live main bundle `index-CFrPqPPT.js`. Hard-refresh. September pay must use month 2026-09.

### Session 2026-09-30 — JV preview blocked
**Problem:** Preview JV did nothing on a balanced Little Hands voucher. **Method:** Auto reference passed the year into the date-serial helper, so every 2026 JV peeked `JV-2026-01-01-000001` and the duplicate check stopped the sheet. **Result:** Reference now follows the voucher date (`JV-YYYY-MM-DD-######`). Unit tests passed. Hosting deployed. Live main bundle `index-Bx5LRva6.js`. Hard-refresh.

### Session 2026-09-25 — Little Hands purchases / POS handoff (new chat)
**Context:** PO numbering, delivery COA 653, supplier PO dropdown (cash-book filter + Spinneys 23 Sep), POS sync gaps post migration. **Handoff (paste into new chat):** `docs/handoff/littlehands-purchases-pos-handoff-2026-09-25.md`. **POS checklist:** `docs/handoff/littlehands-pos-sync-fix-2026-09-20.md`. **Spinneys evidence:** `reporting/data/littlehands-supplier-spynes-live-2026-09-23.json`.

### Session 2026-09-25 — Invoice Manager edit + store currency
**Problem:** Invoice Manager purchase list had no Edit, and document forms listed every world currency. **Method:** Purchase-style row (Edit under the name) on invoices, quotations, receipts, expenses, and products. Currency is store main, plus secondary only when store setup has one. **Result:** Live and staging both serve `index-DAqUWas3.js`. Little Hands is USD + LBP, rate 0. **Handoff:** `docs/handoff/invoice-manager-edit-currency-2026-09-25.md`. Not committed.

**Purchase currency (same day, live):** Document currency is one USD or LBP for the whole invoice or purchase. Totals show both. Hosting `index-D_CT-EGU.js` / invoice `index-khmikphs.js`. Hard-refresh. Not committed.

**Item search (live):** Product and material pickers rank names that start with the typed text first. Hosting `index-g9d8jiga.js` / invoice `index-WT_DLiee.js`. Hard-refresh. Not committed.

**Line total + statement currency (live):** Purchase line total follows the document currency. Statement Currency select is on the statement: USD, LBP, or both. Hosting `index-Czm-gT56.js`. Hard-refresh. Not committed.

**POS voids (live API):** `POST /pos/voids` cancels the existing sale by `localSaleId` and blocks reuse. ORD-000182 (laptops, $1000) is cancelled. Evidence: `reporting/data/pos-void-ord-000182-2026-09-25.json`. Functions `api` only. Not committed.

**Purchase line type (live):** Create Purchase → Add Item type is Raw material, Item, or Expenses. Expense lines are not received into stock. Hosting `index-BuTDXak_.js`. Hard-refresh. Not committed.

**Purchase draft (live):** Create Purchase is kept in that browser for 7 days and reopens after a refresh. It is not in the database until Create. A form lost before this deploy cannot be restored. Hosting `index-DZMx0tCw.js`. Hard-refresh. **New chat:** `docs/handoff/purchases-currency-pos-handoff-2026-09-27.md`. Not committed.

### Session 2026-09-20 — Little Hands POS sync + doc migration (tonight)
**Migration:** Store doc numbers → `PO/ORD/EXP-000001` (Little Hands write done). **POS not updated:** refunds/voids/delete unsynced, `localSaleId` reuse overwrites cloud, dated ORD from POS vs migrated ORD-00000N, gross today total on POS, menu/raw material push, purchase `paidAmount` field gap. **Handoff (POS fix checklist):** `docs/handoff/littlehands-pos-sync-fix-2026-09-20.md`. **Decision:** `decision-log.md` 2026-09-20 POS + sequential numbers.

### Session 2026-09-19 — Anwar invoice/quotation handoff
Invoice template/numbering attempts stopped by owner; two records moved to draft quotations. Handoff: `docs/handoff/anwar-invoice-template-quotation-handoff-2026-09-19.md`. Evidence: `reporting/data/anwar-move-invoice-order-to-quotations-2026-09-19.json`.

### Session 2026-09-22 — Invoice Manager phone template
**Problem:** The phone was on Play build 1.2.45 (full app). The workspace shell was a thin app and must not be installed. **Method:** Restored the 16 Sep untracked screens into `grabio-invoice-mobile`, kept the shell navigator/services, and wired Settings to the 10-template preview. **Result:** Phone upgraded in place to 1.2.51 (55), package `space.grabio.finance`. Backup: `grabio-invoice-mobile/release/phone-backup-2026-09-22/phone-before-1.2.51-was-1.2.45.apk`. **Next:** Phone is on **1.2.62 (66)**. Client list has Edit and Delete. Thumbnail scale fix is in this build. Daily tasks rules are deployed. Expense currency follows store currencies. Purchase list includes store purchases. Clients can be deleted. New products require raw material, item, or service. Invoice header can hide the business name and place address/website in the header or footer. Daily tasks rules for `invoiceTeamTasks` are deployed. Staff client delete is deployed with the same rules. Do not install `invoice-1.2.46` through `1.2.50`.

### Session 2026-09-19 — Estimate edit persistence
**Problem:** New estimates appeared in the app/browser, but edits from the web Estimate Manager did not reload elsewhere because `updateEstimate` showed success without awaiting Firestore and estimate tax/discount/total fields were not fully mapped for Firestore patches. **Fix:** Estimate edits now await Firestore, rollback on failed save, and persist/read `subtotal`, `tax`, `taxAmount`, `discount`, and `total`. **Verify/deploy:** `npm run build` exit 0; `firebase deploy --only hosting` exit 0; live `https://grabio.space` returned HTTP 200.

### Session 2026-09-19 — Invoice Manager web PDF branding
**Problem:** Mobile invoice PDF used E-Service branding, but web Invoice Manager PDF rendered Grabio because PDF export prioritized `organization.name` from Store Profile over refreshed invoice document settings.

**Fix:** Web PDF generation now prefers `financeDocumentSettings` company fields (`documentCompanyName`, logo, address, tax/template via `storeProfileToCompany`) over Store Profile branding; organization fields are fallback only. Share/file PDF path refreshes company settings before generating. Root A4 order invoices and purchase-order PDFs now use the same invoice-template helper; Store Profile template/name/logo are fallback only.

**Verify/deploy:** `npm run build --prefix vendor/beirut-finance-flow-main` exit 0; full `npm run build` exit 0 after both branding passes; `firebase deploy --only hosting` exit 0 twice. Live `https://grabio.space` returned HTTP 200 after first deploy. Existing Vite warnings only (CSS import order, chunk size/dynamic import).

### Session 2026-09-18 — Little Hands Class 7 cash-book alignment
**Sales SOT changed:** `/media/anwar/12AD-9999/Cash` workbooks are source of truth for Little Hands P&L Class 7. Mapping: B description, C sales, D expenses, E birthday DP expenses, F Sanaa treasury, G incoming DP, H running total. Script `scripts/alignLittleHandsCashBookSalesToGl.cjs` posts idempotent GL alignment JEs (`cashbook_sales:{YYYY-MM}:class7-align`). **Verified:** Dec 2025–Sep 2026 GL Class 7 equals cash-book column C; evidence `reporting/data/littlehands-cashbook-sales-class7-align-2026-09-18.json`. USB copied to `reporting/data/littlehands-usb-staging/2026-09-18-cash-audit/`.

### Session 2026-09-18 — Owner discount true-up (Sanaa/Sara backup)
User confirmed owner backups `/media/anwar/12AD-9999/Sanaa .xlsx` and `/media/anwar/12AD-9999/Sara.xlsx` as source for missed discount rows. Added `scripts/repairLittleHandsOwnerDiscountTrueUp.cjs` to compare owner-sheet discount deltas vs posted GL and add only missing amounts (idempotent). Unpaid marker row (`529.9 unpaid`) is excluded. Posted missing discount true-up (Dr 7090 / Cr 401): Dec 2025 **103.40**, Jan 2026 **408.38**, Feb 2026 **59.49**, Mar 2026 **157.41**. Evidence: `reporting/data/littlehands-owner-discount-trueup-2026-09-18.json`.

### Session 2026-09-13 — Little Hands production data (cash book)
**SOT:** `Final Data Expenses/*.xlsx` → `littlehands-cash-book-organized-2026-09-13.json` (classifier fix: payroll/social before POS vendor map). **Firestore:** `financeExpenses` **761** lines · Purchases UI **512** supplier lines only (payroll/social/insurance not on Purchases). **Gate:** `reporting/data/littlehands-production-data-gate-2026-09-13.json`.
**USB local mirror:** `reporting/data/littlehands-usb-staging/Final-Data-Expenses/` (9 workbooks) · fresh export `littlehands-cash-expenses-export-2026-09-13.json` (**$57,601.66**). **Payroll:** master *Monthly Sales & Expenses* col **D** = **$31,665** (`littlehands-payroll-cashbook-vs-master-2026-09-13.json`); cash-book wage lines classified **$11,756** — not the same bucket as col D.

### Session 2026-09-15 — Product center (locked tiers)
**Active core:** live_kitchen / venue ops / CRM. **Optional maturity:** accounting + inventory + recipe/production. **High-end connected:** builder/template/SEO. **Maintained:** shop + factory (not dropped). **Deferred:** NGO/freelancer/mini shop. Details: `architecture.md`, `decision-log.md`.

**Execution:** Slices A–D + marketing pivot + Store Profile venue ops + ops readiness on Grabio Platform. **Resolver slice:** `effectiveStoreContext.ts` + readiness continue links — `reporting/data/resolver-setup-readiness-2026-09-15.json`. **Mobile 1.3.9 (140)** built; links smoke-tested OK; sidebar/toggle verify **pending**. Play: `docs/handoff/play-upload-1.3.9-140.md`. Handoff: `docs/handoff/builder-finish-resolver-setup-readiness-2026-09-15.md`.

### Session 2026-09-17 — NIPCO / Little Hands sub-account correction
**Fault fixed:** NIPCO active sub-accounts must be Hadi `h.akalfouni@nip-lb.com` and Jihan `j.sayegh@nip-lb.com` as sales managers only. `manager@grabio.space` and Ahmad `ahmadshaheen78@gmail.com` belong to Little Hands context, not NIPCO. Wrong NIPCO sub-accounts were archived/removed; Ahmad is rebound to Little Hands `accounting` sub-account `PhG34sQUjSDNNdYBXWWc`; `manager@grabio.space` remains Little Hands manager. **Map:** `docs/handoff/nipco-account-subaccount-map-2026-09-17.md`. **Evidence:** `reporting/data/nipco-littlehands-subaccount-correction-2026-09-17.json`.

### Session 2026-09-14 — Platform + POS fix backlog (manager mobile)
**Root cause:** Play mobile **1.3.5** `ownerAccess.ts` owner-only; web uses `hasStoreAdminAccess()`. **Not** Firestore/cache. **Client fix:** Play update ≥140, no sideload. **POS:** Windows POS local RBAC ≠ Firebase subAccounts. **Full list:** `reporting/data/platform-pos-discovered-fixes-2026-09-14.md`.
**Builder execution prompt (current):** `docs/handoff/builder-start-main-structure-fine-dining-2026-09-15.md` (supersedes `builder-main-structure-fix-prompt-2026-09-14.md`).

### Session 2026-09-13 — HANDOFF (verify on Anwar device/browser)
**Agent:** Stock & Catalog sidebar now has Expenses + Quick expense (`AdminDashboard`, `useAdminNavigation`); hosting deployed `hosting:production`; mobile APK **1.3.9 (140)** + `tenantMismatchGuard` sign-out on wrong store. **Anwar must verify** before closing. Handoff: [`reporting/data/HANDOFF-littlehands-expense-tiles-tenant-2026-09-13.md`](reporting/data/HANDOFF-littlehands-expense-tiles-tenant-2026-09-13.md).

### Session 2026-09-13 — Little Hands tenant + Stock expense tiles (agent attempt — not accepted)
**Problem:** Web Stock & Catalog missing Expenses / Quick expense tiles; mobile `manager@grabio.space` still showed NIPCO after cache clear.
**Fix:** `AdminInventory` expense tiles for all store admins/inventory managers (no invoice module gate); web `AuthContext` + `storeUtils` server-first tenant bind (`users.subAccountId` → `subAccounts`, `storeId` before `activeStoreId`); mobile server-first subAccount + login re-bind. **Evidence:** `reporting/data/littlehands-tenant-auth-2026-09-13.json`. **Mobile:** ship new `grabio-mobile` APK (code fix alone is not enough on device).

**Catalog feed:** `reporting/data/grabio-meta-catalog-packages-2026-09-12.csv` now points package/add-on rows to branded 1080x1080 PNG icons under `public/meta-catalog/icons/`, using the same emoji-style UI icon language from `src/lib/pricingDisplay.ts`. Public Meta feed URL: `https://grabio.space/meta-catalog/grabio-packages-feed.csv`; icon URLs use `https://grabio.space/meta-catalog/icons/<item_group_id>.png`.

### Session 2026-09-12 — Little Hands POS vs Excel master
**Source of truth:** `Monthly Sales & Expenses .xls` col B · backup `reporting/data/backups/2026-09-12/`. **Firestore updated:** Corine **$2,500**, Natacha **$550**, Mila **$1,000**. **Map:** `reporting/data/littlehands-monthly-master-map-2026-09-12.json`. **May ~−$31 / Apr ~−$229** vs master; **Jun+Jul Pamela net ~$0**; **Dec/Jan/Mar** still POS-low vs master (Excel backfill pending). USB: `POS-DATA-ONLY-20260912/` + sqlite snapshot.

**GitHub secret scanning:** Firebase `apiKey` in `google-services.json` / `GoogleService-Info.plist` are **public client IDs** (required for mobile builds). In GitHub → Security → Secret scanning → mark as *used in tests* / resolved. Restrict keys in [Firebase Console → API keys](https://console.cloud.google.com/apis/credentials). Server keys (`FIREBASE_TOKEN`, `OPENAI_API_KEY`, etc.) stay in GitHub Secrets only.

**Payee map (Whish):** motor `76525269` · internet/router `76147541` (**$30/mo** recurring updated) · old owner `3281047` · current owner `3323903`.

## Platform change governance — client requests

Every new client request or setup discovery must be classified before code changes:

- **Global platform fix:** a bug or missing core behavior that should apply to every store.
- **Tenant option:** a behavior that some stores need and others may reject; implement as a setting with a safe default.
- **Account data setup:** seed/configure one store using existing settings; do not change shared code for only one account.
- **Temporary exception:** allowed only with a documented removal path and owner approval.

Canonical structure map: `~/Documents/grabio-platform-docs/Architecture/Packages-Workflows-Modules.md`.

Default rule: do not hardcode behavior for one client in shared web, POS, mobile, Functions, or Firestore rules. If a request changes UX, workflow, permissions, payment methods, order statuses, reservations, advance ordering, stock/accounting behavior, or customer-facing labels, model it as tenant configuration under the store profile/settings layer and keep web, POS, and mobile reading the same source of truth.

Product direction rule: new roadmap energy goes to fine-dining restaurant daily operations and CRM. NGO, freelancer, mini shop, and broad custom vertical expansion are deferred. Shop, manufacturing, builder, accounting, and inventory remain maintained for existing clients or optional restaurant maturity modules, not the primary growth push.

Setup rule: backend scripts, imports, and AI-assisted setup are starting methods only. Every store setup result must be visible in the admin UI, editable by the store user when allowed, and connected to the next setup step. If data setup requires Excel/product/recipe/cost/raw-material/sale-price input, the platform should evolve toward a guided UI flow: download template, upload file, validate preview, AI/setup agent correction, owner approval, then saved store data.

Future agents must update `README.md`, `architecture.md`, `decision-log.md`, and the canonical docs vault when introducing or changing platform options. Data scripts must write evidence under `reporting/data/` before any client-facing numbers or closure claims.

### Session 2026-09-18 — Little Hands Excel → GL/P&L repair
**Problem:** P&L was reading posted GL while the Excel/import source rows in `financeExpenses` were not fully represented as live-equivalent journals; old purchase receive entries also credited supplier detail expense accounts, creating negative G&A. **Fix:** `scripts/repairLittleHandsExcelSourceToGl.cjs` backfilled source rows into GL by route (supplier purchases → inventory/AP/cash; operating/cash expenses → G&A/cash; payroll → salaries/cash; assets/treasury off P&L), remapped old supplier purchase credits to AP 201, and changed future purchase posting to use AP. **Evidence:** `reporting/data/littlehands-pl-excel-live-repair-verify-2026-09-18.json`.

## Workspace organization and memory

Canonical policy: `~/Documents/grabio-platform-docs/Architecture/Workspace-Organization-Policy.md`.

Do not move, quarantine, archive, or delete workspace files without inventory first. The workspace includes main platform code, apps, vendor copies, backup structures, client data, reporting evidence, scripts, and docs. Future agents must document important planning decisions before implementation so chat memory is not the only source.

Quarantine rule: `_quarantine/YYYY-MM-DD/` requires a `MANIFEST.md` with original path, reason, moved date, review date, delete approval status, and restore notes. The 40-day rule means review eligibility only. No automatic deletion is allowed without explicit Anwar approval.

## Setup surface separation

Canonical review: `~/Documents/grabio-platform-docs/Architecture/Setup-Surface-Separation.md`.

Store Profile, Invoice Document setup, and Website Template setup must stay separated. Store Profile owns business identity and operational defaults; Invoice Document setup owns A4/PDF document branding and template style; Website Template setup owns storefront theme/layout. Invoice numbering currently remains in Store Profile and must be reviewed before the next setup refactor.

## Role, permission, and environment policy

Canonical policy: `~/Documents/grabio-platform-docs/Architecture/Role-Permission-Environment-Policy.md`.

Builder/accounting accounts, sub-account permissions, and environments are about 60% built but must become reusable platform rules. Do not patch one account to make builder or accounting access work. New role behavior must be a default role template, tenant option, or documented temporary exception, with web, Functions, mobile, POS, and invoice app enforcement considered.

### Session 2026-09-10 — SEO growth sprint (Phase 1)
**Problem:** `/demo/*` pages indexed manually but no organic visibility; homepage lacked category keywords; no comparison pages; `www`/apex split authority.

**Shipped (code):** Homepage meta + software-categories band; Shop `metaTitle`; 5 `/compare/*` pages (Square, TouchBistro, Katana, Shopify, Odoo); sitemap entries; vertical comparison links; `demo_start` tracking; Instagram/Facebook schema+footer; `WwwCanonicalRedirect`; fixed default `SEOHead` description.

**Also shipped:** Post-build prerender for `/demo/*` + `/compare/*` meta; **www→apex 301** (Hosting API); Indexing API enabled on `market-flow-7b074`. **Agent gotcha:** always `gcloud config set project market-flow-7b074` before IAM/API calls (`docs/deployment/GCP-SESSION.md`).

### Session 2026-09-10 — SEO Phase 2 technical cleanup
**Problem:** GSC showed only 16 indexed URLs and initially 0 submitted sitemaps for the apex property; dynamic sitemap/store/product SEO had canonical, thin-content, and reliability risks.

**Shipped:** Submitted `/sitemap.xml` in GSC (**Success**, 48 discovered pages); saved evidence in `reporting/data/grabio-gsc-indexing-baseline-2026-09-10.json`; split sitemap architecture into static index + `sitemap-static.xml` + dynamic child sitemap routes; removed `/login` and `/signup` from sitemap; changed `/marketplace` sitemap URL to `/search`; added route-level noindex for protected/utility paths and 404; fixed GSC default property to apex; added product-level SEO metadata support; added top-10 prerendered priority pages; added programmatic quality gates and authority checklist.

**Verify:** `npm run build --prefix functions`, focused SEO lint, and `npm run build` passed. **Deployed 2026-09-10:** `firebase deploy --only hosting,functions:api` to `market-flow-7b074` — live sitemap index + child sitemaps return HTTP 200. **Next:** resubmit sitemap index in GSC if discovered count lags, then weekly GSC evidence exports only.

### Session 2026-09-10 (evening) — Public demo preview + Internal Demo OS
**Problem:** Marketing CTAs pointed at demo store slugs that did not exist in Firestore; public preview only showed external storefront, not internal admin/dashboard.

**Shipped:** `/demo/:slug/app` + `/features/:moduleId/app` mock screen tours; `scripts/seedMarketingDemoStores.cjs` provisioned 5 marketing storefronts (`grabio-demo-*`); **Internal Demo OS** at `/demo-os` + `/demo-os/:moduleId` (12 read-only admin screens: dashboard, POS, orders, inventory, purchases, invoices, expenses, accounting, CRM, theme editor, AI); vertical tours at `/demo/:slug/os/:moduleId`; sitemap + prerender (+13 demo-os URLs, 48 SEO shells total).

**Deployed 2026-09-10:** `firebase deploy --only hosting` then `functions:api` — live: `https://grabio.space/demo-os`, `https://grabio.space/demo/shop/os/dashboard`. **Next:** Phase 2 demo-os pages (analytics, recipes, production, etc.); GSC re-check after crawl.

### Session 2026-09-09 (evening) — NIPCO + Little Hands + mobile marketplace
**Shipped (web/hosting + Firestore):** NIPCO marketplace `logoUrl` (white bg); Little Hands → **restaurant / `pkg_live_kitchen` / pro**; AdminProfile save fix (locked Lebanese accounting + store admin rules); NIPCO product icons **🤧** facial tissue (all 5 SKUs).

**Mobile (built, not required install today):** `grabio-mobile/release/grabio-1.3.6-137.apk` — marketplace product **emoji icons** (`icon` field) for Little Hands + Jinan's Kitchen. **Next app release must include:** `ProductVisual` + same icon logic; NIPCO icons already live on web via Firestore.

**Next:** ship mobile **1.3.7+** with product icon tiles; optional AdminProfile logo upload → Storage (`logoUrl`).

### Session 2026-09-09 — Builder workspace + demo WordPress staging
**Problem:** Builder forced classic templates on create; no demo delete; demo WP used production go-live path (client domain + email). VPS WP installs failed (SSH password auth off, broken install script, Apache down, self-signed SSL).

**Shipped (deployed hosting + functions + Firestore rules):**
- **Pricing:** `pkg_web_presence` Website & Blog $10/$100; custom domain included on website packages (removed $15 add-on).
- **Builder demos:** create picker (Classic \| Theme editor \| WordPress); soft-delete; tabs `classic|theme-editor|wordpress|products`.
- **Demo WordPress:** staging only `{slug}-{demoId8}.demo.grabio.online` — credentials in UI, no client domain/email go-live.
- **VPS:** `VPS_SSH_PRIVATE_KEY` + acme.sh ZeroSSL; Apache auto-start + cron watchdog; `combined.pem` = cert chain + private key.

**Store slug fix:** owner store `Av22LKyet8QmVcu9b8Njz1HVfoy1` → slug **`grabio`** → `https://grabio.grabio.space`.

**Handoff:** `docs/handoff/anwar-personal-account-2026-09-09.md`

**Next:** wildcard DNS `*.demo.grabio.online`; mobile admin rebuild for POS expiry badge; mirror docs to Obsidian vault.

### Session 2026-09-09 — Owner personal account (POS expiry test)
**Stock alerts:** `inventorySettings.lowStockAlertsEnabled: false` + `projectBasedInventory: true` on `Av22LKyet8QmVcu9b8Njz1HVfoy1` — scheduled FCM skips. Alert you saw = likely before toggle or stale push.

**POS expiry test:** `node scripts/setupAnwarPosExpiryTest.cjs --write` on **Barcode Scanner — Haixun F20 (2D)** — `expiryAlertDays: 1`, expiry tomorrow. Mobile POS shows `Expires in Nd` (rebuild admin app).

### Session 2026-09-07 — Owner personal wallet
**Model:** Personal work (Youssif/Ali electrical, Firas yoga, Wissam dev) → **personal wallet IN**; Whish company spends → **fed to company OUT**. Nicole yoga = inactive. **UI:** Business Finance → **Bank** → **Personal wallet (owner)**. Firas **$150** imported (`RV-2026-00047`). Report: `reporting/data/anwar-owner-personal-wallet-2026-09-07.json`. Script: `scripts/syncAnwarOwnerPersonalWallet.cjs`.

### Session 2026-09-07 — Owner service income (Whish)
**UI:** Business Finance → **Receivables** → **Service income (Whish)** — monthly Youssif / Wissam / Ali from `financeReceipts` (46 RVs, **$5,775**). Report: `reporting/data/anwar-owner-income-by-month-2026-09-07.json`. Script: `scripts/syncAnwarOwnerServiceIncome.cjs`. **Deploy hosting** to see new page in prod.

### Session 2026-09-07 — Whish statement import (E-Service)
**Source:** `Downloads/balancestatement.zip` → `AccountStatementCSV_20535449.csv` (Whish #20535449, Jan–Sep 2026). **Imported:** 45 RVs — Youssif Malek **$2,595** (electrical), Wissam Mansour **$2,700** (web/app); 2 rent PVs **$1,000** (+9613323903). **Not imported:** motor/EDL/water/municipality/internet/building (no clear bank labels). Reports: `reporting/data/anwar-whish-import-2026-09-07.json`, `anwar-whish-statement-parsed-2026-09-07.json`. **Fix:** period reopen now allows historical posts.

### Session 2026-09-07 — Anwar personal finance setup
**Clients:** Youssif Malek (electrical), Wissam (web/app). **Recurring monthly (from Mar 2026):** rent 500, motor 100, EDL 30, water 20, municipality 13, internet 50, building 10 → **$723/mo**. Report: `reporting/data/anwar-personal-finance-setup-2026-09-07.json`. **Pending:** income receipt amounts from Youssif/Wissam (6 months).

### Session 2026-09-07 — Anwar operational wipe (E-Service)
**Wiped** 1,380 docs on `anwar.abouhassan@gmail.com` / `Av22LKyet8QmVcu9b8Njz1HVfoy1`: orders, purchases, customers, GL journals, finance vouchers, production batches, CRM activities. **Kept:** 17 products, 17 raw materials, 6 suppliers, COA (588 accounts), store settings. Report: `reporting/data/anwar-operational-wipe-2026-09-07.json`. Script: `scripts/wipeStoreOperationalData.cjs`.

### Session 2026-09-07 — Account roles locked
**Owner:** `anwar.abouhassan@gmail.com` (`Av22LKyet8QmVcu9b8Njz1HVfoy1`) — work, personal, ecosystem ops. **Test:** `mooveelectro@gmail.com` (`EZfuoNQFTJVU4cubNuckpp4K7zw2`) — QA/missions only. Code: `subscriptionGuard`, `syncAccountRegistry.cjs`. **Next:** `node scripts/syncAccountRegistry.cjs --write` to push labels to Firestore.

### Session 2026-09-05 — Discount GL + pre-audit deploy
**Problem:** POS discounts lowered net only — no 7090 contra; audit tomorrow. **Fix:** gross revenue + Dr 7090/410 on POS GL + manual RV; backfilled 10 historical discounted orders; TB $157,625.90 balanced. **Deployed:** hosting + `onOrderCreated`/`onOrderStatusChanged`/`api` 2026-09-05 (`Accounting-BfDXx8YL.js`). **Gate:** `scripts/auditLittleHandsPreAudit.cjs` PASS. Handoff: `docs/handoff/littlehands-pre-audit-2026-09-05.md`.

### Session 2026-09-04 — JV line UI (Path A CSS fix, build OK)
**Problem:** JV Debit/Credit/Foreign misaligned. **Fix:** Path A — removed Ln column; equal 96px cols for Dr/Cr/Foreign; num cells block layout; delete moved to account row. **Build:** exit 0. **Not deployed** — hard refresh after deploy; sign-off screenshot on Little Hands JV.

**Problem:** Lebanese TB showed all `0 LBP` for range 53001000001→70901000001. **Fix deployed hosting 2026-08-31 20:52.** **Verified:** Firestore 102 has period movement; `LITTLE_HANDS_INTEGRATION=1` integration test passes (102→53001000001 rollup, class 5 non-zero); live `Accounting-BzsPlioT.js` MD5 matches local dist. **UI:** hard refresh → Search → expand class **5** for `53001000001` cash line.

### Session 2026-08-31 — TB Page 1 fixes (deployed)
Trial Balance: account search prefix match (20→201 not 1120; 70→7010 not 1870); Lebanese default range 1→7; GL opens right slide sheet with voucher detail (no leave-page); fullscreen scroll fixed. **Live on hosting 2026-08-31.**

### Session 2026-08-27 — P&L AM form
P&L tab now matches the AM print: INCOME / Total Class 7, C.O.S (B.I, Purchases Goods, E.I), Gross Profit, EXPENSES, Profit Before Tax, Others / Additions, Taxable / NET PROFIT, then Difference of Exchange footer. LBP column, 3 decimals, parentheses for losses. 65-account audit still waits on AM file. **Live on hosting 2026-08-27** (`bfac116`).

### Session 2026-08-27 — SOA print layout (AM sample)
Statement of Account now matches the AM print: header Code/Name/Currency + From/To, B/F row, Date/Description/Dr/Cr/Balance with Db/Cr, totals, “Say Account Currency … Only”. Voucher serial stays clickable inside Description.

### Session 2026-08-27 — Accounting AM fixes (P0–P3)
Implemented from `docs/finishing.md` / accounting AM plan: TB class rollup + fallback; SOA/Quick/GL From→To with opening Dr/Cr and one account per page; COA add account; auto AR/AP subaccounts; voucher FX + preview + required JV party + edit = reverse+repost; **P&L AM form**. 65-account audit still waits on AM file. **Prod deploy requested 2026-08-27.**

### Session 2026-08-27 — GL range + TB empty (AM)
`docs/finishing.md`: GL needs From→To accounts; TB not showing rows; classes 1–7 all zero.

### Session 2026-08-27 — Quick statement broken (AM)
`docs/finishing.md`: quick statement preview still wrong — Dr/Cr, grouping, search, PCG display.

### Session 2026-08-27 — Vouchers (AM)
`docs/finishing.md`: currency + FX display, preview before post, JV party required, edit after post, auto client/supplier subaccounts.

### Session 2026-08-27 — Account statement SOA (AM)
`docs/finishing.md`: all accounts in flexible search; opening Dr/Cr; one statement per page; full voucher detail.

### Session 2026-08-27 — GL voucher display (AM)
`docs/finishing.md`: GL rows must open/display full voucher (dialog); clickable serial, not truncated id.

### Session 2026-08-27 — Trial Balance UX (AM)
`docs/finishing.md`: account entry UX, LE/currency clarity, full numbers (no K/M), currency picker, inline voucher view, fullscreen TB.

### Session 2026-08-27 — Accounting finishing (AM)
Account manager capture in `docs/finishing.md`: COA add-account (auto or manual code), **65 accounts** audit pending.

### Session 2026-08-24 — Dual-push policy
Code + docs mirrored: `AynBeirut/ecosystem` ↔ `a-nooor/ecosystem`; `AynBeirut/grabio-platform-docs` ↔ `a-nooor/grabio-platform-docs`.

### Session 2026-08-25 — Invoice launch crash fix
v1.2.10 (code 14) crashed on launch (`expo-keep-awake` + minSdk 21). Upload **`grabio-invoice-mobile/release/invoice-1.2.11-15.aab`** (1.2.11 / code 15). Next code ≥ 16.

Invoice Manager: `docs/handoff/invoice-manager.md`. Admin dashboard: `docs/handoff/admin-dashboard.md`.

### Session 2026-08-23 — Invoice app stays in-app
Products + clients stay in-app. One Settings. Footer `grabio.space/invoice` only. Hosting deployed. Upload **`grabio-invoice-mobile/release/invoice-1.2.10-14.aab`** (1.2.10 / code 14, minSdk 21). Next invoice code ≥ 15.

### Session 2026-08-22 — Deploy v1.2.4
Web hosting live (V·POS/V·Buy/V·Expense). Admin Android **1.2.5 (35)** → `grabio-mobile/release/grabio-1.2.5-35.aab` (orders chip fix + unpaid/schedule). Next admin versionCode ≥ 36.

### Session 2026-08-22 — Native Invoice Manager + CRM app
Standalone Expo app `grabio-invoice-mobile/` — Play package **`space.grabio.finance`**, signed with finance keystore (SHA1 `1B:EF:5B…`). Upload **`grabio-invoice-mobile/release/invoice-1.2.7-11.aab`** (versionName **1.2.7**, versionCode **11**). Play “no deobfuscation file” on v10 is a warning — R8 minify is off. Admin next ≥36; Invoice next ≥12. Trackers: `grabio-mobile/README.md`, `grabio-invoice-mobile/README.md`.

### Session 2026-08-22 — Mobile admin POS fixes
Create Order now loads all sellable products (matches V·POS). Composed/recipe products get quick price/stock edit. Owner Home tab → POS (no public marketplace exit).

### Session 2026-08-22 — V·POS client autofill
Phone match fills name; name typeahead picks existing customer; sale uses matched customerId (no duplicate).

### Session 2026-08-22 — V·OPS speed (round 2)
Bug: warm cache still force-refetched products/materials. Fixed. Catalogs now sessionStorage; ProtectedRoute sub/IP cached across routes; V pages eager-loaded; trial+invoice = one txn.

### Session 2026-08-22 — OCR receipts
Mobile scan → Vision OCR → confirm → save Purchase/Expense; image not stored. Needs Vision API enable + deploy before live.

A comprehensive e-commerce platform built with React, TypeScript, and Firebase, enabling multiple vendors to manage their stores, products, and orders in a unified marketplace.

## Features

### For Buyers

- Browse products from multiple stores
- Add items to cart with delivery address and GPS coordinates
- Google OAuth authentication
- Track order status in real-time
- View detailed order history with product information
- Dual currency display (USD/LBP)

### For Sellers (Premium)

- **Complete Store Management**: Create and customize your store profile
- **Product Management**: Add unlimited products with images and details
- **Order Processing**: Track orders with customer delivery info and GPS coordinates
- **Invoice Generation**: Create and share professional PDF invoices
- **Inventory Control**: Manage stock levels and raw materials
- **Purchase Orders**: Create and track supplier purchase orders
- **Customer Management**: Access customer data and order history
- **Analytics Dashboard**: View sales insights and store performance
- **Template Selection**: Choose from Modern, Classic, or Vibrant store templates
- **Custom Exchange Rates**: Set USD to LBP conversion rates
- **Multi-User Access**: Manage sales staff and sub-accounts

## Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Backend**: Firebase (Authentication, Firestore, Storage, Functions)
- **Build Tool**: Vite
- **PDF Generation**: jsPDF + html2canvas
- **Routing**: React Router
- **State Management**: React Context API
- **UI Components**: Custom components with shadcn/ui patterns

## Authentication

- Google OAuth with popup authentication
- Firebase Authentication for secure user management
- Role-based access control (User/Admin/Seller)

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

```sh
npm install
```

### Environment Variables

Create `.env.production` file:

```env
VITE_API_BASE=https://us-central1-market-flow-7b074.cloudfunctions.net/api
VITE_FIREBASE_AUTH_DOMAIN=market-flow-7b074.firebaseapp.com
```

### Local Development

```sh
npm run dev
```

The app will be available at [http://localhost:8080](http://localhost:8080)

### Build for Production

```sh
npm run build
```

### Deploy to Firebase

```sh
firebase deploy --only hosting
```

## Deployment

- **Live URL**: [https://www.grabio.space](https://www.grabio.space)
- **Firebase Hosting**: market-flow-7b074.web.app
- **Firebase Project**: market-flow-7b074

## Key Features Implementation

### Dual Currency System

- USD as primary currency
- LBP conversion with custom exchange rates per store
- Display both currencies on cart and invoices

### Delivery Management

- Customer delivery address input
- City and notes fields
- GPS coordinates capture
- Google Maps integration for location viewing

### Invoice System

- Generate professional PDF invoices
- Multiple template styles (Modern, Classic, Vibrant)
- Share via native share API or download
- Dual currency display on invoices

### Order Tracking

- Real-time order status updates
- Product details with quantities and prices
- Customer delivery information display
- Store contact information

To deploy, use Vercel, Netlify, or your preferred static hosting provider. Upload the contents of the `dist/` folder.

### General Improvements

- Cleaned up old build artifacts and ensured no legacy plugin code remains.
- README updated with all recent changes and troubleshooting steps.

# HappyBasket

## Project info

**URL**: [https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b)

## Project Name

**HappyBasket** (formerly market-flow-emporium)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Major Changes & Features (2025 Session)

### Firebase/Firestore Integration

- Seller upgrade logic uses Firestore for persistent seller/admin status (`sellers` collection).
- Store profile management is connected to Firestore (`storeProfiles` collection), with type safety and error handling.
- Product management (add/edit/delete) is fully integrated with Firestore (`products` collection), associating products with seller/store ID.

### Security & Setup

- Firestore security rules provided to allow authenticated users to write to their own data.
- Guidance for Firebase project/database setup included.
- Added Payment Credentials section for store admins to securely enter and save WishPay and Visa/MasterCard details to Firestore (`AdminPayments.tsx`).
- Added Cash on Delivery as a payment option for regular users in the cart (`Cart.tsx`).

### UI/UX

- Loading and processing states for async Firestore operations.
- Toast notifications for success/error feedback.

### How to Continue Development

- All seller/admin features are now persistent and user-specific.
- To add more features, follow the Firestore integration patterns in `src/pages/UpgradeToAdmin.tsx`, `src/pages/admin/AdminProfile.tsx`, and `src/pages/admin/AdminProducts.tsx`.

---

---

## What technologies are used for this project?

HappyBasket is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/350875b5-0b6c-43be-84cb-3347f940fc5b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Local editor hints and `.hintrc`

This repository includes a small `.hintrc` file used to tune webhint/editor warnings that are noisy in some dev environments (for example, theme-color compatibility messages across older browsers or inline-style rules flagged by some tools).

- Why: these rules were added to reduce distracting editor warnings while debugging the admin routing/hook issue.
- How to opt-out: remove or rename `.hintrc` in the repo root. Your editor will then show the original webhint warnings again.
- How to adjust: open `.hintrc` and update or remove specific rules; prefer editing the rules rather than deleting the file so CI behavior remains consistent for the team.

If you'd like, I can revert `.hintrc` and instead fix individual issues strictly (for example by removing all inline styles) — tell me which approach you prefer.  
  
Quick Stack Tip: Since you're using React, don't upload directly from the frontend to R2 using your master API keys. Generate an S3 Pre-signed URL using a lightweight Firebase Cloud Function. The React frontend gets the temporary URL from the function and uploads the image securely straight to R2.

This setup gives you the fast delivery speed your clients want without risking unexpected multi-hundred-dollar bills.

Which project are we configuring this for first? Let me know if you want the boilerplate code for the pre-signed URL upload flow.