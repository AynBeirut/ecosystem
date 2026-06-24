# Backlog — Grabio / Market Flow

## Sales CRM add-on (plan — awaiting confirmation to build)

**Module name:** Sales CRM  
**Delivery model:** Optional store add-on (not core marketplace). Gated by `storeProfiles.addons` (or `enabledModules`) + new permissions.  
**Status:** Phase 0 complete (foundation). Phases 1–7 = full module build (single release).

### Confirmed decisions (locked)
- Add-on on **all paid plans** (Starter / Pro / Business)
- **`crm_rep`** role + `crmReps` collection (not sub_account permissions)
- **GPS:** mobile auto + web browser permission
- **Conversion metric:** pipeline stage `closed` (not activity result)
- **Ship:** one full release (no partial MVP)

### Pre-close fixes — done
- [x] CRM rep creation via Cloud Function `POST /crm/reps/create` (Admin SDK — owner session preserved)
- [x] Admin CRM banner: Firestore index build delay notice (`CrmFirestoreIndexNotice`)
- [x] Android: `ACCESS_FINE/COARSE_LOCATION` in app.json + runtime permission helper (`geolocation.ts`)
- [ ] **Physical Android GPS QA** — required on real device before client demo (see below)

#### Physical device test checklist (Android — not emulator)
1. Install dev build on physical phone (`expo run:android` or release APK).
2. Sign in as CRM rep created via **Reps** (server flow).
3. Open a client → **Log activity** → allow location when prompted.
4. Confirm coordinates appear; save log; verify in admin **Activities** and **Map**.
5. Deny permission once → confirm alert + **Open Settings** path works.

*Emulator GPS is not accepted for sign-off.*

### Full CRM build — done (web + mobile rep)
- [x] Admin: pipeline kanban, activity feed + export, map, performance, client profile, reps + Auth invite
- [x] Rep web portal `/team/crm`
- [x] Mobile: `crm_rep` auth, My Clients, client detail + GPS activity log

### Phase 0 — done
- [x] Types: `src/types/crm.ts`, customer CRM fields on `Customer`
- [x] Lib: `src/lib/crm.ts`, `src/lib/crmAuth.ts`, `useSalesCrmAddon`, `CrmAddonGate`
- [x] Auth: `crm_rep` in `UserRole`, AuthContext load + login redirect
- [x] Firestore: rules for `crmReps`, `crmActivities`, customer rep updates; `firestore.indexes.json`
- [x] Subscription: `salesCrm` add-on ($12/mo, $120/yr), merge on activate (functions)
- [x] Routes: `/admin/crm/*` shell + placeholders, `/team/crm` rep portal, `AdminCrmReps` list
- [x] ProtectedRoute: `crm_rep` role support

---

### 1. Product summary

| Surface | Who | Core jobs |
|---------|-----|-----------|
| **Rep mobile** | Sales reps (`sub_account` role `sales` + `manage_crm` / mobile `sub_seller`) | Assigned clients, log visit/call/WhatsApp/meeting with GPS + result + notes, history, follow-up date |
| **Admin web** | Store owner + managers | Full activity feed, filters, map of visits, rep performance, export PDF/Excel, pipeline kanban, client CRM profile |

**Reuse:** Firestore `customers` as CRM “clients” (extend fields). Existing `AdminCustomers` stays for master data; CRM screens add pipeline/activity layer.

**New collections:** `crmActivities` (all logs). Optional later: `crmSettings` per store (pipeline stage labels, “no contact” threshold days).

---

### 2. Add-on gating & permissions

**Enable add-on**
- Field on `storeProfiles`: `addons: string[]` includes `'sales_crm'` (align with `Subscription.tsx` `activeAddOns` pattern).
- Admin **Subscription / Store settings**: toggle “Sales CRM” (owner-only).
- Routes and nav items hidden when add-on off.

**New permissions** (`SubAccountPermission`)
- `view_crm` — read clients assigned to self (rep) or all (manager)
- `manage_crm` — log activities, move own pipeline cards
- `manage_crm_admin` — full feed, all reps, map, export, move any card (owner + manager sub-account)

