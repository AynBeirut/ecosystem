# Decision Log

> **Canonical decision log:** `~/Documents/grabio-platform-docs/Decision-Log/`  
> Mirror significant decisions there when closing a sprint.

## 2026-09-14 — Manager mobile permissions vs web (Play gap + POS RBAC split)

**Finding:** Web manager sub-accounts use `hasStoreAdminAccess()` (`subAccountAccess.ts`). **Play mobile 1.3.5** still ships `ownerAccess.ts` with **owner-only** checks — managers see limited back-office; **not** a Firestore/cache issue.

**Delivery:** Clients get fix via **Google Play update** (`space.grabio.app`, versionCode ≥ 140). No client sideload APK.

**POS:** Windows Grabio POS (`posfinal-main/pos-v1`) uses **local** cashier/manager/admin roles in SQL — **not** Firebase `subAccounts`. Platform manager login ≠ POS local manager unless explicitly designed.

**Backlog:** `reporting/data/platform-pos-discovered-fixes-2026-09-14.md` + `.json`.

**Structural plan:** P0 mobile Play manager/store-admin parity + committed tenant binding first; P1 platform tenant/role cleanup; P1 mobile owner-only leftovers audit; P2 POS RBAC boundary/documentation. Treat all as platform fixes, not one-account setup.

## 2026-09-12 — Platform business document numbering (PO / SO / INV)

**Decision:** Per-store counters in `stores/{storeId}/ledgerMeta/documentSerials`. PO format **`PO-YYYY-MM-DD-001`** — **001 resets each document date**, then 002… Counter key `PO-YYYY-MM-DD`. Backfill: `scripts/backfillPurchaseOrderNumbers.cjs --force`.

## 2026-09-13 — Little Hands: Excel totals trusted; Grabio = mirror + classification

**Owner rule:** `Final Data Expenses` + monthly Excel **total in**, **total out**, **payroll** are **correct**. Work is **only** splitting lines into expense / purchase / payroll / assets in Grabio — not re-arguing totals.

**Import rule:** Any Excel line not in Grabio → import as **real data** (same **date** as Excel). **Category** (expense vs purchase vs payroll vs asset) → **owner confirms** before `--write`.

**SOT paths:** Cash out lines = `Final Data Expenses` `Total*` `Exp $`; payroll detail = monthly master **Salaries (col D)** + staff/cash lines as applicable.

## 2026-09-13 — HANDOFF: expense tiles + mobile tenant STILL OPEN (Anwar)

**Status:** Not verified by owner. Prior session deployed hosting + local APK; both issues reported unresolved.

**Canonical handoff:** `reporting/data/HANDOFF-littlehands-expense-tiles-tenant-2026-09-13.md`

**Likely gap A:** Expense UI added on `/admin/inventory` + dashboard quick actions — **not** in Dashboard sidebar group **Stock & Catalog** (`AdminDashboard.tsx` `menuGroups.daily_stock`).

**Likely gap B:** Firestore LH bind correct; device still on **old app binary** or cached tenant — need confirmed APK install + runtime mismatch guard.

**Next agent:** Read handoff file first; implement sidebar links + mobile guard; re-deploy hosting; ship APK Anwar actually installs.


**Root cause:** `users` doc had NIPCO `storeId`, `activeStoreId`, and `subAccountId` after NIPCO mobile fix; mobile resolution preferred `activeStoreId` + email-scoped NIPCO subAccount.

**Fix (prod):** Repointed `users` to Little Hands sub `v8P7fuf29Qp6Za4egA9Q` + `8WgfKtgaE8aAXdqFhIfweEo5WFq2`; guards in `resolveMobileSubAccount`, mobile `AuthContext`, web `subAccountAuth`; Rule 35 + `.cursor/rules/production-tenant-isolation.mdc`. Evidence: `reporting/data/littlehands-tenant-isolation-fix-2026-09-12.json`.

**Required:** Manager **sign out / sign in** (or force-quit app) to reload session. Mobile APK rebuild needed for code guards in store builds.

## 2026-09-12 — Grabio Guide pricing/admin map live alignment

**Context:** Grabio Guide, public pricing, admin subscription, and backend subscription/agent knowledge must speak from the same modular-v2 pricing reference.

**Plan:** Update canonical pricing/module source files first, then update public/admin/guide display surfaces that read or duplicate package, add-on, app, AI, and planned-module copy. Do not deploy until Anwar approves after review/build.

