# Architecture

## Product strategy (2026-09-15)

Locked tiers (no module deletion):

1. **Active core** — `live_kitchen`, venue ops, CRM.
2. **Optional maturity** — accounting, inventory, recipe/production (invest when venue customers need depth).
3. **Connected high-end modules** — builder, template, SEO (integrated upsell, not the flagship narrative).
4. **Maintained** — shop; **factory/manufacturing** (existing BOM/production structure; may feed restaurant production later).
5. **Deferred** — NGO, freelancer, mini shop (support existing tenants only; no GTM expansion).

New engineering and GTM default to tier 1–2 unless explicitly cross-platform.

**Restaurant-first admin (planned):** IA + security map — `docs/handoff/restaurant-first-ui-security-map-2026-09-15.md`. Primary nav = daily ops / reservations / CRM; finance + inventory tenant-off by default for `live_kitchen`; role templates before new venue features; builder/template/SEO in a gated “Grow” bucket.

## Current platform

- Frontend: React + Vite app served from Firebase Hosting.
- Backend: Firebase Auth, Firestore, Cloud Functions, and Firebase Storage.
- Admin POS page: `src/pages/admin/PosPairing.tsx` on `/admin/pos`.
- POS API: `functions/src/api/posSync.ts`.

## Marketing SEO (2026-09-10)

| Route | Data | Purpose |
|-------|------|---------|
| `/` | `ModularHome.tsx` | Homepage + category keyword band |
| `/demo/:slug` | `src/data/marketing/content/*.ts` → `PackageLandingPage.tsx` | Phase 1 vertical landings |
| `/compare/:slug` | `src/data/marketing/comparisonPages.ts` → `ComparisonPage.tsx` | Competitor comparison pages |
| `/demo/:slug/app` | `demoPreviewCatalog.ts` → `DemoAppPreviewPage.tsx` | Quick mock screen tour (vertical) |
| `/features/:moduleId/app` | `demoPreviewCatalog.ts` → `FeatureAppPreviewPage.tsx` | Quick mock screen tour (module) |
| `/demo-os` | `demoOsCatalog.ts` → `DemoOsIndexPage.tsx` | Internal admin demo hub (indexable) |
| `/demo-os/:moduleId` | `demoOsCatalog.ts` → `DemoOsModulePage.tsx` | Read-only admin screen + sign-in gate |
| `/demo/:slug/os/:moduleId` | `demoOsCatalog.ts` → `DemoVerticalOsPage.tsx` | Vertical preset + admin demo tour |
| `/store/:slug` (marketing) | `scripts/seedMarketingDemoStores.cjs` → `storeProfiles` | Public demo storefronts (`grabio-demo-*`) |
| `/sitemap.xml` | `functions/src/api/sitemap.ts` + `platformSitemapUrls.ts` | Dynamic sitemap |

- Canonical host: `https://grabio.space` (`SEOHead`, `GRABIO_NAP`).
- `www` → apex: **301** via Hosting `customDomains` `redirectTarget` (`scripts/configure-www-redirect.mjs`); client fallback in `index.html` + `WwwCanonicalRedirect.tsx`.
- SEO HTML shells: `scripts/prerenderMarketingSeoHtml.cjs` (post-build) → `dist/demo/*/index.html`, `dist/compare/*/index.html`, `dist/demo-os/*/index.html`, `dist/features/*/app/index.html`.
- `/admin/*` stays `noindex` via `RouteRobots.tsx`; public demo routes are indexable with canonical on `/demo-os/*` or `/demo/*/os/*`.
- GCP ops: `docs/deployment/GCP-SESSION.md` — project **`market-flow-7b074`** (not default `gj-real-estate-346907`).
- Demo CTA attribution: Firestore `seo_events` with `event_name: demo_start` (`TryDemoButton` → `seoTracker.ts`).
- Social schema: `GRABIO_SOCIAL` in `grabioBrandSchema.ts`; footer icons in `PublicFooter.tsx`.

## Developer landing map

Canonical map: `~/Documents/grabio-platform-docs/Architecture/Developer-Landing-Map.md`.

Read this before new engineering sessions or structural work. It explains main platform, apps, vendor finance, POS/ecosystem copies, client data, reporting evidence, and the current no-risk correction status.

## Fine-dining product map

Canonical map: `~/Documents/grabio-platform-docs/Architecture/Fine-Dining-Platform-Map.md`.

Grabio's active product center is fine-dining restaurant daily operations plus CRM. Accounting and inventory remain strong optional expansion modules; shop, manufacturing, and builder stay maintained for active clients; NGO, freelancer, mini shop, and broad custom vertical growth are deferred unless Anwar explicitly reopens them.

Builder, template, and SEO should stay connected inside Grabio as gated high-end client modules, not split into a separate platform now. They share tenant identity, store profile, domain, content, CRM, menu/products, reservations, and role policy.

## Workspace organization policy

Canonical policy: `~/Documents/grabio-platform-docs/Architecture/Workspace-Organization-Policy.md`.

