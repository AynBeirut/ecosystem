# Grabio Ecosystem — Master Feature List

**Location:** `the eco sys/ecosystem-plan/feature-list.md`  
**Purpose:** Single feature list for pricing — one row per capability in the **merged Grabio system** (no duplicates after port).  
**Date:** 2026-06-23 (rev. 2 — gap audit)  
**Related:** [`plan-ecosys.md`](plan-ecosys.md) · [`feature-inventory-study.md`](feature-inventory-study.md) · [`grabio-builder-prompt-packages.md`](grabio-builder-prompt-packages.md)

**Coverage honesty:** Rev. 1 grouped many admin pages into module families and **missed ~25 code-level capabilities**. Rev. 2 adds sections **P–X** and **Appendix A**. Still **outside scope** until you link repos: **Windows POS**, full **Capacitor/android** native shell. **Not features:** `Credits.tsx` (empty stub route), marketing-only pages (`About`, `Features`), dev scripts.

**How to use:** Fill the **Price** column ($/mo, $/yr, one-time, or credits). Sum rows for custom packages or use **Default packages** column for ready presets.

**Legend — Status**

| Status | Meaning |
|--------|---------|
| `live` | In Grabio production code today |
| `partial` | Works but incomplete or web-only / mobile-only |
| `port` | Live in Finance or AI Builder — merge into Grabio |
| `stub` | UI exists; finish during merge |
| `planned` | Catalog / plan only — build or port later |

**Legend — Billing**

| Type | Meaning |
|------|---------|
| `core` | Always on (included in base tier) |
| `included` | Included with account / tier |
| `addon` | Optional paid add-on |
| `tier` | Minimum plan tier (Starter / Pro / Business) |
| `credits` | Prepaid AI credits (all agents) |
| `app` | Native app install SKU |

---

## A. Business workflow backends (tenant chooses one on platform)

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| A1 | `workflow_shop` | Shop — simple products, stock in/out | live | Grabio | Shop | core | |
| A2 | `workflow_live_kitchen` | Live kitchen — recipe deduction on sale | port | Finance + POS ref | Live Kitchen | tier | |
| A3 | `workflow_factory` | Factory flow — BOM, batches, raw → finished | live | Grabio | Factory Flow | tier | |
| A4 | `workflow_ngo` | NGO — billing-focused, no inventory default | planned | Package preset | NGO | core | |
| A5 | `workflow_freelancer` | Freelancer — billing-focused, no inventory default | planned | Package preset | Freelancer | core | |
| A6 | `workflow_hotel` | Hotels & hospitality workflow | planned | Net-new | — | addon | |

*Live Kitchen and Factory Flow are **mutually exclusive** per store (one deduction model).*

---

## B. Core platform (web admin)

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| B1 | `invoicing` | Invoicing & billing — PDF, WhatsApp, email, dual currency USD/LBP | live | Grabio | All | core | |
| B2 | `analytics` | Analytics & reports — revenue, turnover, dashboards | live | Grabio | All | core | |
| B3 | `payments` | Payment gateways — OMT, Stripe, Square, Whish, BoB | live | Grabio | All | core | |
| B4 | `delivery` | Delivery & fulfillment — GPS, status workflow, guest tracking | live | Grabio | All | core | |
| B5 | `payments` | Expense tracking by category | live | Grabio | All | core | |
| B6 | `analytics` | Account statements — AR/AP ledger | live | Grabio | All | included | |
| B7 | `payments` | Bank reconciliation & cash collection | live | Grabio | — | included | |
| B8 | `analytics` | Exportable financial reports (PDF/CSV/Excel) | live | Grabio | — | included | |
| B9 | — | GDPR data export & delete | live | Grabio | All | core | |
| B10 | — | Subscription & trial enforcement | live | Grabio | All | core | |
| B11 | `team` | Store templates & themes (pages, logos, branding) | live | Grabio | — | included | |
| B12 | `invoicing` | **Paid custom templates** (owner-branded layouts) | live | Grabio templates | — | addon | |
| B13 | `invoicing` | **Free standard templates** | live | Grabio templates | All | core | |