**Todo:** shared module presets/prices; storage limits; public Pricing page copy/FAQ; Subscription legacy add-on constants; Grabio Guide knowledge/local replies; list changed pages after verification.

## 2026-09-15 — Product center: live kitchen / venue (locked tiers)

**Decision:** Do **not** delete working modules. No broad vertical GTM expansion.

**Locked structure:**

| Tier | Scope |
|------|--------|
| **Active core** | `live_kitchen` / venue ops / CRM |
| **Optional maturity** | Accounting, inventory, recipe/production (deepen where venues need it) |
| **Connected high-end** | Builder, template, SEO (connected modules, not the center story) |
| **Maintained** | Shop, **factory/manufacturing** (working structure; may support restaurant production later — maintenance/support, not dropped) |
| **Deferred** | NGO, freelancer, mini shop (existing tenants supported; no expansion) |

**Engineering:** Deep structure work (tenant binding → resolvers → roles) prioritizes active core; factory stays maintained, not conflated with deferred packages.

**Execution handoff:** `docs/handoff/builder-start-main-structure-fine-dining-2026-09-15.md` — Slices A–C; Slice C evidence `reporting/data/restaurant-admin-ia-slice-c-2026-09-15.json` (`venueOpsSettings.restaurantFirstNavEnabled` opt-in).

**Planning:** Restaurant-first UI + security map — `docs/handoff/restaurant-first-ui-security-map-2026-09-15.md`.

## 2026-09-15 — Tenant binding foundation (slice 1)

**Decision:** Canonical session store = `users.subAccountId` → `subAccounts.storeId`. When `subAccountId` is set, `activeStoreId` is not used as email/store resolver hint; login repairs sync `storeId` + `activeStoreId` from the sub-account doc.

**Evidence:** `reporting/data/tenant-binding-foundation-2026-09-15.json` · code: `src/lib/tenantBinding.ts`.

## 2026-09-15 — Product pivot to fine-dining operations plus CRM

**Decision:** Grabio's active product center becomes fine-dining restaurant daily operations plus CRM. Accounting and inventory stay available as optional maturity modules; shop, manufacturing, and builder stay maintained for active clients; NGO, freelancer, mini shop, and broad custom vertical growth are deferred.

**Builder/template/SEO:** Keep connected inside Grabio as gated high-end client modules, not a separate platform now. They share tenant identity, store profile, domain, content, CRM, menu/products, reservations, and role policy.

**Rule:** Do not delete working modules because of the pivot. Future restaurant features must come from real client workflow drafts and be classified as daily operation, CRM, tenant option, report, automation, role/security, setup/import, optional inventory, optional finance, or temporary exception.

**Canonical map:** `~/Documents/grabio-platform-docs/Architecture/Fine-Dining-Platform-Map.md`.

## 2026-09-12 — Meta catalog package artwork

**Decision:** Meta/WhatsApp/Instagram/Facebook package feed should use package-specific public PNG cards, not the generic Grabio app icon.

**Implementation:** Generated 1080x1080 branded PNG cards in `public/meta-catalog/icons/` using the emoji-style module icons already shown in the UI and updated `reporting/data/grabio-meta-catalog-packages-2026-09-12.csv` `image_link` values to `https://grabio.space/meta-catalog/icons/<item_group_id>.png`.

## 2026-09-12 — Little Hands expense SOT = Final Data Expenses (USB)

**Path:** `/media/anwar/12AD-9999/Cash/Final Data Expenses/*.xlsx` — owner **final** file (replaces raw `Cash/*.xls` for account import).

**Sheets:** `Total*` tab · columns **Description** + **Exp $** (layout simplified vs legacy cash books).

**Pipeline:** `exportLittleHandsCashExpenses.py` (default root = Final folder) → organize → `establishLittleHandsCashBookSourceOfTruth.cjs --write`.

## 2026-09-12 — Little Hands: waiter PIN presence + service extra expenses (planned)

**Context:** Venue runs **entrance**, **birthday**, and **bar** on the same day. Staff must log **daily presence** and **same-day extra spend** per service line without full admin login.

