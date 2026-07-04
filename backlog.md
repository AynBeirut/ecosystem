# Backlog — Grabio / Market Flow

---

## Workstream B — Invoice Manager native embed (2026-06-23 — **awaiting file-list approval**)

**Direction (locked by owner):** Invoice Manager is a **feature inside Grabio admin**, not a linked app.  
**Web primary routes:** `/admin/finance/*` (same tab, `AdminLayout`).  
**Standalone `/invoice/`:** Kept for **TWA / Play Store** build only; session-aware (skip Hero when authed).  
**Deploy gate:** No hosting deploy until owner approves file list below.

### Supersedes (Workstream A web scope)
- ~~Standalone web SPA chrome at `/invoice/` as primary UX~~ → embed in admin
- ~~`user.company` in localStorage as profile source~~ → `storeProfiles/{storeId}` only
- ~~IM Company Profile screen~~ → Admin Profile only; IM reads company fields

### Locked decisions
| # | Decision |
|---|----------|
| 1 | **SHIP:** Finance build copies to `dist/invoice/` on every root hosting build |
| 2 | **SESSION:** Firebase session from Grabio → skip IM login/Hero; Finance Suite links same-tab |
| 3 | **PROFILE:** Single doc `storeProfiles/{storeId}`; fix `name`/`phone`/`email`/`location`/`logo` mapping |
| 4 | **KEEP:** IM PDF/document templates (basic/modern/professional), line items, document styling |
| 5 | **CHROME:** Render inside `AdminLayout` + `FinanceModuleShell` sub-nav; `templateColors` for accent UI |

### Document vs company field split (no duplication)
| Data | Source | Edited in |
|------|--------|-----------|
| Company name, address, phone, email, logo | `storeProfiles` top-level fields (same as Admin Profile) | **Admin Profile only** |
| PDF template style + doc accent colors | `storeProfiles.financeDocumentSettings` (new, optional) | IM screens (Settings or per-doc) — **not** a second company profile |
| Admin `invoiceTemplate` (modern/classic/vibrant) | Existing storefront field | Unchanged; IM PDFs use IM template engine |

### Architecture (target)

```
Grabio main SPA (/admin/*)
  AdminLayout (store theme via templateColors CSS vars)
    FinanceModuleShell  ← like CrmModuleShell
      FinanceAppBridge  ← finance AppContext, no duplicate AuthProvider
        InvoiceManager / EstimateManager / …  (no AppLayout when embedded)

Standalone build (dist/invoice/) — TWA / Play Store
  Session skip → /invoices
  Minimal chrome; link to grabio.space/admin/finance optional
```

### Implementation phases

| Phase | Scope | Est. | Depends |
|-------|--------|------|---------|
| **B1 — SHIP** | Wire `build:invoice` into root build; copy artifact to `dist/invoice/`; verify `firebase.json` rewrite; document deploy script | **0.5 d** | — |
| **B2 — SESSION** | Same-tab entry from Finance Suite; IM `Index`/`AuthGuard` skip Hero when `auth.currentUser`; redirect authed users to `/invoices` (standalone) or `/admin/finance/invoices` (embedded) | **1 d** | B1 for prod smoke |
| **B3 — PROFILE** | Fix `storeProfileToCompany()` + `companyToStoreProfilePatch()`; remove `localStorage` `user.company` authority; hide/remove `/profile` route + nav; PDFs read company from live `storeProfiles`; backfill Indigo doc (`storeName` → `name`) | **1.5–2 d** | — |
| **B4a — CHROME infra** | `FinanceModuleShell`, `FinanceAppBridge`, Vite alias `@invoice-app`, embed context, single Firebase singleton, `moduleRouteMap` + admin nav | **2–3 d** | B2, B3 |
| **B4b — CHROME pages** | `FinancePageShell` (skip `AppLayout` when embedded); refactor ~20 IM pages; sub-nav (Invoices, Estimates, Receipts, Clients, Products, Reports, …); apply `templateColors` to accents | **3–4 d** | B4a |
| **B5 — QA + backfill** | Staging smoke checklist; deprecate placeholder `FinanceEstimates`/`FinanceReceipts` shells or redirect to IM routes | **0.5 d** | B4b |

**Total (rough):** **8–11 dev days** (one engineer). B1–B3 can ship incrementally before B4b completes.