---

## C. Commerce & marketplace

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| C1 | `marketplace` | Online storefront — catalog, cart, checkout | live | Grabio | Shop (included), others optional | core / addon | |
| C2 | `marketplace` | Platform marketplace search & discovery | live | Grabio | — | included | |
| C3 | `marketplace` | Custom domain storefront | live | Grabio | — | addon | |
| C4 | `domainPackage` | Custom domain package (hosting + themes) | live | Grabio | — | addon | |
| C5 | `marketplace` | Product reviews moderation | live | Grabio | — | included | |
| C6 | `marketplace` | Customer favorites & profiles | live | Grabio | — | included | |
| C7 | `marketplace` | Store announcements + push to favorited users | live | Grabio | — | included | |
| C8 | `marketplace` | Order notifications log + retry | live | Grabio | — | included | |
| C9 | `payments` | Customer returns (RMA) | live | Grabio | — | included | |
| C10 | `payments` | Sales returns | live | Grabio | — | included | |
| C11 | `marketplace` | Meta catalog / Facebook & Instagram shop sync | live | Grabio | — | addon | |

---

## D. Inventory & stock

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| D1 | `stock` | Product catalog — simple & service items | live | Grabio | Shop, Kitchen, Factory | included | |
| D2 | `stock` | Inventory dashboard & real-time stock levels | live | Grabio | Shop, Kitchen, Factory | included | |
| D3 | `stock` | Purchase orders | live | Grabio | Kitchen, Factory | included | |
| D4 | `stock` | Suppliers master data | live | Grabio | Kitchen, Factory | included | |
| D5 | `stock` | Supplier account statements (AP) | live | Grabio | — | included | |
| D6 | `stock` | Low-stock push alerts | live | Grabio | — | included | |
| D7 | `stock` | Expiry alerts (email + push) | live | Grabio | — | included | |
| D8 | `stock` | Supplier returns workflow | live | Grabio | — | included | |
| D9 | `stock` | Supplier credits | stub | Grabio | — | included | |
| D10 | `dropship` | Dropship — supplier URL + Shein stock sync | partial | Grabio | — | addon | |
| D11 | `stock` | Composed sellable products (platform catalog) | live | Grabio | Kitchen, Factory | tier | |
| D12 | — | SIM / legacy invoice backup import | port | Finance | — | addon | |

---

## E. Production & factory

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| E1 | `factory` | Raw materials inventory | live | Grabio | Factory Flow | tier | |
| E2 | `factory` | Recipes / bill of materials (BOM) editor | live | Grabio | Factory Flow, Kitchen | tier | |
| E3 | `factory` | Production batches — draft → complete | live | Grabio | Factory Flow | tier | |
| E4 | `factory` | Finished goods inventory | live | Grabio | Factory Flow | tier | |
| E5 | `factory` | Auto inventory deduction on paid order | live | Grabio | Factory Flow | tier | |
| E6 | `restaurant` | Live kitchen — ingredient deduction on sale (no batch phase) | port | Finance ref + POS | Live Kitchen | tier | |
| E7 | `restaurant` | Restaurant storefront template | partial | Grabio | — | included | |

*Composed products / BOM are **authored on platform only** — not in Invoice Manager app.*

---

## F. Invoicing & finance (merged module)

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| F1 | `invoicing` | Invoices — create, send, PDF, payment status | live | Grabio + port Finance UX | All | core | |
| F2 | `invoicing` | Estimates / quotes → convert to invoice | port | Finance | — | included | |
| F3 | `invoicing` | Receipts & payment orders | port | Finance | — | included | |
| F4 | `invoice_manager` | Portfolio PDF — credentials / project samples (standalone PDF) | stub | Finance → Grabio | NGO, Freelancer | addon | |
| F5 | `invoicing` | CSV / data import | port | Finance | — | included | |
| F6 | `services` | Service subscriptions — monthly/yearly renewals | partial | Grabio | — | addon | |