**Decision (requirements — not built yet):**
1. **Staff PIN** (numeric keypad): **Start** / **Stop** shift on POS without store login; same PIN on **Extra expense today** with amount + bucket (**entrance | birthday | bar**).
2. **Audit:** every action logs `staffId`, `storeId`, timestamp, device (POS vs web/tablet).
3. **POS:** PIN-only footer actions (no waiter session login).
4. **Web / tablet:** waiter-level sub-account (or above) required for same flows.
5. **Data:** extra lines → store expenses with `serviceLine`, `businessDate`, `enteredByStaffId`; presence → extend beyond admin-only `staffPresence` month editor (today: `/admin/staff-presence`, **admin route only**).

**Out of scope v1:** replace USB payroll import; auto-post GL (stay pending until owner sign-off).

**Next:** Firestore schema + POS UI slice → platform waiter routes → link to today’s operational day. **Start implementation only after Anwar confirms.**

## 2026-09-12 — Little Hands supplier purchases (Phase 1)

**Decision:** Purchases today live in **`expenses`** (495 rows, ~$38k); **`purchaseOrders` = 0**. Before Excel import: baseline export `reporting/data/backups/2026-09-12/littlehands-suppliers-purchases-baseline-2026-09-12.json`. Owner Excel = source of truth when delivered; map to `purchaseOrders` + reconcile master col C Expenses.

## 2026-09-12 — Little Hands backup + master map refresh

**Decision:** Excel col B remains **100% month sales truth**. Backup bundle `reporting/data/backups/2026-09-12/` (master xls, USB sqlite, Firestore order export). Accounting-confirmed POS totals: Corine $2500, Natacha Bitar $550, Mila Fares $1000. Jun/Jul gap treated as **net Pamela shift**, not $500 reconcile discounts.

## 2026-09-11 — Little Hands Dec/Jan/Mar gaps CLOSED (Excel backfill)

**Context:** POS absent or partial; Excel cash book holds real sales for Dec 2025, Jan 2026, Mar 2026.

**Decision (owner):** Gaps are **real data** — not errors. **Closed** for reconcile; enter into Grabio from Excel Cash ODS:
- **Dec ~$665** — pre POS 18-Dec
- **Jan ~$639** — birthday/cash lines, no POS tickets
- **Mar ~$676** — walk-in not ticketed

**Still open:** Apr (~$436), May (~$2,461), Jul/Aug birthday line match.

---

## 2026-09-11 — Little Hands monthly master xls = source of truth

**Context:** Owner designated `/home/anwar/Downloads/Monthly Sales & Expenses .xls` as **100% month map** (Sales, Expenses, Salaries, Total Revenue).

**Decision:** Month-level POS compare uses **master col B Sales**, not Cash ODS In$. Cash ODS remains drawer detail (Sanaa, D.P, daily). Evidence: `reporting/data/littlehands-monthly-master-map-2026-09-11.json`. Jul/Aug master Sales matches Grabio POS; Dec–May POS under master (May gap **$2,461**). Nov 2025 still absent from master.

---

## 2026-09-11 — Little Hands USB handoff for client-machine Cursor audit

**Context:** Cursor installed on Little Hands store PC (same LAN). ~3 months of sales/cash missing from Nov 2025 (UniCenta era before AynBeirut/Grabio sync).

**Decision:** USB folder `UBUNTU 24_0/littlehands-data-audit/` with `START-HERE-CURSOR-AGENT.md` instructs store-side Cursor to inventory UniCenta + AynBeirut sqlite + Excel Cash, re-copy live `.unicenta` DB, and return `output/` JSON/CSV on USB.

**Known gaps filed:** `evidence/gap-summary-known-2026-09-11.json` — Nov 2025 empty everywhere; Dec/Jan ~$600/mo Excel vs POS; Jul/Aug birthday gaps.

---

## 2026-09-11 — Little Hands cash reconcile PAUSED + legacy POS sources

**Context:** USB cash book (`July 2026.ods`) vs Grabio POS reconcile rules locked (In$ + Col G D.P, Sanaa Col F, birthday package). Owner pausing to return later.

**Decision:** Pause implementation; document locked rules + July figures in `reporting/data/littlehands-cash-reconcile-pause-2026-09-11.json`. Resume with event-level birthday match (~$1,054).

**Legacy POS (USB `UBUNTU 24_0`):**
- `AynBeirutPOS-Backups/*.sqlite` = **Little Hands** AynBeirut/Electron POS; 5 files identical; **1314 sales** Dec-2025→Sep-2026; monthly cash **matches Grabio Firestore** (July $23,371 / 126 orders).
- `unicenta-opos/` = UniCenta **app only** — **no sales DB on USB**; do not sum with AynBeirut without ticket dedupe.
- Evidence: `reporting/data/littlehands-legacy-pos-sources-2026-09-11.json`.