### Files to touch (approval list)

**Root / tooling**
- `package.json` — add `build:invoice`, chain in `build`
- `the eco sys/finance/scripts/deploy-invoice.sh` — align with root build
- `firebase.json` — verify `/invoice/**` rewrite (no change expected)
- `scripts/backfillStoreProfileName.ts` — **new** (Indigo + any `storeName`-only docs)
- `backlog.md`, `conversation.md` — status updates

**Main Grabio (`src/`)**
- `src/App.tsx` — nested `/admin/finance/*` routes under `AdminLayout`
- `src/pages/admin/AdminFinanceSuite.tsx` — same-tab links, remove `target="_blank"`
- `src/pages/admin/finance/FinanceModuleShell.tsx` — **new**
- `src/embed/FinanceAppBridge.tsx` — **new** (finance providers + embed flag)
- `src/hooks/useFinanceEmbed.ts` — **new**
- `src/lib/financeCompany.ts` — **new** (shared mappers)
- `src/types/storeProfile.ts` — optional `financeDocumentSettings`
- `src/hooks/useAdminNavigation.ts` — finance sub-items
- `src/components/admin/AdminLayout.tsx` — page titles for finance routes
- `src/lib/moduleRouteMap.ts`, `src/lib/adminRoutePreload.ts`
- `src/pages/admin/finance/FinanceEstimates.tsx` — redirect or remove (replaced by IM)
- `src/pages/admin/finance/FinanceReceipts.tsx` — redirect or remove
- `src/pages/admin/finance/FinancePortfolio.tsx` — redirect or remove

**Invoice Manager (`the eco sys/finance/beirut-finance-flow-main/`)**
- `src/lib/grabio/storeService.ts` — field mapping fix
- `src/lib/grabio/types.ts` — align with main `storeProfile` fields
- `src/context/AppContext.tsx` — drop `user.company` authority; load company from Firestore
- `src/pages/Index.tsx` — session skip / redirect
- `src/components/AuthGuard.tsx` — embedded bypass
- `src/pages/CompanyProfile.tsx` — remove route or redirect to `/admin/profile`
- `src/components/AppLayout.tsx` — remove Company Profile nav; standalone-only chrome
- `src/components/FinancePageShell.tsx` — **new**
- `src/lib/branding.ts` — embedded uses store `templateColors`
- `src/App.tsx` — export embed-safe routes; drop `/profile` from nav
- `src/lib/pdfExport.ts`, `src/components/InvoiceTemplates.tsx`, `src/lib/documentLogic.ts` — read company from `storeProfiles` mapper (templates unchanged)
- **~20 pages** wrapping `AppLayout` → `FinancePageShell`: `InvoiceManager`, `EstimateManager`, `ReceiptManager`, `ClientsManager`, `SuppliersManager`, `ProductsManager`, `Inventory`, `Reports`, `Settings`, `ExpenseManager`, `PurchaseOrders`, `CompanyPortfolio`, `StaffManager`, `DeliveryManager`, `ProjectsManager`, `ProposalsManager`, `TasksManager`, `CurrencySettings`, `AdminDashboard`, `OrgMembers`, `PaymentMethods`, `SubUsers`, `PremiumUpgrade`

**Out of scope (this workstream)**
- Play Store / TWA resubmit
- Porting PSA Edge Functions
- Merging Grabio `financeService.ts` read-only shells with IM write paths (redirect only in B5)

### QA checklist (staging, before prod)
- [ ] `npm run build` produces `dist/invoice/index.html`
- [ ] `/invoice/invoices` loads when authed (standalone); no Hero
- [ ] `/admin/finance/invoices` loads inside admin sidebar (embedded)
- [ ] Admin Profile name change → IM invoice PDF header updates after refresh
- [ ] IM Company Profile route gone; no `localStorage` company overwrite on login
- [ ] Indigo backfill: `name` populated from `storeName`
- [ ] Module gate: `invoice_manager` still enforced

### Risks
1. **Dual Firebase clients** — embed must inject main `auth`/`db`, not finance `client.ts`
2. **Bundle size** — lazy chunks per finance route required
3. **Route basename** — embedded routes use `/admin/finance/...`; standalone keeps `/invoice/`
4. **TWA** — still opens `/invoice/`; may need post-login redirect copy update