**Role defaults**
| Role | Permissions |
|------|-------------|
| `sales` (rep) | `view_crm`, `manage_crm`, existing `view_customers` / `manage_customers` |
| `manager` | + `manage_crm_admin` |
| `admin` (owner) | all CRM (implicit) |

**Mobile ↔ web rep identity**
- Rep = `subAccounts` doc linked via `users.subAccountId` (web) / same Firebase uid on mobile.
- `customers.assignedRepId` = `subAccounts.id` (not Firebase uid) for stable assignment.

---

### 3. Data model (Firestore)

#### 3.1 Extend `customers` (CRM client card)

| Field | Type | Notes |
|-------|------|-------|
| `pipelineStage` | enum | `new_lead` \| `contacted` \| `interested` \| `proposal_sent` \| `negotiation` \| `closed` \| `lost` |
| `assignedRepId` | string? | `subAccounts.id` |
| `nextFollowUpAt` | Timestamp? | Drives reminders |
| `dealValue` | number? | USD; optional |
| `dealCurrency` | string? | default `USD` |
| `lastActivityAt` | Timestamp? | Denormalized for “no contact” queries |
| `lastActivityResult` | string? | Latest result snapshot |
| `crmEnabled` | boolean? | true when managed in CRM (vs order-only walk-in) |

**Indexes:** `(storeId, assignedRepId)`, `(storeId, pipelineStage)`, `(storeId, nextFollowUpAt)`, `(storeId, lastActivityAt)`.

#### 3.2 `crmActivities` (immutable log rows)

| Field | Type | Notes |
|-------|------|-------|
| `storeId` | string | |
| `customerId` | string | |
| `repId` | string | `subAccounts.id` |
| `repName` | string | Denormalized |
| `type` | enum | `visit` \| `call` \| `whatsapp` \| `meeting` |
| `loggedAt` | Timestamp | Default now; editable |
| `location` | `{ lat, lng, accuracy? }` | Auto GPS on mobile; optional on web |
| `result` | enum | `interested` \| `not_interested` \| `follow_up` \| `closed` \| `no_answer` |
| `notes` | string | Free text |
| `followUpAt` | Timestamp? | Optional reminder from this log |
| `pipelineStageAfter` | string? | Stage after rep/admin moved card |
| `createdBy` | string | uid |
| `source` | `mobile` \| `web` | |

**Indexes:** `(storeId, loggedAt desc)`, `(storeId, repId, loggedAt)`, `(storeId, customerId, loggedAt)`, composite filters via client-side or Cloud Function aggregates for performance dashboard.

#### 3.3 Store CRM settings (optional v1.1)

`storeProfiles.crmSettings`: `{ noContactAlertDays: 7, defaultPipelineStages: [...] }`.

---

### 4. Security rules (sketch)

- `customers`: rep can **read/update** only if `assignedRepId == their subAccountId` OR has `manage_crm_admin`; owner always.
- `crmActivities`: rep **create** if `repId` matches self and `customerId` belongs to store; rep **read** own or assigned clients; admin read all store.
- No rep can delete activities (audit trail); admin soft-delete flag optional v2.

---

### 5. Rep mobile view (grabio-mobile)

**Entry:** Owner dashboard menu item “Sales CRM” when add-on on; for `sub_seller` → dedicated tab or stack “My Clients”.

**Screens**

1. **My Clients** — list `customers` where `assignedRepId == me`, sort by `nextFollowUpAt` then name; badge if follow-up overdue.
2. **Client detail** — contact info, pipeline stage badge, deal value, next follow-up, **activity timeline** (query `crmActivities` by `customerId`).
3. **Log activity** (modal or screen)
   - Type: Visit / Call / WhatsApp / Meeting
   - Date/time: default now, datetime picker
   - GPS: `expo-location` (or existing pattern) on save; show map preview if granted; warn if denied
   - Result: Interested / Not interested / Follow-up needed / Closed / No answer
   - Notes
   - Follow-up date (optional) → updates `customers.nextFollowUpAt`
   - On save: write `crmActivities` + update `customers.lastActivityAt`, `lastActivityResult`; optional auto-advance pipeline (see §7)