---

## G. PSA & projects

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| G1 | `projects` | Client projects — budget, status, client link | port | Finance | — | addon | |
| G2 | `projects` | Tasks & billable timesheets | port | Finance | — | addon | |
| G3 | `proposal_writer` | AI proposal generation (RFP → proposal doc) | port | Finance | — | credits | |
| G4 | `projects` | PSA admin dashboard & sync health | port | Finance | — | addon | |

---

## H. CRM & team

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| H1 | `crm` | Sales CRM — pipeline kanban | live | Grabio | — | addon | |
| H2 | `crm` | Activity feed, visit/call/WhatsApp logging | live | Grabio | — | addon | |
| H3 | `crm` | GPS field verification & map view | live | Grabio | — | addon | |
| H4 | `crm` | Rep performance dashboard | live | Grabio | — | addon | |
| H5 | `crm` | CRM rep accounts & invite (server-side Auth) | live | Grabio | — | addon | |
| H6 | `crm` | Rep web portal (`/team/crm`) | live | Grabio | — | addon | |
| H7 | `crm` | Order → CRM client timeline sync | live | Grabio | — | addon | |
| H8 | `team` | Sub-accounts & role permissions (RBAC) | live | Grabio | — | tier | |
| H9 | `team` | Sub-account dashboard | live | Grabio | — | tier | |
| H10 | `team` | Staff directory | live | Grabio | — | included | |
| H11 | `team` | Salaries / payroll payments | live | Grabio | — | included | |
| H12 | `team` | Audit logs | live | Grabio | — | included | |
| H13 | `team` | Customers master (non-CRM) | live | Grabio | — | included | |

*CRM rows bundle as one **`salesCrm`** add-on today ($15/mo in catalog).*

---

## I. Marketing, SEO & content

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| I1 | `email_marketing` | Email subscribers & campaigns | live | Grabio | — | tier | |
| I2 | `seo_assistant` | SEO analytics dashboard | live | Grabio | — | included | |
| I3 | `seo_assistant` | Google Search Console SEO audit | live | Grabio | — | addon | |
| I4 | `seo_assistant` | Platform crawl audit dashboard | partial | Grabio (unrouted) | — | addon | |
| I5 | `seo_assistant` | Dynamic sitemap & robots.txt | live | Grabio | — | included | |
| I6 | `whatsappBusiness` | WhatsApp Business integration | live | Grabio | — | addon | |
| I7 | `blog_publisher` | Tenant blog / CMS per store | planned | Net-new | — | addon | |
| I8 | `builder` | Web Builder — drag-and-drop hosted pages | planned | Net-new | — | addon | |

---

## J. AI & growth tools (all on credits)

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| J1 | `ai_agent` | AI Workflow Agent — in-dashboard assistant | partial | Grabio settings | — | credits | |
| J2 | `ai_builder` | AI Builder — project wizard & site brief | port | AI Builder | — | credits | |
| J3 | `ai_builder` | AI Builder — Monaco editor + live preview | port | AI Builder | — | credits | |
| J4 | `ai_builder` | AI Builder — multi-provider chat (GPT, Claude, Qwen, etc.) | port | AI Builder | — | credits | |
| J5 | `ai_builder` | AI Builder — publish share link | port | AI Builder | partial | credits | |
| J6 | `ai_builder` | AI Builder — hosting / custom domain deploy | planned | AI Builder schema | — | addon + credits | |
| J7 | `content_creator` | Content Creator — product copy, social, blog drafts | planned | Grabio AI | — | credits | |
| J8 | `market_strategy` | Market Strategy — pricing & growth insights | planned | Grabio AI | — | credits | |
| J9 | `email_marketing` | Email campaign AI drafts | partial | Grabio | — | credits | |
| J10 | `proposal_writer` | Proposal Writer (Grabio-native, post-port) | port | Finance + AI | — | credits | |
| J11 | `seo_assistant` | SEO Assistant — meta, FAQ schema suggestions | planned | Grabio AI | — | credits | |
| J12 | `analytics_insights` | Business Insights — plain-language recommendations | planned | Grabio AI | — | credits | |
| J13 | `campaign_writer` | Campaign & promo copy writer | partial | Grabio | — | credits | |
| J14 | — | **AI credit packs** (prepaid top-up) | live | Grabio `/ai/*` | — | credits | |