#### Phase B1 — SHIP — **done (staging deployed)**
- [x] `build:invoice` + `copy-invoice-dist.cjs` → `dist/invoice/`
- [x] Root `build` chains invoice bundle
- [x] Staging: `https://market-flow-7b074--staging-7shveb2w.web.app` (2026-07-30)

#### Phase B2 — SESSION — **done (staging)**
- [x] `AdminFinanceSuite` same-tab `/invoice/invoices`
- [x] `Index` redirects authed users to `/invoices` (no Hero)

#### Phase B3 — PROFILE — **done (staging)**
- [x] `storeProfileToCompany()` reads `name`, top-level `phone`/`email`
- [x] `localStorage` no longer caches `user.company`
- [x] `/profile` → redirect to Grabio Admin Profile
- [x] Indigo backfill applied: `6UOoq0Tn8xhGUqBk5o0JMMKsgNN2` → `name: "Indigo Ecosystem Test"`

**Next:** B5 cleanup — QA embed routes + Firebase bridge session proof

#### Phase B4 — EMBED — **deployed staging (2026-06-23)**
- [x] **B4a infra:** `FinanceModuleShell`, `FinanceAppBridge`, `financeFirebaseBridge`, `FinanceEmbedContext`, `FinancePageShell`, Vite `@/` resolver (`vite-finance-alias.ts`), `moduleRouteMap` + nav → `/admin/finance/*`
- [x] **B4b core pages (6):** Invoices, Estimates, Receipts, Clients, Products, Reports via `FinanceEmbeddedPage` + dynamic loaders
- [x] Staging deploy: https://market-flow-7b074--staging-7shveb2w.web.app (expires 2026-07-30)
- [ ] **B4b polish:** `templateColors` accents on IM buttons; PSA/Staff/Delivery deferred
- [ ] **B4a proof:** Logged-in session — same `auth.uid` in main app + embedded IM (needs staging QA)

#### Phase POS — WINDOWS INTEGRATION — **active (Windows machine)**

**Handoff docs (send to builder):**
- `docs/planning/pos-windows-handoff.md` — repo structure, connection flow, QA
- `docs/planning/pos-sync-contract.md` — API contract (live vs planned)
- `docs/planning/cursor-new-machine-setup.md` — rules/skills on new PC
- `.cursor/rules/grabio-pos.mdc` — project rule for POS paths (in git)

**Platform (Linux — done / live):**
- [x] `POST /pos/pairing-code`, `/pos/pair`, `/pos/heartbeat` (`functions/src/api/posSync.ts`)
- [x] Admin `/admin/pos` pairing UI + installer link (`PosPairing.tsx`)
- [ ] `GET /pos/catalog` — pull products/recipes
- [ ] `POST /pos/orders` — push sale + stock sync

**POS app (Windows — builder):**
- [ ] Clone repo; open `the eco sys/ecosystem-plan/posfinal-main/pos-v1/`
- [ ] Add `js/grabio/grabio-pairing.js` — 6-digit code flow, store deviceToken
- [ ] Add `js/grabio/grabio-sync.js` — heartbeat; catalog/orders when API ready
- [ ] Keep `sync-manager.js` (legacy VPS) until Grabio path QA passes
- [ ] New Windows installer → Firebase Storage `pos/` or Play/internal distribution

**Cursor on Windows:** Personal COC (`~/.cursor/rules/anwar.mdc`) does **not** auto-sync — tar copy or private git (see cursor-new-machine-setup.md).

## Wizard Method step — MVP (**deployed prod 2026-07-04**)

**Status:** Live on production. Routing + overwrite prompt deployed.

### Locked decisions (shipped)
1. Flow: **Site type** → **Business type** (e-commerce only) → **Method** → build
2. **Method cards:** Classic | Theme Editor | WordPress | Import (disabled “Coming soon”)
3. **After Method:** Classic → `/admin/templates`; Theme Editor → `/admin/theme-editor`; WordPress → in-wizard request form
4. **Removed** old steps: `theme`, `page-design`, `products`, `customize`, `preview`, `publish`
5. **Overwrite prompt:** `BuilderMethodGuard` on Classic + Theme Editor routes