4. **Reminders** — local push or in-app list: `nextFollowUpAt <= today` for assigned clients (FCM v2 if needed).

**Dependencies:** `expo-location`, permissions copy in UI.

---

### 6. Admin web view (`/admin/crm/*`)

**Routes (lazy, add-on gated)**

| Path | Screen |
|------|--------|
| `/admin/crm` | CRM hub (tabs or sub-nav) |
| `/admin/crm/activities` | Full activity feed |
| `/admin/crm/map` | Map view (Google Maps / Leaflet — match existing cart GPS pattern) |
| `/admin/crm/performance` | Rep stats |
| `/admin/crm/pipeline` | Kanban board |
| `/admin/crm/clients/:id` | Client CRM profile |

**6.1 Activity feed**
- Table/cards: rep, client, type, date, result, notes snippet, GPS link.
- Filters: rep, client (search), date range, result, type.
- Pagination or infinite scroll (Firestore `loggedAt` + cursor).

**6.2 Map view**
- Pins from activities where `type === visit'` (or all types with location).
- Cluster by zoom; click pin → activity + client link.
- Filter: rep, date range.

**6.3 Performance summary (per rep)**
- Total visits (type=visit) week / month
- Conversion rate: `closed` activities / total activities (or clients moved to `closed` stage — define in UI copy)
- **Stale clients alert:** assigned clients where `lastActivityAt` older than X days (configurable, default 7)
- Table sortable by visits, conversion, stale count

**6.4 Export**
- Reuse `exportToCSV` + `jspdf`/`jspdf-autotable` (same as `AdminProduction`, `AdminAccountStatement`).
- Columns: date, rep, client, type, result, notes, lat/lng, pipeline stage, deal value.
- Filters applied = export scope.

**6.5 Pipeline board (kanban)**
- Columns (fixed v1): New Lead → Contacted → Interested → Proposal Sent → Negotiation → Closed → Lost
- Card = customer (name, rep, deal value, next follow-up)
- Drag-drop (`@dnd-kit/core` — add dependency) updates `pipelineStage`; write audit via `crmActivities` type system note or `logAction`
- Rep (mobile/web): move **assigned** cards only; admin: any card

**6.6 Client profile (CRM)**
- Sections: header (contact), assigned rep (admin can reassign), pipeline stage, deal value, next follow-up
- Full activity history (timeline)
- Link to orders: read-only query `orders` by `customerId` / phone match
- Quick actions: log activity (web), change stage, set follow-up

**Nav:** `AdminDashboard` quick action + sidebar link “Sales CRM” when add-on enabled.

**Rep web (optional v1):** `/team/crm` mirror of mobile list + log for sub_accounts with `manage_crm` only.

---

### 7. Business rules

| Event | Behavior |
|-------|----------|
| Log activity with result **Closed** | Suggest / auto-set `pipelineStage` → `closed` |
| Result **Follow-up needed** | Require or strongly prompt `followUpAt` |
| Move card on kanban | Update `pipelineStage`; optional activity row `pipelineStageAfter` |
| Assign rep | Admin only; rep sees client in mobile list |
| Add-on disabled | Read-only access to historical activities (optional) or hide module |

**Pipeline auto-advance (MVP):** Manual only on kanban; activity log does **not** auto-move stage except optional prompt when result = Closed.

---

### 8. UI / design

- Reuse admin Tailwind + shadcn cards/tables/dialogs (`AdminCustomers` patterns).
- Mobile: `COLORS`, `RADIUS`, `SHADOW` from `grabio-mobile/src/theme.ts`.
- Module badge: “Sales CRM” in nav; icon `Users` / `MapPin` / `Kanban` (lucide).

---

### 9. Implementation phases (recommended order)