*AI Builder uses **Grabio templates**: free standard + paid custom (rows B12–B13) — no duplicate template store.*

---

## K. Native apps (one sign-in)

| # | ID | Feature | Status | Source | Default packages | Billing | Price |
|---|-----|---------|--------|--------|------------------|---------|-------|
| K1 | `admin_mobile` | Grabio Admin — Android owner app | live | grabio-mobile | — | included | |
| K2 | `invoice_manager` | Invoice Manager — mobile billing app | port | Finance app shell | NGO, Freelancer | app | |
| K3 | `pos` | Grabio POS — Windows desktop | live* | External POS | Live Kitchen | app | |
| K4 | `pos` | Grabio POS — mobile (iOS/Android) | planned | Net-new | Live Kitchen | app | |
| K5 | `whitelabel` | White-label store app — buyer commerce | partial | white-label-client-app | — | app | |

*Windows POS: repo path TBD. On connect: ask composed-product source (platform vs POS).*

### Admin mobile — included screens (subset of web)

| Screen domain | Web parity |
|---------------|------------|
| Dashboard KPIs | partial |
| Orders + create order | partial |
| Products add/edit | partial |
| Inventory & purchases | partial |
| Suppliers, customers, expenses | partial |
| Account statement | partial |
| CRM rep (clients + GPS log) | partial |

---

## L. Platform add-ons & limits (already in Stripe)

| # | ID | Feature | Status | Source | Billing | Price (catalog) |
|---|-----|---------|--------|--------|---------|-----------------|
| L1 | `salesCrm` | Sales CRM bundle (all H1–H7) | live | addon | $15/mo · $150/yr |
| L2 | `domainPackage` | Custom domain package | live | addon | $15/mo · $150/yr |
| L3 | `whatsappBusiness` | WhatsApp Business | live | addon | $10/mo · $100/yr |
| L4 | `extraStorage` | Extra storage (+5 GB block) | live | addon | $2/mo · $24/yr |

---

## P. Security & compliance (Grabio — added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| P1 | — | Admin MFA / TOTP (authenticator) | live | `AdminProfile.tsx` | included | |
| P2 | — | Admin IP allowlist | live | `AdminProfile`, `ProtectedRoute` | included | |
| P3 | — | GDPR export UI (admin self-service) | live | `AdminProfile` + `/gdpr/export` | core | |
| P4 | — | GDPR deletion request UI | live | `AdminProfile` + `/gdpr/delete` | core | |
| P5 | — | Privacy policy generator (store) | live | `AdminProfile` | included | |

---

## Q. Notifications & transactional email (added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| Q1 | — | FCM push — order status (buyer) | live | `orderNotifications.ts` | included | |
| Q2 | — | FCM push — new order (store owner) | live | `onOrderCreated` trigger | included | |
| Q3 | — | FCM push — low stock & expiry | live | scheduled jobs + FCM | included | |
| Q4 | — | FCM push — store announcements | live | `onStoreAnnouncement` | included | |
| Q5 | — | Order confirmation email | live | `emailService` | included | |
| Q6 | — | Subscription / trial lifecycle emails | live | `emailService` | included | |
| Q7 | `delivery` | Mobile push permission onboarding | live | `grabio-mobile`, `AdminDashboard` | included | |

---