### QA on staging after deploy
- [ ] Wizard: Display / Blog / E-commerce paths → Method → correct destination
- [ ] WordPress: Method → request form → submit
- [ ] Import card disabled
- [ ] Switch editor: Theme Editor → Classic → confirm dialog → Continue updates `buildMethod`

---

## Autonomous session — 2026-06-23 (**deployed prod 2026-07-04**)

### ⚠️ BUILDER REPLAN v2 (2026-06-29) — Shopify screenshots

**Wireframe `ShopifyStylePageEditor` ≠ Shopify feeling.** Real target = **full-screen theme editor** with **live iframe preview** + **Header/Template/Footer section tree** (see screenshots).  
Full analysis: **`docs/planning/unified-builder-replan.md`** (v2). Confirm **T0–T4** before more code.

### Deployed prod (2026-07-04)
- **M1 Store Builder** (`/admin/builder`) — wizard, entitlements fix, sanity script passes
- **Subscription** — live “Manage modules” panel for active subscribers (Web Builder toggle, etc.)
- **Part 4a** — builder demo slots **5 → 2** (`BUILDER_MAX_DEMO_SLOTS`)
- **Part 1b L1** — `publicReadCache.ts` on Marketplace store/product lists (60s TTL)
- **Part 1 docs** — `docs/planning/firebase-cost-guardrails.md` (GCP budget runbook, rules myth)
- **Part 3** — WordPress flow: wizard branch → `wordpressProvisioningRequests` + `/admin/wordpress-queue`
- **Part 2 scaffold** — `r2Upload.ts` (disabled until R2 presign API + env flag)

### You should still do manually
1. **GCP budgets** — $10 / $25 / $50 alerts (see cost guardrails doc)
2. **Firestore** — create `platformConfig/grabio` with `{ opsUids: ["<your-uid>"] }` for WP ops queue
3. **E2E** — `/subscription` Manage modules, `/admin/builder`, WordPress request submit

### Deferred until explicit approval
- R2 live uploads + migration
- L2 CDN cache headers / read-through API
- Builder storage metering (500MB + overage)
- B2 builder phase

---

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

## Admin UI unification — 2026-06-26 (in progress)

### Done
- [x] Shared `AdminLayout` (dark sidebar, footer, mobile ops strip) wraps **all** `/admin/*`, `/subscription`, `/team/dashboard`
- [x] `useAdminNavigation` — single menu source (matches dashboard sidebar list)
- [x] `AdminPageHero` — compact dark header for inner pages
- [x] Bulk shell class pass: `min-h-screen bg-gray-50` → `space-y-6` on admin pages
- [x] CRM shell restyled; Inventory page uses `AdminPageHero` (pilot)

### Remaining (per-page)
- [x] Batch 3 (8 pages): `AdminPageShell` + `AdminPanel` / `AdminStatCard` / `AdminNavCard` body restyle
- [x] Batch 2 body pass: `AdminPanel` on all 28 header-only pages (Orders, Purchases, Products, etc.)
- [x] Batch 3 body pass: `AdminPanel` + `AdminStatCard` / `AdminNavCard` on inventory cluster
- [x] Batch 4: remaining legacy pages → `AdminPageShell` + `AdminPanel` (Whitelabel, Finance sub-pages, AI tools via `AiToolPage`, Product Reviews, Order Notifications, Crawl Audit, CRM shell, SubAccount dashboard, Subscription, AI Builder, Blog Publisher, POS Pairing, Projects, supplier skeleton pages)
- [x] Batch 5: add `AdminStatCard` KPI rows to high-traffic Batch 2 pages (Orders, Purchases, Customers, Payments, Analytics, Revenue)
- [ ] Add `AdminPageHero` to every admin page (replace legacy h1 + BackButton + MobileHeader) — **mostly done via Batch 4; `AdminDashboard` keeps custom hero**
- [ ] Remove duplicate `MobileHeader` / `BackButton` where layout covers nav
- [ ] SubAccountDashboard — align with dashboard home stat cards
- [ ] Blank-page audit: module gates (`requiredModule`), lazy chunk errors, missing Firestore indexes
- [ ] Slow pages: Orders, Purchases, Account Statement — profile queries / pagination

---

*Next step: Owner will study implementation approach for POS, Invoice Manager, Blog Publisher, and AI Builder before any code. No module build until strategy is confirmed.*