| Phase | Scope | Est. |
|-------|--------|------|
| **0** | Add-on flag, permissions, types, Firestore rules, indexes | 1–2 d |
| **1** | `crmActivities` CRUD + extend `customers` fields + assign rep on AdminCustomers | 2 d |
| **2** | Rep mobile: My Clients, Log activity, GPS, history, follow-up | 3–4 d |
| **3** | Admin: activity feed + filters + client CRM profile | 2–3 d |
| **4** | Pipeline kanban (web) | 2 d |
| **5** | Map view + performance dashboard + stale alert | 2–3 d |
| **6** | Export PDF/Excel + dashboard nav + subscription add-on UI | 1–2 d |
| **7** | Reminders (in-app list; push optional), polish, tests | 1–2 d |

**Total (rough):** ~14–18 dev days for MVP as specified.

---

### 10. Files to add / touch (implementation checklist)

**New**
- `src/types/crm.ts`
- `src/lib/crm.ts` (queries, stage labels, filters)
- `src/pages/admin/crm/` — ActivitiesFeed, CrmMap, CrmPerformance, CrmPipeline, CrmClientProfile, CrmLayout
- `grabio-mobile/src/screens/crm/` — MyClients, ClientDetail, LogActivity
- `firestore.indexes.json` entries
- Firestore rules block for `crmActivities`

**Modify**
- `src/App.tsx` — routes
- `src/pages/admin/AdminDashboard.tsx` — quick action
- `src/pages/admin/AdminCustomers.tsx` — assign rep, pipeline, deal value when CRM on
- `src/pages/admin/AdminSubAccounts.tsx` — CRM permissions
- `src/types/subaccount.ts` — new permissions
- `grabio-mobile/src/navigation/AppNavigator.tsx`
- `grabio-mobile/src/screens/owner/OwnerDashboardScreen.tsx` — CRM entry
- `src/pages/admin/Subscription.tsx` or store profile — add-on toggle

---

### 11. Out of scope (v1)

- Pipedrive / external CRM sync
- Email/calendar integration
- Custom pipeline stages per store
- Offline-first activity queue (v2)
- WhatsApp API send (log type only)
- AI lead scoring

---

### 12. Decisions needed before build

1. **Add-on pricing:** Included in Business tier only, or paid add-on for all tiers?
2. **Rep accounts:** Only existing `subAccounts` role `sales`, or new role `crm_rep`?
3. **GPS on web:** Required for web-logged activities or mobile-only?
4. **Conversion metric:** % activities with result `closed` vs % clients in stage `closed`?
5. **Confirm phase order** — OK to ship mobile logging (phase 2) before admin map (phase 5)?

---

*Reply “confirm” with answers to §12 (or defaults) to start Phase 0.*

---

## Dropship supplier sync (Shein) — Phase 1 **done** (deploy functions to use API)

**Scope (locked from user):** Product-by-product dropshipping. Paste **Shein product URL** per Grabio product. Auto-update **stock visibility** (`inStock` / optional `stock`). **No bulk catalog** for now. Image URL field stays for **direct image** or upload — supplier link is a **separate field**.

**Platform v1:** `shein.com` only. Other suppliers later.

### Problem today
- Users paste Shein page URL into **Image URL** → broken `<img>` (HTML page, not image).
- No `supplierProductUrl` on `Product`. Stock is manual in Firestore only.

### MVP (Phase 1 — ship first)
| Layer | Work |
|-------|------|
| **Types** | `supplierPlatform`, `supplierProductUrl`, `supplierSyncEnabled`, `supplierLastSyncAt`, `supplierLastSyncStatus`, `supplierLastSyncMessage`, `supplierExternalId` (parsed from URL) on `Product` |
| **Admin UI** (`AdminProducts`) | Field **“Shein product link”** + helper text. **“Sync now”** on add/edit. Status chip (OK / error / never synced). Do not use image field for supplier URL |
| **API** | `POST /dropship/sync-product` — auth = store owner; body `{ storeId, productId }` |
| **Service** | `functions/src/services/sheinProductSync.ts` — fetch page server-side, parse in-stock / sold-out; update `inStock` (+ optional `stock` 0/1). On first sync if `image` empty, try `og:image` → set `image` (best-effort) |
| **Rules** | Owner can write supplier fields on own `products`; sync via Admin SDK only |