## R. Store profile & integrations (added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| R1 | `marketplace` | Store branding — logo, slogan, about, mission/vision | live | `AdminProfile` | included | |
| R2 | `seo_assistant` | Per-store SEO meta (title, description, keywords) | live | `AdminProfile.seoSettings` | included | |
| R3 | `seo_assistant` | robots.txt editor & preview | live | `AdminProfile` | included | |
| R4 | `marketplace` | Meta Pixel + Conversion API config | live | `AdminProfile.metaIntegrationSettings` | included | |
| R5 | `services` | Service catalog defaults (monthly/yearly / duration) | live | `AdminProfile.serviceCatalogSettings` | included | |
| R6 | `payments` | Per-store payment method toggles | live | `AdminPayments` + checkout | included | |
| R7 | `analytics` | Google Analytics / Meta pixel hooks | live | `lib/analytics.ts`, `metaPixel.ts` | included | |

---

## S. Inventory costing & services (added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| S1 | `factory` | FIFO / LIFO / weighted-average costing | live | `finishedGoods.ts`, `AdminProduction` | tier | |
| S2 | `services` | Recurring service activation from paid orders | live | `orderSubscriptions.ts` | partial | |
| S3 | `services` | Composed service bundles | planned | `composedService.ts` — type only, no UI | addon | |
| S4 | — | Trial revenue share on paid orders (20%) | live | `subscriptionEnforcement.ts` | core | |

---

## T. Meta & ads API (added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| T1 | `marketplace` | Meta catalog feed (public GET) | live | `/meta/catalog/feed` | addon | |
| T2 | `marketplace` | Facebook Shop connect | live | `/meta/shop/connect` | addon | |
| T3 | `marketplace` | Instagram Shopping connect | live | `/meta/instagram/connect` | addon | |
| T4 | `marketplace` | Meta conversion event tracking | live | `/meta/conversion/track` | addon | |
| T5 | `marketplace` | Meta Ads campaign create | live | `/meta/ads/campaign/create` | addon | |
| T6 | `marketplace` | Dynamic product ads enable | live | `/meta/ads/dynamic/enable` | addon | |

---

## U. Finance app — additional pages (added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| U1 | `invoicing` | Multi-currency / FX settings | port | `CurrencySettings.tsx` | included | |
| U2 | `invoice_manager` | Company profile & branding | port | `CompanyProfile.tsx` | included | |
| U3 | `delivery` | Delivery team + COD cash collection | port | `DeliveryManager.tsx` | included | |
| U4 | `team` | Sub-users (Finance pro) | port | `SubUsers.tsx` | tier | |
| U5 | `payments` | Org payment methods | port | `PaymentMethods.tsx` | included | |
| U6 | — | Multi-organization / org members | port | `OrgMembers.tsx` | addon | |
| U7 | — | Finance premium / Stripe upgrade | port | `PremiumUpgrade.tsx` | — | |
| U8 | `invoice_manager` | PWA install prompt | port | `InstallPWA.tsx` | included | |

---

## V. Platform & buyer flows (added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| V1 | `marketplace` | Guest browse + guest checkout | live | guest mode web/mobile | included | |
| V2 | `marketplace` | Buyer → store owner upgrade | live | `UpgradeToAdmin.tsx` | included | |
| V3 | — | Contact us form | live | `ContactUs`, `/contact/send` | core | |
| V4 | — | Blocked / expired account page | live | `Blocked.tsx` | core | |
| V5 | `payments` | Payment success / failed pages | live | `payment/Success`, `Failed` | included | |
| V6 | — | Whish payment ops checklist | live | `/payment/whish/ops-checklist` | internal | |
| V7 | `team` | Customizable dashboard quick actions | live | `AdminDashboard` | included | |

---

## W. White-label buyer app (added rev. 2)

| # | ID | Feature | Status | Source | Billing | Price |
|---|-----|---------|--------|--------|---------|-------|
| W1 | `whitelabel` | WL marketplace browse | partial | `white-label-client-app/` | app | |
| W2 | `whitelabel` | WL cart & checkout | partial | same | app | |
| W3 | `whitelabel` | WL order tracking | partial | same | app | |
| W4 | `whitelabel` | WL push notifications | partial | `usePushNotifications.ts` | app | |