---

## Builder accounts + demo stores (Phase 1–3)

**Status:** Phase 1 in progress (security/foundation). Phase 2/3 not started.

### Locked decisions (2026-06-23)
- **Demo preview:** token-link URL only — no subdomain/DNS
- **Billing:** per-store on `storeProfiles/{newStoreId}` (Option A); `subscription.ts` must accept explicit `storeId` on transfer (do not assume `userId === storeId`)
- **Existing clients:** additional store under same UID — requires `users/{uid}.ownedStoreIds[]` + `activeStoreId` + `ownerId` on `storeProfiles/{newStoreId}` (Phase 2)
- **Demo schema:** isolated `builders/{builderUid}/demoStores/{demoId}` — never top-level `products`/`orders`/`storeProfiles` for demos
- **Builder scope:** templates, products (catalog), branding, blog/content, SEO — online-presence tier; admin may grant AI/CRM extras
- **Commerce block:** `isRealStore(storeId)` — profile exists, `isDemo !== true`, `subscriptionStatus` in `active|trial|grace` or unset (legacy)
- **Deploy gate:** no prod deploy without owner literal **"approved"** against exact file list

### Phase 1 — security/foundation (**deployed prod 2026-07-04**)
- [x] `builders/{uid}/demoStores/{demoId}` Firestore rules
- [x] `isRealStore(storeId)` on commerce collections + fix loose products/orders/subAccounts/purchaseOrders rules
- [x] Server guards: checkout, stripe/square/omt/bob, crmOrderSync, ai.ts, posSync, marketing.ts, subscription.ts
- [x] Emulator test matrix (`npm run test:builder-phase1`) — 8/8 unit + 19/19 rules (2026-06-26)

### Phase 2 — MVP (after Phase 1 validated)
- Builder signup, 5-slot demo CRUD, scoped admin UI, token preview, manual admin transfer, multi-store owner index

### Phase 3 — automation (after MVP with real builder partners)
- Email invite, payment-gated transfer, builder → editor sub-account, 1-month expiry, admin grant extras UI

---

## Workstream A — Grabio Invoice Manager (Play Store + ecosystem)

**Status:** **Approved** — Phase A0 in progress (2026-06-27).  
**URL:** `https://grabio.space/invoice`  
**Scope v1:** **Option 2 — full finance app**  
**Code root:** `the eco sys/finance/beirut-finance-flow-main/` only.  
**Do not mix:** Grabio admin (`src/pages/admin/*`), `grabio-mobile/`, `white-label-client-app/`.

### Locked decisions (2026-06-23)
| Decision | Value |
|----------|--------|
| Product | Standalone **Play Store** app — quick invoicing + full finance suite |
| Domain | **`grabio.space/invoice`** |
| Backend | **Firebase** `market-flow-7b074` — **not** Supabase in production |
| Auth | **Firebase Auth** — same account as Grabio web/mobile |
| Tenant key | **`storeId`** from `storeProfiles` — replaces Supabase `organization_id` |
| Module gate | `invoice_manager` + `invoicing` via `enabledModules` / legacy tier (same pattern as CRM) |
| Upgrade path | User adds online store / CRM / POS later → **same data, no migration** |
| Legacy Supabase | `aynbeirut.dev` users stay on Supabase until optional import; **new ecosystem users = Firebase only** |
| Play package | `space.grabio.finance` (distinct from `space.grabio.app`) |

### Architecture

```
Firebase Auth (grabio.space)
       │
       ▼
storeProfiles/{storeId}  ←── module gate, company branding, subscription
       │
       ├── customers/{id}           ← clients (shared with CRM + orders)
       ├── products/{id}            ← catalog (finance fields + listedInStore flag)
       └── stores/{storeId}/
             ├── financeInvoices/{id}
             ├── financeEstimates/{id}   (exists in rules — extend)
             ├── financeReceipts/{id}    (exists in rules — extend)
             ├── financePayments/{id}
             ├── financeExpenses/{id}
             ├── financeSuppliers/{id}
             ├── financePurchaseOrders/{id}
             ├── financeInventoryMovements/{id}
             ├── financeProjects/{id}
             ├── financeProposals/{id}
             ├── financeTasks/{id}
             ├── financeTimesheets/{id}
             ├── financeCurrencySettings/{id}
             ├── financePaymentMethods/{id}
             ├── financeActivityLogs/{id}
             └── financeMembers/{id}      ← sub-users / co-admin (replaces org_members)
```