**Gap note:** `sales.downPayment` column exists in sqlite but **0 July rows populated** — Excel Col G D.P ($3,430 net) not mirrored in POS DB field.

---

## 2026-09-11 — Manager sub-account = store admin UI access

**Context:** Little Hands `manager@grabio.space` needs same back-office as store owner. Grabio has two sub-account types often confused in CRM copy: **Manager** (`subAccountRole: manager`) vs **Sales rep** (`subAccountRole: sales`).

**Decision:**
- `hasStoreAdminAccess()` = store owner **or** Manager sub-account — full admin nav, staff/payroll, finance, CRM, inventory, SEO setup.
- **Sales rep** unchanged — team dashboard, own clients/orders, no store admin tools.
- Subscription/billing remains **store owner only** (`role: admin`).

**Code:** `src/lib/subAccountAccess.ts`, `useAdminNavigation`, `ProtectedRoute`, `AdminLayout`, `AdminDashboard`, `ModuleGate`.

---

**Context:** Buyers need to see dashboard, POS, inventory, and finance screens before signup. Indexing raw `/admin/*` is wrong (auth, noindex, thin utility URLs).

**Decision:**
- Publish curated read-only admin tours at `/demo-os/:moduleId` and `/demo/:slug/os/:moduleId`.
- Reuse high-fidelity mock UI (`DemoPreviewMockScreen`) inside `DemoOsLayout` + sign-in gate on every write action.
- Seed marketing demo storefronts in Firestore (`grabio-demo-shop`, etc.) for “Try the demo” CTAs — separate from builder `builders/{uid}/demoStores`.
- Sitemap/prerender only the 13 curated demo-os URLs (+ existing demo/feature preview URLs), not all 86 admin routes.

**Phase 1 modules (12):** dashboard, v-pos, orders, products, inventory, purchases, invoices, expenses, accounting, crm-pipeline, theme-editor, ai-assistant.

## 2026-09-10 — SEO growth sprint (category keywords + comparison pages)

**Context:** Phase 1 `/demo/*` pages deployed and manually submitted for GSC indexing, but organic traffic is near zero. Homepage and vertical metadata lean on benefit copy, not buyer category terms. No comparison pages exist. `www` and apex both serve 200.

**Decision:**
- Target vertical category keywords first (retail POS, restaurant food cost, BOM manufacturing, ecommerce fulfillment), not broad “all-in-one SMB software” head terms.
- Publish reusable `/compare/:slug` pages (Square, TouchBistro, Katana, Shopify, Odoo) with factual tables and one demo CTA each.
- Canonical host: `https://grabio.space` (non-www). Interim client redirect on `www`; Firebase console “redirect domain” for true 301 when configured.
- Keep Firestore `demo_start` as primary demo attribution; GA4 mirror optional later.
- Social profiles in schema/footer: Instagram + Facebook.

**Out of scope this sprint:** G2/Capterra profiles, paid ads, Reddit seeding, Phase 2 verticals.

## 2026-09-10 — No-risk correction before client accounting setup

**Context:** Tomorrow has a critical old-client accounting setup with the client's accounting manager. The client may decide whether to stay with Grabio. Today must improve structure and documentation without risking production behavior.

**Decision:** Today is docs/plans only. No deploy, no migration, no production data change, no workspace move, no broad refactor, no POS/mobile/accounting/invoice behavior change. Structural correction work must become documented future PR slices.

**Priorities:** clean documentation mapping, define the correct infrastructure base without implementing risky changes, and build a sustainable follow-up method where fixes upgrade the structure.

**Consequences:** Future structural implementation waits until after the client setup or explicit owner approval. Tomorrow's work must use stable UI/script paths only and document any product gaps as follow-up.

## 2026-09-10 — Builder and accounting roles become platform policy

**Context:** Builder and accounting client access, account roles, permissions, and environments are partly implemented. Owner assessment: about 60% complete, but it needs more work. The risk is that builder/accounting access remains one-account setup instead of becoming reusable Grabio rules.