---

## X. Unrouted / stub (do not price yet)

| # | Feature | Status | Code |
|---|---------|--------|------|
| X1 | Platform crawl audit | partial unrouted | `AdminCrawlAudit.tsx` |
| X2 | Supplier return detail UI | stub | `AdminSupplierReturnDetail.tsx` |
| X3 | Supplier return analytics UI | stub | `AdminSupplierReturnAnalytics.tsx` |
| X4 | Supplier credits UI | stub | `AdminSupplierCredits.tsx` |
| X5 | Supplier return reminder job | stub | `supplierReturnReminders.ts` |
| X6 | Credits page | removed | `Credits.tsx` (null) |
| X7 | `manufacturingBom` add-on | unused | `storeProfile` type only |

---

## M. Ready packages — which features to sum

Use when pricing **packages** after per-feature prices are set.

### Shop (`pkg_shop`)

`B1–B5`, `B9–B10`, `B13`, `C1`, `D1–D2`, `A1`, `K1` optional

### Live Kitchen (`pkg_live_kitchen`)

Core B + `A2`, `D1–D5`, `D11`, `E2`, `E6`, `K3`, `K4` — **no** marketplace unless added

### Factory Flow (`pkg_factory_flow`)

Core B + `A3`, `D1–D5`, `D11`, `E1–E5` — marketplace optional add-on

### NGO (`pkg_ngo`)

`B1`, `B9–B10`, `B13`, `F1`, `F4`, `A4`, `K2`

### Freelancer (`pkg_freelancer`)

Same as NGO (`A5` label)

### Custom package

Owner toggles any row — sum **Price** column.

---

## N. Count summary

| Group | Features |
|-------|----------|
| A Workflow backends | 6 |
| B Core platform | 13 |
| C Commerce | 11 |
| D Inventory | 12 |
| E Production | 7 |
| F Invoicing & finance | 6 |
| G PSA | 4 |
| H CRM & team | 13 |
| I Marketing & SEO | 8 |
| J AI (credits) | 14 |
| K Native apps | 5 |
| L Stripe add-ons | 4 |
| **P Security** | **5** |
| **Q Notifications/email** | **7** |
| **R Store profile** | **7** |
| **S Costing/services** | **4** |
| **T Meta APIs** | **6** |
| **U Finance port** | **8** |
| **V Platform/buyer** | **7** |
| **W White-label app** | **4** |
| X Unrouted/stub (not priced) | 7 |
| **Billable line items (A–W)** | **~132** |

*Many rows bundle under one module ID at checkout. X = do not price until wired.*

---

## Appendix A. Grabio admin routes → feature list

Every routed `/admin/*` page mapped (verify none missing).

