# Grabio Guide — Features, Pricing & Admin Map

**Purpose:** Authoritative reference for the **Grabio Guide** AI agent (`POST /agent/guide`).  
**Sally playbook (Q&A + behavior):** `docs/sally-guide-playbook.md` · code: `functions/src/lib/sallyGuidePlaybook.ts`  
**Source of truth for live prices:** `src/lib/modularPricing.ts`, `functions/src/lib/modularPricing.ts`, `functions/src/lib/moduleManifest.ts`.  
**Last updated:** 2026-08-21

---

## Platform overview

**Grabio** (https://grabio.space) is a multi-vendor commerce and operations platform for SMBs — web admin, Android owner app, Windows POS, finance suite, CRM, manufacturing, and AI tools in one Firebase-backed account.

- One login → store profile, products, orders, inventory, payments, delivery, analytics
- Modular pricing: pick a **starting package** or build **custom** module list
- All guidance stays inside Grabio — no third-party platform required for core workflows

---

## Starting packages (modular-v2)

| Package key | Label | Monthly | Yearly | Workflow | Default modules |
|-------------|-------|---------|--------|----------|-----------------|
| `pkg_invoice` | Invoice Manager | $5 | $50 | freelancer | invoicing, invoice_manager, admin_mobile |
| `pkg_mini_shop` | Mini Shop | $10 | $100 | shop | invoicing, marketplace, payments, stock, admin_mobile |
| `pkg_business_backend` | Business Backend | $19 | $190 | shop | invoicing, analytics, payments, delivery, stock, admin_mobile |
| `pkg_shop` | Shop | $27 | $270 | shop | core 5 + stock |
| `pkg_live_kitchen` | Live Kitchen | $27 | $270 | live_kitchen | core 5 + stock, restaurant, pos |
| `pkg_factory_flow` | Factory Flow | $27 | $270 | factory | core 5 + stock, factory |
| `pkg_ngo` | NGO | $22 | $220 | ngo | invoicing, invoice_manager |
| `pkg_freelancer` | Freelancer | $22 | $220 | freelancer | invoicing, invoice_manager |

**Core modules** (included in full shop packages): invoicing, marketplace, analytics, payments, delivery.

### Seat & POS extras

| Item | Monthly | Yearly |
|------|---------|--------|
| Extra user (after first) | $24 | $240 |
| Extra POS location (after first, when POS module enabled) | $15 | $150 |

### Add-ons

| Add-on | Monthly | Yearly |
|--------|---------|--------|
| Custom Domain Package | $10 | $100 |
| WhatsApp Business | $8 | $80 |
| Sales CRM (add-on) | $8 | $80 |
| Extra Storage (5 GB block) | $2 | $20 |

---

## Module catalog & à-la-carte prices

| Module ID | Name | $/mo | $/yr | Status | Summary |
|-----------|------|------|------|--------|---------|
| invoicing | Invoicing & Billing | 5 | 50 | live | Invoices, PDF/WhatsApp, dual currency |
| marketplace | Online Marketplace | 4 | 40 | live | Storefront, catalog, orders |
| analytics | Analytics & Reports | 3 | 30 | live | Revenue, turnover, statements |
| payments | Payments & Finance | 3 | 30 | live | OMT, Stripe, expenses |
| delivery | Delivery & Fulfillment | 3 | 30 | live | GPS, staff, push alerts |
| stock | Inventory & Stock | 3 | 30 | live | Stock, POs, suppliers |
| crm | Sales CRM | 8 | 80 | live | Pipeline, field reps |
| factory | Factory & Production | 6 | 60 | live | BOM, production runs |
| restaurant | Restaurant Production | 4 | 40 | beta | Recipe deduction on sale |
| pos | Grabio POS | 4 | 40 | live | Windows POS (1st location in module) |
| invoice_manager | Invoice Manager | 3 | 30 | live | Mobile billing + finance embed |
| team | Team & Sub-Accounts | 4 | 40 | live | Roles, RBAC |
| dropship | Dropship Sync | 3 | 30 | live | Supplier catalog sync |
| services | Service Subscriptions | 3 | 30 | beta | Renewal billing |
| projects | Projects (PSA) | 5 | 50 | live | Agency client portals |
| builder | Web Builder | 6 | 60 | live | Templates, theme editor |
| ai_builder | AI Builder | 8 | 80 | live | AI site generation — **white-label for media companies: book a meeting** |
| blog_publisher | Blog Publisher | 3 | 30 | live | Store blog CMS |
| whitelabel | White-Label Store App | **$200 one-time** | — | live | Branded buyer app (not monthly) |
| admin_mobile | Grabio Admin App | 0 | 0 | live | Android owner dashboard |
| ai_agent | AI Workflow Agent | 6 | 60 | beta | Grabio Guide + specialists |
| content_creator | Content Creator | 5 | 50 | live | Product/social copy |
| market_strategy | Market Strategy | 5 | 50 | live | Positioning insights |
| email_marketing | Email Marketing | 6 | 60 | beta | Campaign drafts |
| proposal_writer | Proposal Writer | 4 | 40 | live | Client proposals |
| seo_assistant | SEO Assistant | 4 | 40 | live | Meta + FAQ schema |
| analytics_insights | Business Insights | 3 | 30 | live | Plain-language analytics |
| campaign_writer | Campaign Writer | 4 | 40 | live | Promo copy |

### Planned / coming soon (do not sell as live)

timesheet_attendance, recruitment_ats, expense_ocr, shopify_importer, localized_logistics, whatsapp_marketing_engine, dual_currency_accounting, legal_esign, plm_eco

### Special pricing (owner-confirmed — override module table above)

| Product | Price | Notes |
|---------|-------|-------|
| **White-Label Store App** (`whitelabel`) | **$200 one-time** | Branded customer commerce app per store — not the à-la-carte $8/mo line |
| **AI Builder white-label** (media companies) | **Book a meeting** | `/contact-us` — subject: *AI Builder White Label* |
| **Private custom agent** (bespoke AI agent) | **Book a meeting** | Not self-serve — `/contact-us` — subject: *Private Custom Agent* |

Standard **Grabio Guide** (`ai_agent` module) — **usage is free** for setup, modules, pricing, and admin navigation.

**Not free (uses AI credits):** Content Creator, Market Strategy, Proposal Writer, SEO Assistant, Business Insights, Campaign Writer — under `/admin/ai/*`. Guide redirects users there when they ask for consulting or generated content.

| Paid AI tool | Route |
|--------------|-------|
| Content Creator | `/admin/ai/content-creator` |
| Market Strategy | `/admin/ai/market-strategy` |
| Proposal Writer | `/admin/ai/proposal-writer` |
| SEO Assistant | `/admin/ai/seo-assistant` |
| Business Insights | `/admin/ai/business-insights` |
| Campaign Writer | `/admin/ai/campaign-writer` |

Credits hub: `/admin/ai-builder`

---

## Template & storefront builder (owner-confirmed)

**Default recommendation:** Classic Template or AI Builder — not WP/Shopify-style unless migrating.

| Priority | Path | Route | What it is |
|----------|------|-------|------------|
| **1** | **Classic Template** | `/admin/templates` | Native Grabio drag-and-drop — **default for new stores** |
| **2** | **AI Builder** | `/admin/ai-builder` | AI generates/edits site without picking a template |
| 3 | Shopify-style Theme Editor | `/admin/theme-editor` | Optional — migration / familiar workflow |
| 3 | WordPress | `/admin/builder` | Optional — legacy WP teams / migration |

### AI without templates

Enable **`ai_agent`** (`/admin/ai-agent` — Sally) and **`ai_builder`** (`/admin/ai-builder`) — **no Classic / Theme Editor / WP required** for AI-first setup.

### Imports (migration only)

| Capability | Notes |
|------------|-------|
| Import Shopify | Migrate catalog — then prefer Classic or AI Builder for live store |
| Import WordPress | Migrate WP data — WP path optional ongoing |

Admin: `/admin/wordpress-queue` · Public WP access: `/wordpress/access`

**Guide rule:** Map competitor questions to these Grabio paths — do not send users away from Grabio.

---

## Admin structure map

### Daily Operations
| Screen | Route | Module |
|--------|-------|--------|
| Inventory Overview | `/admin/inventory` | stock |
| Products | `/admin/products` | stock |
| Purchases | `/admin/purchases` | stock |
| Delivery | `/admin/delivery` | delivery |

### Sales & Customers
| Screen | Route | Module |
|--------|-------|--------|
| Orders | `/admin/orders` | invoicing |
| Scheduled Orders | `/admin/scheduled-orders` | invoicing |
| Grabio POS | `/admin/pos` | pos |
| Customers | `/admin/customers` | invoicing |
| Sales CRM | `/admin/crm` | crm |
| Payments | `/admin/payments` | payments |
| Analytics | `/admin/analytics` | analytics |

### Setup & Settings
| Screen | Route |
|--------|-------|
| Store Profile | `/admin/profile` |
| Payment Settings | `/admin/payments` |
| Announcements | `/admin/announcements` |
| Email Marketing | `/admin/marketing` |
| Subscription | `/subscription` |

### Template (storefront — all AI-powered)
| Screen | Route | Module |
|--------|-------|--------|
| Classic Template | `/admin/templates` | builder |
| Shopify-style Theme Editor | `/admin/theme-editor` | builder |
| WordPress | `/admin/builder` | builder |
| WordPress queue (admin) | `/admin/wordpress-queue` | builder |

### Business Tools
| Screen | Route | Module |
|--------|-------|--------|
| Business Finance | `/admin/finance/accounting` | invoice_manager |
| Invoice Manager | `/admin/invoice-manager/invoices` | invoice_manager |
| Account Statement | `/admin/account-statement` | analytics |
| Cash Collection | `/admin/cash-collection` | payments |
| Staff (Payroll) | `/admin/staff` | team |
| Sub-Accounts | `/admin/sub-accounts` | team |
| Marketplace Sync | `/admin/marketplace` | dropship |
| **AI Agent / Grabio Guide** | `/admin/ai-agent` | ai_agent |
| AI Builder | `/admin/ai-builder` | ai_builder |

### AI Tools (when module enabled)
| Tool | Route | Module |
|------|-------|--------|
| Content Creator | `/admin/ai/content-creator` | content_creator |
| Market Strategy | `/admin/ai/market-strategy` | market_strategy |
| Proposal Writer | `/admin/ai/proposal-writer` | proposal_writer |
| SEO Assistant | `/admin/ai/seo-assistant` | seo_assistant |
| Business Insights | `/admin/ai/business-insights` | analytics_insights |
| Campaign Writer | `/admin/ai/campaign-writer` | campaign_writer |

---

## New store setup checklist

1. **Store profile** — `/admin/profile` — name, phone, email, location, logo  
2. **Payments** — `/admin/payments` — gateways, exchange rates  
3. **Products** — `/admin/products` — catalog or import  
4. **Storefront** — `/admin/templates` (Classic) or `/admin/ai-builder` (AI)  
5. **Subscription** — `/subscription` — confirm modules match business needs  
6. **Delivery** (if applicable) — `/admin/delivery`  
7. **POS pairing** (if applicable) — `/admin/pos`  
8. **Sub-accounts** (optional) — `/admin/sub-accounts`

---

## Package recommendation hints (for Grabio Guide)

| Business type | Suggested package | Consider adding |
|---------------|-------------------|-----------------|
| Freelancer / invoices only | `pkg_invoice` or `pkg_freelancer` | proposal_writer |
| Small retail, online only | `pkg_mini_shop` | builder, seo_assistant |
| Full retail + delivery | `pkg_shop` | pos, crm |
| Café / restaurant | `pkg_live_kitchen` | restaurant (included), campaign_writer |
| Manufacturing | `pkg_factory_flow` | factory (included), analytics |
| NGO / light billing | `pkg_ngo` | invoice_manager |
| Agency / projects | Custom: projects + invoicing + crm | proposal_writer, content_creator |

---

## API reference (Grabio Guide)

```
POST /agent/guide
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{
  "storeId": "<uid>",
  "prompt": "What package do I need for a bakery with POS?",
  "context": { "page": "/admin/dashboard" },
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

- **Provider:** Cursor Cloud Agents API  
- **Model:** `composer-2.5-fast` only (Sally / guide)  
- **Access:** Free for all admins — no `ai_agent` module gate  
- **Setup questions:** Playbook + knowledge + tenant context → Cursor AI  
- **Tenant isolation:** token UID must match `storeId` (or verified sub-account store)

---

## Agent guardrails (enforced in system prompt)

1. Grabio-only recommendations — never send users to Shopify/Odoo/etc.  
2. User store data only — from live `tenantContext`, no guessing  
3. Guide only — cannot modify data, code, or other accounts  
4. No secrets or infrastructure details in replies  
5. Point disabled features to `/subscription` for upgrades