Protected code/app roots must not be moved without an approved refactor plan. Workspace cleanup must start with inventory, classification, reference checks, and an approved move list. Quarantine is review-only and must include a manifest; deletion always requires explicit Anwar approval.

## Setup surface separation

Canonical review: `~/Documents/grabio-platform-docs/Architecture/Setup-Surface-Separation.md`.

Store Profile setup, Invoice Document setup, and Website Template setup are separate surfaces. Before changing `AdminProfile.tsx`, `BusinessFinanceInvoiceTemplateSetup.tsx`, `AdminTemplates.tsx`, or `ThemeEditor.tsx`, confirm field ownership, source-of-truth vs fallback behavior, read paths, write paths, mobile/POS impact, scripts/backfills, and NIPCO template lock impact.

## Role, permission, and environment policy

Canonical policy: `~/Documents/grabio-platform-docs/Architecture/Role-Permission-Environment-Policy.md`.

Builder/accounting client access, sub-account roles, route guards, sensitive-field visibility, and demo/staging/production environment rules must be reusable platform policy. Current builder/accounting role setup is about 60% complete and must not continue as one-account setup.

## Document numbering (platform)

Per-store serials live in `stores/{storeId}/ledgerMeta/documentSerials`. PO format: **`PO-YYYY-MM-DD-001`** — sequence resets at **001 each calendar date** (by document date), then 002, 003… Same pattern extensible to SO/INV. Internal Firestore/POS doc ids never appear in UI.

Grabio is a multi-tenant product, so client-specific behavior must be represented as tenant configuration rather than one-off code paths. The store profile/settings layer is the source of truth for options that change workflow, UX, permissions, or checkout behavior.

Canonical structure map: `~/Documents/grabio-platform-docs/Architecture/Packages-Workflows-Modules.md`. Future package, workflow, module, business-type, tenant-option, setup-flow, ERP-maturity, inventory-valuation, multi-warehouse, or automation-hook changes must update that map.

**Target model:**

- `storeProfiles/{storeId}` keeps store-owned public/admin settings and existing profile fields.
- Store-scoped settings may be grouped under typed objects such as `orderSettings`, `paymentSettings`, `reservationSettings`, `roleSettings`, `inventorySettings`, and `financeDocumentSettings`.
- Web admin, public marketplace, mobile apps, POS, and Cloud Functions must resolve the same effective settings for the same store.
- **Web admin resolver (2026-09-15):** `src/lib/effectiveStoreContext.ts` — profile + entitlements + role + `venueOpsSettings`; see `docs/architecture/effective-store-context.md`.
- Package gates decide whether a feature is available; tenant settings decide whether an available feature is enabled and how it behaves.
- Defaults must be explicit and product-safe so older stores keep stable behavior when a new option is added.

**Required classification before implementation:**

| Classification | Use when | Implementation rule |
|---|---|---|
| Global platform fix | Behavior is wrong for every store | Fix shared code and verify broad flows |
| Tenant option | Different stores reasonably need different behavior | Add a typed setting, default, admin control, and cross-surface reader |
| Account data setup | Existing settings/data only need seeding | Use a script or admin flow; avoid shared-code changes |
| Temporary exception | Urgent client blocker with no clean option yet | Document owner approval, scope, and removal path |

Examples that must be tenant options, not hardcoded account patches: restaurant reservations on product/order cards, advance restaurant orders, store-specific order status workflows, team-facing vs customer-facing status labels, payment methods exposed at checkout/POS/app, and configurable sub-account roles/permissions.

When adding a tenant option, update the type definition, default resolver, admin settings UI, all consuming surfaces, Firestore rules if needed, scripts/backfills if existing stores need defaults, and docs.

## UI-first setup architecture

Store setup and data seeding must become product flows, not invisible backend-only work. Scripts and AI agents may accelerate setup, but the final system must let the store user see, review, correct, and continue the setup from the UI.

**Required setup loop:**

1. Admin UI explains the required setup data and provides download templates where useful.
2. User uploads or enters structured data such as products, recipes, costs, sale prices, raw materials, payment methods, roles, or order workflows.
3. Setup agent/import service validates, normalizes, and previews the result before writing production store data.
4. User approves or corrects the preview.
5. Saved setup appears immediately in the relevant admin screens and consuming apps.
6. Any script-created data must have an equivalent UI path or a backlog item to build one.

The AI agent page should evolve into a guided setup surface, not just a backend helper: template download, upload, validation errors, proposed mappings, setup progress, and post-import links to Products, Recipes, Inventory, Payment Methods, Roles, and Store Settings.

## POS download path

- The live Windows installer download is hardcoded in `src/lib/posApi.ts`.
- Stable public asset URL:
  `https://firebasestorage.googleapis.com/v0/b/market-flow-7b074.firebasestorage.app/o/pos%2FGrabio-POS-Setup.exe?alt=media`
- Stable storage object path:
  `pos/Grabio-POS-Setup.exe`

## POS pairing model