**Company profile:** read/write `storeProfiles/{storeId}` (name, logo, address, tax, invoice template) — drop Supabase `organizations` table.

**Shared collections strategy (no migration on module add):**
- **Clients** → top-level `customers` with `storeId` (+ optional `financeClient: true`)
- **Products** → top-level `products` with `storeId`, `listedInStore: false` until `marketplace` module on; finance UI uses `salePrice`/`costPrice` mapping
- **Finance documents** → `stores/{storeId}/finance*` subcollections (invoices, estimates, receipts, PO, expenses, PSA)

### Supabase → Firestore port map

| Supabase table | Firestore target |
|----------------|------------------|
| `organizations` | `storeProfiles/{storeId}` |
| `organization_members` | `stores/{storeId}/financeMembers/{uid}` + Grabio `subAccounts` where applicable |
| `clients` | `customers` |
| `products` | `products` (adapter for Grabio vs finance field names) |
| `suppliers` | `stores/{storeId}/financeSuppliers` |
| `invoices` + `invoice_items` | `stores/{storeId}/financeInvoices` (lineItems embedded) |
| `estimates` + `estimate_items` | `stores/{storeId}/financeEstimates` |
| `receipts` | `stores/{storeId}/financeReceipts` |
| `payments` | `stores/{storeId}/financePayments` |
| `expenses` | `stores/{storeId}/financeExpenses` |
| `purchase_orders` | `stores/{storeId}/financePurchaseOrders` |
| `inventory_movements` | `stores/{storeId}/financeInventoryMovements` |
| `projects`, `proposals`, `tasks`, `timesheets` | `stores/{storeId}/financeProjects` etc. |
| `currency_settings` | `stores/{storeId}/financeCurrencySettings` |
| `payment_methods` | `stores/{storeId}/financePaymentMethods` |
| `activity_logs` | `stores/{storeId}/financeActivityLogs` |
| `user_backups` (encrypted sync) | Firebase Storage `stores/{storeId}/financeBackups/{uid}.enc` or Firestore doc |
| Stripe/PayPal webhooks | Port to `functions/src/api/financeWebhooks.ts` (Cloud Functions) |

### Repo touch boundaries

| Location | Allowed change | Deploy gate |
|----------|----------------|-------------|
| `the eco sys/finance/beirut-finance-flow-main/**` | Primary — auth, data layer, branding, PWA, Capacitor/TWA shell | Separate build artifact |
| Root `firestore.rules` + `firestore.indexes.json` | Finance subcollection rules + indexes | Owner **"approved"** |
| Root `firebase.json` | Second hosting site `finance` → `finance.grabio.space` | Owner **"approved"** |
| Root `functions/src/api/*` | Webhooks, optional module gate for finance API | Owner **"approved"** |
| `src/pages/admin/finance/*` | **Out of scope v1** — reads same Firestore later | — |
| `grabio-mobile/`, white-label | **Forbidden** | — |

### Implementation phases

#### Phase A0 — Foundation (week 1) — **in progress**
- [x] Add `src/integrations/firebase/` + `.env.local.example`
- [x] Replace Supabase Auth in `Index.tsx` / `AppContext` with Firebase Auth + Google redirect
- [x] `useGrabioStore()` — resolve `storeId` from Firebase user + `storeProfiles`
- [x] `InvoiceModuleGate` — read `enabledModules` / legacy tier
- [x] Scaffold `src/lib/firestore/firestoreOps.ts` + `paths.ts`
- [x] Document schema in `the eco sys/finance/docs/firestore-schema.md`
- [x] Vite `base: /invoice/` + PWA scope; `firebase.json` rewrite for `/invoice/**`
- [ ] Local smoke: Firebase login → store bootstrap → dashboard (needs `.env.local` keys)