**Decision:** Builder/accounting accounts, sub-account permissions, and environment access must become general platform policy. Store admins should get default role templates, with tenant customization when package allows it. Web, Functions, mobile, POS, and invoice app must resolve the same effective permissions.

**Rejected alternatives:**
- Patching one client account to make access work - fast but not scalable.
- Keeping builder/accounting access only as hardcoded route allowlists - difficult to audit and extend.
- Letting mobile/backend permissions drift from web UI permissions - unsafe and confusing.

**Consequences:** Future agents must define role/environment scope before changing access. New role behavior must be a default role template, tenant option, or documented temporary exception. Builder users must not see finance/cost data unless allowed; accounting users must not get website/admin powers unless allowed.

## 2026-09-10 — Setup surfaces must stay separated

**Context:** Store Profile setup originally held most setup fields. It was split for performance and clarity into Store Profile, Invoice Document setup, and Website Template setup. Review showed the split exists but is not fully clean: invoice numbering remains in Store Profile; invoice document branding is separate; website template setup spans Theme Editor and legacy template setup.

**Decision:** Treat the three setup surfaces as separate ownership areas. Store Profile owns business identity and operational defaults. Invoice Document setup owns A4/PDF document branding and template style. Website Template setup owns storefront theme and public layout. Shared fields may be used as fallbacks only when the authoritative edit surface is clear.

**Rejected alternatives:**
- Returning all setup fields to Store Profile - recreates the old heavy page and hurts performance/clarity.
- Letting multiple setup pages write the same field silently - creates overwrites and client-specific template bugs.
- Moving fields before ownership is documented - risks breaking invoice, website, mobile, POS, or NIPCO template lock behavior.

**Consequences:** Before coding, review field ownership, fallback order, read/write paths, mobile/POS consumers, scripts/backfills, and NIPCO lock impact. Invoice numbering needs an explicit decision: move to Finance/Invoice settings or document it as operational order numbering separate from A4/PDF template setup.

## 2026-09-10 — Workspace organization and quarantine policy

**Context:** The Grabio workspace contains main platform code, POS/mobile/invoice apps, backup structures, client data, reporting evidence, scripts, and planning docs. Random files and folders increase risk for future agents, but blind cleanup risks data loss.

**Decision:** Organize by inventory first. No file or folder should be moved until an inventory report, classification, reference check, and proposed move list are reviewed. Quarantine may be used for uncertain files, but 40 days means eligible for review only, not automatic deletion.

**Rejected alternatives:**
- Blind cleanup by folder name - too risky because backups, client data, and build paths may look random.
- Automatic deletion after 40 days - unsafe because the file may still be the only source of evidence or restore data.
- Moving source/app folders into a new layout without a refactor plan - can break imports, builds, deployment scripts, and mobile packaging.

**Consequences:** Future agents must preserve memory in docs, use the workspace policy before moves, write quarantine manifests, and request explicit approval before any deletion.

## 2026-09-10 — Client requests become tenant options by default

**Context:** Recent Grabio work spans the main platform, POS, mobile apps, and new-client data setup. Client discoveries such as Jinan's Kitchen reservations/advance orders, NIPCO order-status preferences, configurable sub-account roles, and payment-method availability exposed the risk of turning tenant needs into hidden shared-code patches. Data setup also exposed a product gap: backend scripts and AI setup are useful starters, but store owners need UI paths to see, correct, and continue the setup.

**Decision:** Treat Grabio as a configurable multi-tenant platform. A client-specific request must be classified before implementation as a global platform fix, tenant option, account data setup, or temporary exception. If different stores can reasonably need different behavior, implement it as a tenant option with safe defaults and admin control, then make web, POS, mobile, and Functions read the same effective setting. Store setup must be UI-first: scripts/imports/AI agents can prepare data, but every setup result must be visible, reviewable, editable where allowed, and connected to the next admin UI step.

**Rejected alternatives:**
- Per-client hardcoded branches — fast short-term, but creates untestable behavior drift across accounts.
- Editing only the affected account without a platform model — acceptable only for pure data setup, not workflow or UX behavior.
- Letting mobile/POS duplicate settings separately — causes checkout, order, and payment mismatches.
- Treating backend data setup as final delivery — hides setup knowledge from the client and prevents the platform from becoming smarter.

**Consequences:** Future agents must document the classification before code changes, update the settings architecture when adding options, and include cross-surface verification. Existing custom changes should be audited and moved into typed tenant settings where needed. Repeated setup work should produce UI improvements such as Excel template downloads, upload/preview flows, validation messages, AI mapping/correction, approval gates, and links to the configured admin screens.