**UX:** Owner sets Grabio **sell price** manually (margin). Sync touches **availability** (and optional cost hint later), not auto-pricing v1.

### Phase 2 (after MVP works on real URLs)
- Scheduled job (e.g. every 6h): all products with `supplierSyncEnabled` + valid Shein URL for that `storeId`
- Rate limit + per-product error logging (`supplierSyncLogs` subcollection or field)
- Admin list filter: “Dropship products”

### Phase 3 (optional later)
- AliExpress / Temu parsers; bulk CSV import; webhook from partner

### Risks / limits (disclose to user)
- Shein has **no official seller API** → HTML parsing **breaks** when they change layout or block bots.
- **ToS / legal:** store owner responsible for reselling / image use.
- **Images:** hotlinking Shein CDN may fail; prefer upload or sync-copied image to Firebase Storage on first successful sync.
- If parser fails → product unchanged + clear error on **Sync now** (no silent wrong stock).

### Decisions before build
1. **Sync frequency default:** manual only (Phase 1) OK? Or include 6h schedule in first release?
2. **Out of stock on Shein:** hide product (`inStock: false`) or show with “Unavailable” badge?
3. **Add-on gate:** free for all sellers or paid add-on later?

### Test plan (after build)
1. Add product with Shein URL in new field + real image upload.
2. **Sync now** → `inStock` matches Shein page (test in-stock + sold-out SKU).
3. Storefront: out-of-stock hides Add to cart (existing `ProductCard` behavior).
4. Break parser (bad URL) → error message, no data wipe.

*Phase 2 (scheduled 6h sync) not started.*

### Phase 1 shipped
- [x] `Product` supplier fields + `src/lib/dropship.ts`
- [x] `POST /dropship/sync-product` + `sheinProductSync` service
- [x] Admin Products: compact dropship row (supplier dropdown: Shein / Alibaba / Amazon + URL). Sync button Shein-only.
- [x] Link stored for all three suppliers; auto-sync still Shein-only (best-effort, often blocked by Shein)

---

### Phase 4 — Shopify-style official dropship (planned — paid OK)

**Goal:** Match Shopify dropshipping UX: paste supplier URL → import title, images, description, variant/stock signals, margin rules, and scheduled sync — not link-only storage.

| Track | Approach | Notes |
|-------|----------|--------|
| **Shein / consumer URLs** | Paid scraper or browser API (ScrapingBee, Oxylabs, Apify, etc.) | Budget ~$50–250+/mo by volume; wire into `POST /dropship/sync-product` + optional import endpoint |
| **Alibaba** | Alibaba Open Platform / authorized partner APIs where available | Seller/partner onboarding; may differ from consumer product URLs |
| **Amazon** | Amazon SP-API (Product Advertising / seller APIs per use case) | Requires Amazon developer + compliance; not consumer scrape long-term |
| **Grabio product** | Optional **Dropship add-on** (subscription) to cover API credits + maintenance | UI: one compact supplier row (done); expand to “Import from supplier” + auto sync schedule |

**Deliverables (when approved):**
- [ ] `POST /dropship/import-product` — metadata + images to Firebase Storage
- [ ] Scheduled sync (6h) per linked SKU
- [ ] Alibaba + Amazon sync adapters (official APIs preferred over HTML scrape)
- [ ] Admin: import preview, margin multiplier, map variants
- [ ] Billing: add-on or tier inclusion for scraper/API pass-through

**Status:** UI v1 compact + multi-supplier link storage **done**. Full Shopify-parity sync **backlog — confirm budget for scraper/API before build.**

---

## SYSTEM PARADIGM SHIFT: MODULAR "ODOO-STYLE" ARCHITECTURE

**Status:** Backlog item saved. Await user instructions for step-by-step technical implementation.  
**Instruction:** Index only — no code changes or refactoring until explicitly approved.

### Vision

Grabio is transitioning from separate "doors" (Commerce / Finance / Builder) into a **unified core engine with installable modules**. Features must be decoupled to eliminate duplication, using **tenant-level feature flags** (`storeProfiles.addons` / `enabledModules`) to show/hide modules dynamically.