| Route | Page | Feature list ref |
|-------|------|------------------|
| `/admin/dashboard` | AdminDashboard | V7, B2, Q7 |
| `/admin/products` | AdminProducts | D1, D10 |
| `/admin/profile` | AdminProfile | P1–P5, R1–R5, J1 |
| `/admin/payments` | AdminPayments | B3, R6 |
| `/admin/delivery` | AdminDelivery | B4 |
| `/admin/templates` | AdminTemplates | B11–B13 |
| `/admin/announcements` | AdminAnnouncements | C7 |
| `/admin/analytics` | AdminAnalytics | B2 |
| `/admin/revenue` | AdminRevenue | B2 |
| `/admin/marketing` | AdminMarketing | I1, J9 |
| `/admin/orders` | AdminOrders | B1, F1 |
| `/admin/inventory` | AdminInventory | D2, S1 |
| `/admin/suppliers` | AdminSuppliers | D4 |
| `/admin/supplier-statements` | AdminSupplierStatements | D5 |
| `/admin/raw-materials` | AdminRawMaterials | E1 |
| `/admin/recipes` | AdminRecipes | E2 |
| `/admin/composed-products` | AdminComposedProducts | D11 |
| `/admin/production` | AdminProduction | E3, S1 |
| `/admin/finished-goods` | AdminFinishedGoods | E4, S1 |
| `/admin/purchases` | AdminPurchases | D3 |
| `/admin/returns` | AdminReturns | C9 |
| `/admin/supplier-credits` | AdminSupplierCredits | X4 stub |
| `/admin/supplier-returns` | SupplierReturns | D8 |
| `/admin/sales-returns` | SalesReturns | C10 |
| `/admin/staff` | AdminStaff | H10 |
| `/admin/salaries` | AdminSalaries | H11 |
| `/admin/sub-accounts` | AdminSubAccounts | H8 |
| `/admin/expenses` | AdminExpenses | B5 |
| `/admin/reports` | AdminReports | B8 |
| `/admin/finance` | AdminFinanceSuite | B2 partial hub |
| `/admin/marketplace` | AdminMarketplaceSync | C11, T1–T6 |
| `/admin/product-reviews` | AdminProductReviews | C5 |
| `/admin/order-notifications` | AdminOrderNotifications | C8 |
| `/admin/account-statement` | AdminAccountStatement | B6 |
| `/admin/cash-collection` | AdminBankReconciliation | B7 |
| `/admin/bank-reconciliation` | AdminBankReconciliation | B7 |
| `/admin/service-renewals` | AdminServiceRenewals | F6, S2 |
| `/admin/audit-logs` | AdminAuditLogs | H12 |
| `/admin/seo-analytics` | AdminSEOAnalytics | I2 |
| `/admin/seo-audit` | AdminSEOAudit | I3 |
| `/admin/customers` | AdminCustomers | H13 |
| `/admin/crm/*` | CRM module | H1–H7 |
| `/admin/crm/reps` | AdminCrmReps | H5 |
| `/subscription` | Subscription | B10, L1–L4 |
| `/team/dashboard` | SubAccountDashboard | H9 |
| `/team/crm` | CrmRepPortal | H6 |
| **Not routed** | AdminCrawlAudit | X1 |
| **Duplicate file** | AdminSupplierReturns | merge with SupplierReturns |

---

## Appendix B. Finance app pages → feature list

| Route | Page | Feature list ref |
|-------|------|------------------|
| `/invoices` | InvoiceManager | F1 |
| `/estimates` | EstimateManager | F2 |
| `/receipts` | ReceiptManager | F3 |
| `/portfolio` | CompanyPortfolio | F4 stub |
| `/clients` | ClientsManager | H13 port |
| `/suppliers` | SuppliersManager | D4 port |
| `/products` | ProductsManager | D1 port |
| `/inventory` | Inventory | D2 port (compose authoring not sold in app) |
| `/purchase-orders` | PurchaseOrders | D3 port |
| `/expenses` | ExpenseManager | B5 port |
| `/staff` | StaffManager | H10 port |
| `/delivery` | DeliveryManager | U3 |
| `/projects` | ProjectsManager | G1 |
| `/tasks` | TasksManager | G2 |
| `/proposals` | ProposalsManager | G3 |
| `/reports` | Reports | B8 port |
| `/currency` | CurrencySettings | U1 |
| `/profile` | CompanyProfile | U2 |
| `/settings` | Settings + SIM import | D12, F5 |
| `/sub-users` | SubUsers | U4 |
| `/org/members` | OrgMembers | U6 |
| `/payment-methods` | PaymentMethods | U5 |
| `/admin` | AdminDashboard (PSA) | G4 |
| `/premium` | PremiumUpgrade | U7 |
| `/install` | InstallPWA | U8 |

---

## O. Merge rule (reminder)

After port: **one row = one system feature**. Finance and AI Builder source code is reference only; white-label copies stay frozen. See [`plan-ecosys.md`](plan-ecosys.md) §2g.

---

*Master feature list for pricing. Fill Price column, then define packages.*