## 2026-09-09 — Builder demo WordPress = staging only

**Decision:** Builder demo WordPress must **never** use the production go-live pipeline (client domain, DNS gate, credential email).

**Model:** `requestKind: builder_demo` → auto hostname `{slug}-{demoId8}.demo.grabio.online` on VPS `104.207.71.117`; credentials revealed in builder UI only. Client custom domain only after demo transfer to paid store.

**VPS ops:** SSH via `VPS_SSH_PRIVATE_KEY` (password auth disabled on server); SSL via Webuzo `acme.sh`; Apache must be running (`httpd -k start` + cron watchdog). Webuzo `*-combined.pem` must include **private key** appended to full chain.

## 2026-09-09 — Website package pricing + included custom domain

**Decision:** Add **Website & Blog** package (`pkg_web_presence`) at **$10/mo / $100 yr**. Custom domain included on all website packages; remove standalone $15 domain add-on. Business Backend excluded (no website → no custom domain).

## 2026-09-08 — Grabio storefront vs E-Service backend (owner store)

**Decision:** Public shop = **Grabio** (trade mark, logo, slug `grabio`, hardware catalog). **Invoices / GL / finance documents** stay **E-Service** (`financeDocumentSettings.documentCompanyName` — unchanged).

**Store:** `Av22LKyet8QmVcu9b8Njz1HVfoy1` (`anwar.abouhassan@gmail.com`).

**Catalog:** Storefront shows **hardware** only (cables, batteries, POS equipment, etc.). Services (web, hosting, electrical labor, setup fees) stay in admin but **hidden online** (`inStock: false`).

**Apply:** `node scripts/setupGrabioStorefront.cjs --write`

## 2026-09-08 — NIPCO invoice template production lock

**Decision:** Store `DfIhBAEZ5NR7yNX0HboZvv58Nf82` (NIPCO) invoice/PDF template is **not editable** by store users or generic template setup flows. Only ecosystem owner (Anwar) may change via Admin SDK script with `--owner-override`.

**Root cause:** Breaks were from **Grabio team** (migrations, bulk scripts, template refactors) — **never** NIPCO users.

**Team workflow:** Any invoice template platform/mobile work must **exclude NIPCO**. Run `node scripts/auditNipcoInvoiceTemplate.cjs` before deploy. Bulk scripts must call `assertSafeStoreProfilePatch` from `scripts/lib/nipcoInvoiceTemplateLock.cjs`.

**Enforcement:** Firestore rules block client writes to template fields on NIPCO. App save paths throw; UI read-only. Cursor rule: `.cursor/rules/nipco-invoice-template.mdc`.

**Restore:** `node scripts/restoreNipcoInvoiceTemplate.cjs --write --owner-override`

## 2026-09-07 — Ecosystem owner vs test account (locked)

| Email | Role | Store UID | Use |
|-------|------|-----------|-----|
| `anwar.abouhassan@gmail.com` | **Primary owner** — work + personal + ecosystem ops | `Av22LKyet8QmVcu9b8Njz1HVfoy1` | Production owner; subscription bypass + premium override |
| `mooveelectro@gmail.com` | **Test account** — QA / mission testing only | `EZfuoNQFTJVU4cubNuckpp4K7zw2` | E-Moove pilot store; `isTestAccount: true` |

**Supersedes:** anwar labeled `legacy` / moove as de-facto owner bypass in `subscriptionGuard`.

**Apply to Firestore:** `node scripts/syncAccountRegistry.cjs --write` (after review).

## 2026-09-04 — Business Finance UI/UX unification (vouchers P1)

**Goal:** JV-quality UI, logic, and flow on all voucher types (JV/PV/RV/CRN/DRN/CV) and phased parity across `/admin/finance/*`.

**Shipped (vouchers P1):**
- Shared `sharedLinesEditorProps`: matrix footer, FX grid, flip box, auto-balance, preview gates on **all** types
- Auto reference (`externalReference`) + duplicate guard on **PV/RV/CV** (was JV/CRN/DRN only)
- CRN/DRN register filter; CV `mirrorPair`; Lebanese PV/RV/CV drop duplicate Reference field (header auto ref)
- Shared pre-post validation: accounts on amount lines, USD/LBP bucket balance messages