### Architectural pillars

| Pillar | Principle |
|--------|-----------|
| **Unified core** | One tenant engine (auth, store profile, permissions, billing) — not parallel siloed apps |
| **Installable modules** | Commerce, Finance, CRM, Production, POS, etc. as opt-in modules with clear boundaries |
| **Feature flags** | Per-store `addons` / `enabledModules` gate routes, nav, APIs, and mobile surfaces |
| **Decoupling** | Shared types and services at core; module-specific UI and workflows stay isolated |
| **No duplication** | Single source of truth per domain (inventory, orders, customers, billing) |

---

### 1. Platform architecture & platforms

| Surface | Target | Notes |
|---------|--------|-------|
| **Grabio POS** | Cross-platform | Windows, Apple macOS/iOS, and mobile — shared core, platform-native shells where needed |
| **Admin Android app** | Mobile | Unified store management (current `grabio-mobile` owner path evolves here) |
| **Invoice Manager mobile app** | Standalone | Dedicated accounting / billing workflow — decoupled from full admin |
| **White-label storefront mobile app** | Client-facing | Per-tenant e-commerce (`white-label-client-app` pattern) — customer/buyer experience |

### Planned modules — add later (implementation TBD)

Owner will add these **after** core modular foundation is in place. **No build started** — study implementation approach first.

| Module ID (proposed) | Name | Intent | Status |
|---------------------|------|--------|--------|
| `pos` | **Grabio POS** | Cross-platform point of sale (Windows, macOS/iOS, mobile); ties to restaurant production mode for live ingredient deduction | **Planned — study later** |
| `invoice_manager` | **Invoice Manager** | Standalone mobile app for accounting / billing workflow; decoupled from full admin | **Planned — study later** |
| `blog_publisher` | **Publisher (Blog)** | Tenant blog / content publishing module (CMS-style) | **Planned — study later** |
| `ai_builder` | **AI Builder** | AI-assisted store / page / content builder module | **Planned — study later** |

**Notes (locked for now):**
- These four modules are **explicitly deferred** — document and backlog only until implementation strategy is chosen.
- Study topics before build: shared `@grabio/core` package, module manifest, billing (plan vs add-on), and which surface hosts each module (web / mobile / desktop).
- Existing shipped modules (e.g. Sales CRM, dropship) remain as-is; new modules plug into the same `addons` / `enabledModules` pattern when ready.

**Backlog implications:**
- [ ] Define module manifest schema (id, version, required core version, permissions, routes)
- [ ] Centralize feature-flag resolution (web + mobile + functions)
- [ ] POS: evaluate React Native / Electron / Tauri for Windows + macOS + iOS from one codebase
- [ ] Split admin vs invoice vs storefront mobile apps with shared `@grabio/core` package (future)
- [ ] Document tenant onboarding: which modules ship by plan vs add-on
- [ ] **POS** — study stack (RN / Electron / Tauri), offline mode, hardware (receipt printer, barcode)
- [ ] **Invoice Manager** — study scope vs existing invoices (`invoiceTemplates`, account statement) and mobile split
- [ ] **Blog Publisher** — study content model (posts, categories, SEO, public routes per store)
- [ ] **AI Builder** — study integration with existing AI settings (`api/ai`), guardrails, and white-label pages

---

### 2. Inventory & production typology

Three distinct product/production modes — **not interchangeable**; module logic must branch on `productType` + production mode.

#### 2.1 Composed products — Manufacturing

Full **Bill of Materials (BOM)**, step-by-step **production runs**, tracking **raw materials → finished goods** inventory.

- [ ] BOM editor (raw materials + quantities per finished unit)
- [ ] Production run workflow (draft → in progress → complete)
- [ ] Deduct raw materials on completion; credit `finishedGoodsInventory`
- [ ] Align with existing `AdminProduction` / `finishedGoodsInventory` collections

#### 2.2 Composed products — Restaurant

**Fast-tracked live production** — deducts ingredients / sub-components **immediately on transaction** without a separate manufacturing phase or finished-goods inventory records.