#### Phase A1 — Core billing data (weeks 2–3) — **deployed 2026-06-27**
- [x] Port: clients → `customers`, products → `products` (field adapter + mappers)
- [x] Port: invoices, estimates, receipts, payments, expenses, suppliers, POs
- [x] Replace `AppContext` load/save via `dbOps.ts` (Firestore default; Supabase legacy flag)
- [x] Firestore rules for A1 collections — **live prod**
- [x] Hosting `grabio.space/invoice` — **live prod**
- [ ] Prod smoke: sign in → create client → create invoice → refresh
- [ ] IndexedDB offline queue → Firestore sync (deferred to A2 polish)

#### Phase A2 — Operations + inventory (week 4)
- [x] Port: inventory movements, composed products, stock deduction logic (via A1 `dbOps` → Firestore)
- [x] Port: delivery manager, staff, currency settings, payment methods → Firestore
  - `useFinanceTable` + `financeCurrencySettings`
  - `paymentMethodsService` + `financePaymentMethods`
  - `AccountingContext` → `financeStaff`, `financeDelivery*`, `financeOperationalExpenses`, `financeSettings/cashBalance`
  - Firestore rules + hosting **deployed prod** (Jun 27)
- [x] PDF + email: client-side print-to-PDF + mailto handoff (documentLogic)
- [x] Privacy policy link in Settings; InstallPWA Play Store copy
- [x] Prod deploy: polish + assetlinks.json live

#### Phase A6 — Play Store (started)
- [x] Release keystore + `.credentials.md`
- [x] `public/.well-known/assetlinks.json` → live on grabio.space
- [x] `twa/twa-manifest.json` + `docs/PLAY_STORE.md` (listing copy, data safety, release steps)
- [x] `twa/build-twa.sh` — run locally to generate AAB
- [ ] Feature graphic 1024×500 + phone screenshots
- [ ] `./build-twa.sh` → upload AAB to Play Console internal testing
- [ ] Play review → production

#### Phase A3 — PSA / projects (week 5)
- [ ] Port: projects, proposals, tasks, timesheets, PSA invoice sync
- [ ] Port or replace Supabase Edge Functions: `generate-proposal`, `psa-retry-timesheets` → Cloud Functions

#### Phase A4 — Admin + org features (week 6)
- [ ] Port: sub-users / financeMembers, org members UI, admin dashboard, reports
- [ ] Port: premium/subscription UI → read Grabio `storeProfiles` subscription (drop standalone Stripe unless add-on billing separate)
- [ ] Activity logs, export menus, SIM import (point at Firestore)

#### Phase A5 — Hosting + branding (week 7)
- [x] Rebrand: manifest, login copy, icons → **Grabio Invoice Manager**
- [x] `/.well-known/assetlinks.json` on grabio.space for TWA
- [x] Privacy policy URL → `grabio.space/privacy` (existing)
- [ ] Build pipeline: finance app → deploy script `scripts/deploy-invoice.sh`

#### Phase A6 — Play Store (week 8) — see also "Play Store (started)" above
- [x] Bubblewrap TWA → `grabio.space/invoice`
- [x] Package `space.grabio.finance`, signing keystore, Play Console listing doc
- [ ] Internal testing track → closed testing → production

### Testing checklist (before Play release)
- [ ] New user: Firebase signup → auto `storeProfiles` doc → create invoice → visible in Firestore emulator
- [ ] Existing Grabio store owner: same login → finance app loads existing `customers` / `products`
- [ ] Enable `marketplace` module on test store → finance products appear in admin Products (no import)
- [ ] Module gate: store without `invoice_manager` → upgrade CTA, no writes
- [ ] Offline: create invoice offline → sync on reconnect
- [ ] Physical Android: TWA install, Google sign-in, create + PDF invoice

### Risks / open items
1. **Product schema gap** — Grabio `products` has commerce fields (image, slug, deliveryTime); finance app must write sensible defaults or use `listedInStore: false` until listed
2. **Sub-users** — finance `subUsers` vs Grabio `subAccounts` — align on `subAccounts` permissions for finance screens
3. **Premium billing** — finance app had Stripe/PayPal via Supabase; ecosystem billing should use Grabio subscription — decide if finance-only free tier exists
4. **URL** — **`grabio.space/invoice`** (locked)
5. **Root repo deploys** — rules/hosting/functions require explicit owner **"approved"** file list

### Estimate
**~8 weeks** full-time equivalent for one engineer (A0–A6). Parallel possible: A5/A6 prep while A3 in progress.