**Shipped (payroll UI — 2026-09-11):** Little Hands `/admin/staff` Mark as paid / statement / add / edit → shared `AdminSideSheet` (same slide panel pattern as `AccountingSideSheet` in finance).
- `legacyErpReportFrame.ts` helpers applied to TB/GL/SOA/Party panels + inline Accounting reports (BS, VAT, AR/AP aging, cash flow, COA, reconciliation, bank rec)
- All Business Finance manager popups → `AccountingSideSheet` (Staff, Delivery, Projects, Inventory, Portfolio, DataImport, doc previews, allocation, reconciliation variance)
- TDZ fix in `VoucherEntryPanel` (`effectiveVoucherRate` before `sharedLinesEditorProps`) — deployed

**Intentionally unchanged:** `AccountingCommandPalette` stays `CommandDialog` (search UX).

## 2026-09-04 — JV line UI agent handoff (failed)

**Outcome:** JV line alignment not fixed after 24h. Agent removed from task.

**Handoff:** `docs/handoff/voucher-jv-line-ui-2026-09-04.md`

**Rule for next dev:** CSS/table fix only on line cells — no full layout redesign. Last git UI baseline: `bfac116` `VoucherEntryPanel` inline JV table.

## 2026-09-01 — Matrix 8 = source of truth for Business Finance

**Scope:** `/admin/finance/*` only (not POS, Invoice Manager, V·Buy, etc.).

**Reference:** USB `Matrix8` + `matrix8-docs/architecture.md` (GLM ledger).

**Phased parity (Matrix → Business Finance):**

| Phase | Matrix capability | Status |
|-------|-------------------|--------|
| P1 | CRN/DRN vouchers, value date, duplicate reference guard (CV contra kept) | Shipped (code) |
| P1 | SOA by value date; journal register filters (GL100P types) | Shipped (code) |
| P2 | Generate VAT transfer GL entries (GL160P) | Shipped (code) |
| P2 | Post closing + move balances to next year (GL110P) | Planned |
| P3 | TB foreign + monthly; consolidated/principal SOA | Planned |
| P3 | Forecast/budget; fixed-asset inventory; voucher attach/folder | Planned |
| P3 | Modify account #; principal account; trustee rights | Planned |

**Keep (Grabio extension, not Matrix):** CV contra stays available alongside Matrix voucher types.

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

### 2026-09-10 — GCP project selection (agent recurring mistake)

**Problem:** Agents report “IAM blocked” on Google APIs when `gcloud` default project is `gj-real-estate-346907` instead of Grabio `market-flow-7b074`.

**Rule:** Session start = `gcloud config set project market-flow-7b074` + `firebase use market-flow-7b074`. Human Owner account for API enable; SA for deploy only. Canonical doc: `docs/deployment/GCP-SESSION.md`.

**SEO follow-up:** Indexing API enabled on correct project; URL submit still needs `gcloud auth login` with indexing/webmasters scopes or SA as GSC Owner.

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

## 2026-09-10 — Grabio SEO Phase 2: technical crawl cleanup before growth

**Decision:** Treat 16 indexed URLs as a crawl/index-quality baseline, not as proof the full product structure should be indexed. Phase 2 must prioritize sitemap correctness, canonical consistency, noindex policy, prerendered marketing metadata, and reviewed programmatic content before scaling URL count.

**Implemented:**
- GSC evidence saved: `reporting/data/grabio-gsc-indexing-baseline-2026-09-10.json` (`/sitemap.xml` submitted successfully, 48 discovered pages).
- Static sitemap index: `/sitemap.xml` points to `sitemap-static.xml`, `sitemap-programmatic.xml`, `sitemap-stores.xml`, and `sitemap-products.xml`.
- Dynamic store/product sitemap routes now filter thin/noindex/offline records and use canonical subdomain URLs.
- Removed low-value sitemap URLs `/login` and `/signup`; canonical marketplace sitemap URL is `/search`.
- Added route-level `noindex,nofollow` for admin/auth/customer utility paths and 404 pages.
- Fixed default GSC property constants from `https://www.grabio.space/` to `https://grabio.space/`.
- Added product-level SEO metadata support and programmatic page quality gates.

**Risk:** Store/product child sitemaps emit subdomain canonical URLs; full GSC coverage may require Domain property verification, not only the apex URL-prefix property.

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