- [ ] POS / order line triggers instant ingredient deduction
- [ ] No production run UI for restaurant mode
- [ ] Recipe = BOM used only at sale time (not batch manufacturing)
- [ ] Flag on product or store: `productionMode: 'manufacturing' | 'restaurant'`

#### 2.3 Simple & composed services

Standalone or **bundled service items** with flexible subscription billing:

- [ ] Monthly and yearly billing cycles (align with `serviceSubscriptions` / `checkSubscriptions`)
- [ ] Service bundles (composed services) as sellable packages
- [ ] Renewal reminders + enforcement per existing subscription jobs

---

### 3. Cross-cutting requirements (all modules)

- [ ] Module registry in Firestore or config: enabled modules per `storeId`
- [ ] Nav / route guards read same flags on web, mobile, and Cloud Functions
- [ ] Deprecation plan for legacy "door" naming in UI and docs
- [ ] Migration: map current features (CRM, dropship, marketplace) to module IDs

---

### 4. Implementation status

| Item | Status |
|------|--------|
| Paradigm documented in backlog | **Done** (this section) |
| Core module manifest + feature-flag service | **Not started** |
| **POS** (`pos`) | **Planned — add later; implementation study pending** |
| **Invoice Manager** (`invoice_manager`) | **Planned — add later; implementation study pending** |
| **Blog Publisher** (`blog_publisher`) | **Planned — add later; implementation study pending** |
| **AI Builder** (`ai_builder`) | **Planned — add later; implementation study pending** |
| White-label storefront app split | **Partial** (`white-label-client-app` exists) |
| Manufacturing vs restaurant production modes | **Not started** (manufacturing path partially exists) |
| Service subscription billing (monthly/yearly) | **Partial** (backend jobs exist) |

---

## Pricing page ↔ modular platform alignment

**Status:** Public `/pricing` UI updated (display-only package builder). **Billing logic unchanged** — still tier + existing add-ons (`domainPackage`, `whatsappBusiness`, `salesCrm`, `extraStorage`).

### Done (UI only)
- [x] `src/lib/pricingDisplay.ts` — module catalog + estimate calculator (mirrors home page groups)
- [x] `src/pages/public/Pricing.tsx` — toggle modules, live total, signed-in pre-fill from `storeProfiles`
- [x] Copy aligned with home: Platform Features / Apps / AI; extras billed separately

### Backend / product — still needed (do not treat UI toggles as entitlements yet)
- [ ] **Single source of truth:** Share `PRICING` / `PLAN_LIMITS` / module registry between `Pricing.tsx`, `Subscription.tsx`, `functions/src/api/subscription.ts`
- [ ] **Per-module billing:** Bill optional platform modules (Inventory, Dropship, PSA, etc.) when product owner sets prices — today only 4 add-ons charge
- [ ] **Entitlements:** Map each `grabio_*` module ID to `storeProfiles.addons` / `enabledModules` and enforce in nav, routes, Cloud Functions, mobile
- [ ] **PSA (`projects`):** Define add-on price and Stripe line item when module launches
- [ ] **AI tools:** Document credit vs tier limits; align public copy with `AdminProfile` model pricing
- [ ] **Trial vs Starter product limit (10 vs 8):** Resolve in limits or FAQ — avoid customer surprise at upgrade

*Rule until backend work ships: pricing page toggles are estimates + planning; checkout remains Subscription admin only.*

---

## Guides & sales docs — update for modular platform

**Status:** Public marketing pages updated (home, pricing, features, use cases, blog shell, about). **Owner/sales guides still reflect old “all-in-one POS” story.**

### Files to review and refresh
- [ ] `public/store-owner-guide.html` — modular modules, Admin Android app, CRM add-on, AI tools, planned POS/PSA
- [ ] `public/sg.html` / `public/sales-guide.html` — pitch, module list, add-on pricing (CRM $15, domain, WhatsApp, storage)
- [ ] `docs/templates/TEMPLATE_UPDATES.md` — cross-links if guide URLs or messaging change
- [ ] Align guide terminology with home: **Platform Features** / **Apps** / **AI Tools**; Live / Beta / In development; “extras billed separately”
- [ ] Remove or reframe POS as **planned** (Windows + mobile), not core live product
- [ ] Add **Build your package** flow (`/pricing` toggles) for sales conversations
- [ ] Mobile Admin App (Google Play) + one sign-in / one account messaging