**Next step:** Complete A0 local smoke → **Phase A1** Firestore CRUD for invoices/clients/products.

---

## Workstream C — grabio.online Supabase + R2 (2026-07-04)

**Scope:** Test stack at `grabio.online` on VPS `104.207.71.117` — Supabase backend, Cloudflare R2 media, Apache deploy (not Firebase Hosting).

### Done (2026-07-04)
- [x] Supabase Edge Function secrets: R2 keys, `R2_PUBLIC_URL`, URL/SMTP host vars
- [x] Product image migration Firebase Storage → R2 (**21/21**)
- [x] `media.grabio.online` — BIND A record + Apache reverse proxy → R2 public dev URL (`scripts/setup-media-grabio-online-vps.sh`)
- [x] R2 bucket CORS for `grabio.online` / `localhost` (dashboard; policy in `grabio-platform/scripts/r2-cors-dashboard.json`)
- [x] Frontend redeploy to VPS (`scripts/deploy-grabio-online-vps.sh`)
- [x] Product `image_url` + env use **`http://media.grabio.online`** until SSL on media subdomain (HTTPS vhost returns 404 today)
- [x] CLI helper: `grabio-platform/scripts/set-r2-cors.sh` (needs Admin CF token — see below)

### Open — credentials (ask **old builder** where live values are stored)
> **Note to next session / old builder:** Please point us to where production values for these live (cpanel backup, Firebase functions config, `.env` on old host, etc.). Fill into `suba eco sys/grabio-platform/.env.secrets` then run `./scripts/set-supabase-secrets.sh`.

| Secret | Used by | Status |
|--------|---------|--------|
| `SMTP_PASS` | contact, marketing, order-notifications Edge Functions | ✅ from `functions/.env` |
| `WHISH_CHANNEL`, `WHISH_SECRET` | subscription + webhook-whish | ✅ from `functions/.env` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | webhook-stripe, subscription | ❌ **not in old build** — not in `functions/.env` or Firebase Secret Manager |

Template: `grabio-platform/.env.secrets.example` · Gitignored target: `grabio-platform/.env.secrets` · Reference doc: `suba eco sys/.credentials.md`

### Open — SSL
- [ ] Webuzo SSL for `grabio.online`, `www.grabio.online`, **`media.grabio.online`**
- [ ] After certs live: flip `VITE_R2_PUBLIC_URL` / `R2_PUBLIC_URL` / product URLs back to `https://media.grabio.online`

### How to create Admin Cloudflare API token (for `set-r2-cors.sh`)

The existing **object-level** R2 token (`grabio-platform-r2` / S3 access keys) cannot call `api.cloudflare.com` for bucket CORS. You need a separate **account Admin** token.

1. Open [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**.
2. **Create Custom Token** (or edit from scratch):
   - **Permissions:** `Account` → `R2 Storage` → **Edit** (Admin Read & Write)
   - **Account resources:** Include → account `2bef47f1314ea95fae3b30004f203d4c`
   - (Optional) Restrict to IP if you use a fixed deploy machine
3. **Continue to summary** → **Create Token** → copy the token **once** (shown only at creation).
4. Store in `suba eco sys/.credentials.md` as e.g. `CLOUDFLARE_API_TOKEN (Admin R&W)` — **not** the object-level `cfat_…` R2 key.
5. Apply CORS from repo:
   ```bash
   cd "suba eco sys/grabio-platform"
   export CLOUDFLARE_API_TOKEN="<paste admin token>"
   ./scripts/set-r2-cors.sh
   ```
   Uses `scripts/r2-cors-policy.json` (API format). Dashboard JSON: `scripts/r2-cors-dashboard.json`.

**CORS is already set via dashboard** — Admin token is only needed for future CLI/API updates.

### Key paths
```
suba eco sys/grabio-platform/
  .env / .env.secrets          # VITE_* + Edge Function secrets
  scripts/set-supabase-secrets.sh
  scripts/set-r2-cors.sh
  scripts/setup-media-grabio-online-vps.sh
  scripts/deploy-grabio-online-vps.sh
  scripts/r2-cors-dashboard.json
suba eco sys/.credentials.md   # gitignored credentials index
suba eco sys/scripts/migrate-images-to-r2.ts
```