- Store owner opens `/admin/pos` and downloads the installer.
- Grabio generates either:
  - `pairing.json` for auto-link on first launch, or
  - a 6-digit manual pairing code.
- Windows POS pairs against the Functions API and stores its device token locally.

## Builder demo workspace (2026-09-09)

| Route | Purpose |
|-------|---------|
| `/builder` | Demo list, create (method picker), delete, transfer |
| `/builder/demo/{demoId}/edit?tab=…` | Classic templates, Theme editor, WordPress staging, Products |
| `/builder/demo/{demoId}/preview` | Public demo preview |

**Demo WordPress:** Firestore `wordpressProvisioningRequests` with `requestKind: builder_demo` → VPS install on `*.demo.grabio.online` only. Secrets via `POST /wordpress/provisioning/demo-credentials`. Production WP unchanged (client domain → DNS → email).

**Key files:** `src/lib/builderService.ts`, `src/components/builder/BuilderDemoWordPress.tsx`, `functions/src/services/wordpressProvisioningService.ts`, `functions/src/services/vpsSslService.ts`.

## SEO sitemap and index policy (2026-09-10)

Grabio SEO uses a stable sitemap index at `/sitemap.xml`. The static marketing sitemap is generated at build time as `/sitemap-static.xml`; dynamic child sitemaps are served through the Functions API:

- `/sitemap-programmatic.xml` — published `/pages/*` records that pass quality gates.
- `/sitemap-stores.xml` — online, non-test, indexable stores with brand/content signals.
- `/sitemap-products.xml` — products from eligible stores with slug, image, description, price, and visible availability.

Protected/customer utility routes are noindexed in React via `RouteRobots`: admin, auth, cart, favorites, orders, payment, profile, subscription, onboarding, builder, freelancer, team, invoice, upgrade, and tracking paths. 404 pages also emit `noindex,nofollow`.

Marketing priority pages are prerendered after build in `scripts/prerenderMarketingSeoHtml.cjs` so crawlers receive unique title, description, canonical, Open Graph, and Twitter tags before hydration.

## Important operational rule

- Future Windows POS releases should replace the same storage object path so the Grabio download button does not need code changes for every release.

## Platform account roles (2026-09-07)

| Account | Role | Firestore store |
|---------|------|-----------------|
| `anwar.abouhassan@gmail.com` | Primary owner — work, personal, ecosystem ops | `Av22LKyet8QmVcu9b8Njz1HVfoy1` |
| `mooveelectro@gmail.com` | Test account — QA and mission testing | `EZfuoNQFTJVU4cubNuckpp4K7zw2` |

Registry source: `scripts/syncAccountRegistry.cjs`. Subscription bypass: `src/lib/subscriptionGuard.tsx` (`ALWAYS_ALLOWED_OWNER_EMAILS`).

## NIPCO invoice template (production lock)

- **Store:** `DfIhBAEZ5NR7yNX0HboZvv58Nf82` — template breaks have been **internal team** changes, not NIPCO users.
- **Rule:** Invoice template setup work (web + mobile) and bulk scripts must **skip NIPCO** — never migrate or default their `financeDocumentSettings`.
- **Guards:** `src/lib/nipcoInvoiceTemplateLock.ts`, `scripts/lib/nipcoInvoiceTemplateLock.cjs`, Firestore rules `nipcoInvoiceTemplateFieldsUnchanged`.
- **Pre-deploy audit:** `node scripts/auditNipcoInvoiceTemplate.cjs` (exit 1 on drift).
- **Restore (Anwar only):** `node scripts/restoreNipcoInvoiceTemplate.cjs --write --owner-override`

## Lebanese PCG v2 (E-Moove pilot)

- **Display:** ~522-account PCG tree (`LebanesePcgCoaPanel`) when `storeProfiles.accountingMode=lebanese`.
- **Reports:** Trial Balance / Balance Sheet show PCG or client codes via `grabioToPcgMap` + `pcgClientAccounts` (display only). P&L uses the Lebanese AM form (`lebaneseProfitLoss.ts`): Class 7, inventory C.O.S, expense buckets, FX others.
- **Posting:** Unchanged on Grabio 3-digit `ledgerAccounts` — do not reseed E-Moove COA.
- **Client codes:** Firestore `stores/{storeId}/pcgClientAccounts`; bulk import via Accounting UI or `scripts/seedEmoovePcgClientAccounts.cjs` (E-Moove store ID only).
- **Stores:** E-Moove `EZfuoNQFTJVU4cubNuckpp4K7zw2` (pilot, 1 client code). Little Hands `8WgfKtgaE8aAXdqFhIfweEo5WFq2` — **Lebanese mode live 2026-07-29**, 0 client codes yet. Nipco off limits.
- **Little Hands ops map (2026-09-12):** Sales reconcile vs master xls col B; purchases in `expenses` pending supplier Excel → `purchaseOrders`; POS gap root causes documented in `reporting/data/littlehands-process-and-pos-gaps-2026-09-12.md`.