### Acceptance
- [ ] Sales team can pitch modular stack without contradicting `/home`, `/features`, `/pricing`
- [ ] Store-owner guide module list matches `src/lib/pricingDisplay.ts` / `MODULE_CATALOG`

---

## In-app hint system (onboarding / contextual help)

**Goal:** Help owners and staff discover modules and complete setup without leaving the app — especially after modular UI rollout.

### Scope (plan — not built)
- [ ] **Web admin:** Contextual hints/tooltips on first visit per screen (dashboard, products, CRM, subscription, etc.)
- [ ] **Mobile (Admin app):** Same pattern — highlight key actions (orders, inventory, CRM rep flow)
- [ ] **Hint types:** one-time coach marks, dismissible banners, optional “?” on complex forms
- [ ] **Persistence:** per-user `hintsSeen` or `onboardingProgress` on `users` / `storeProfiles` (avoid re-showing dismissed hints)
- [ ] **Module-aware:** Only show CRM hints if `salesCrm` add-on active; hide manufacturing hints if tier/plan doesn’t allow
- [ ] **Settings:** “Show tips again” in profile or help section

### Product decisions needed before build
1. Hints for **all users** vs **store owner only**?
2. **Arabic + English** copy from day one?
3. Third-party tour library (e.g. driver.js) vs custom lightweight component?

### Suggested phases
| Phase | Deliverable |
|-------|-------------|
| 1 | Hint registry (id, route, module gate, copy) + dashboard + subscription screens |
| 2 | CRM + mobile admin key screens |
| 3 | Rep portal + optional analytics on hint completion |

---

## Session wrap — 2026-06-24 (enforcement live)

### Confirmed working (owner sign-off)
- [x] Module gates: y.malek CRM allowed (legacy `salesCrm` add-on); moove shop package blocks CRM/POS/factory — expected
- [x] Frontend + Functions enforcement ON prod (`VITE_ECOSYSTEM_ENFORCE_MODULES`, `ECOSYSTEM_ENFORCE_MODULES`)

### Deferred (not now)
- [ ] **Refund by product/qty (not dollar amount)** — current money-based partial refund causes fractional restore skips and receipt confusion; redesign: pick line items + qty to return, derive refund total from lines
- [ ] **Public `/pricing` page overhaul** — modular story, preset clarity, de-dupe with `/subscription` builder; schedule after recording review
- [ ] **Shop → Factory package upgrade UX** — preset switch duplicates some module rows; works but needs cleaner diff/merge UI on Subscription + onboarding

### Bugs fixed this session
- [x] `SalesReturns.tsx` — `allOrders is not defined` crash (missing state)
- [x] `announcements` Firestore rules missing → dashboard `Failed to fetch admin stats` on deny-by-default
- [x] Subscription + package onboarding — **Back to store profile** link

### Recording Part C (simple)
1. Stay on https://grabio.space (or staging channel)
2. Sign out moove → sign in **y.malek@nip-lb.com**
3. Open `/admin/crm` — should **load** (not gate card)
4. Optional: sign out → moove → `/admin/crm` blocked again

---

## Session wrap — 2026-06-21

### Done today
- Modular home (`/home`), pricing package builder (UI only), features / use cases / blog / about aligned with module story
- Mobile nav fix: home hamburger menu; PublicNav full-width mobile CTAs
- Backlog: pricing ↔ backend alignment notes; guides refresh; hint system planned

### Next session (when resuming)
1. Update owner + sales guides (section above)
2. Pricing/backend single source of truth (if moving beyond UI-only)
3. Hint system Phase 0 — registry + 2–3 pilot screens

---

*Next step: Owner will study implementation approach for POS, Invoice Manager, Blog Publisher, and AI Builder before any code. No module build until strategy is confirmed.*

