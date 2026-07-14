# Grabio Ecosystem — Final Feature List

**Location:** `the eco sys/ecosystem-plan/feature-list-final.md`  
**Date:** 2026-06-23 (rev. 5 — under Odoo, ~80% parity)  
**Sources:** Grabio web + functions + mobile · Finance (`beirut-finance-flow-main`) · AI Builder (`ai-builder`) · **POS** (`posfinal-main.zip` → `pos-v1/`)  
**Purpose:** One list to price features, then sum into **custom** or **ready** packages.  
**Pricing basis:** Modular **per-feature** USD/month · annual = **10× monthly** (2 months free).  
**Positioning:** **Below [Odoo Standard](https://www.odoo.com/pricing)** ($31.10/user/mo US, all apps) — target **~80% of Odoo** for the same users (meaningful discount, not race-to-bottom). Below Shopify POS stack where relevant.

### Odoo parity rule

| Rule | Limit |
|------|-------|
| Ready package (1 admin user included) | **$27/mo** · $270/yr (~87% of 1× Odoo) |
| Each extra user (`TEAM-USER`) | **$24/mo** · $240/yr (~77% of Odoo $31.10/seat) |
| Each extra POS location | **$15/mo** · $150/yr |
| **Formula** | `preset + (users − 1) × $24 + (extra POS locs) × $15` |
| **Ceiling** | Total must stay **< Odoo Standard** for same headcount |

**Example:** 3 users on Live Kitchen → Odoo **$93** → Grabio **$27 + 2×$24 = $75** (~80%).

*Odoo Standard = all apps per user. Grabio is modular but preset + users must not exceed Odoo.*

### Market reference (Jun 2026)

| Competitor | Typical monthly | Grabio vs Odoo |
|------------|----------------|----------------|
| **Odoo Standard** | **$31.10/user** (all apps) | **Ceiling** — Grabio ≈ **80%** of Odoo total |
| Odoo Custom | $61/user | Grabio stays on Standard parity |
| Shopify Basic + POS Pro | $39 + $79/loc | Kitchen preset still under combined Shopify |
| Lightspeed Basic | ~$109 | Factory preset $27 ≪ Lightspeed |
| HubSpot CRM Starter | ~$20/seat | CRM bundle $12 < HubSpot |

---

## Summary

| | Count |
|---|------:|
| **Billable features priced** | **119** |
| **Shop package (1 user)** | **$27/mo** · $270/yr |
| **Live Kitchen (1 user, 1 POS loc)** | **$27/mo** · $270/yr |
| **Factory Flow (1 user)** | **$27/mo** · $270/yr |
| **NGO / Freelancer (1 user)** | **$22/mo** · $220/yr |
| **Extra user** | **$24/mo** · $240/yr |
| **Extra POS location** | **$15/mo** · $150/yr |
| **3 users (Kitchen example)** | **$75/mo** (Odoo $93) |

*Package totals in §S — verify after toggling features.*

---

## Ready packages → feature IDs (quick reference)

| Package | Key feature IDs |
|---------|-----------------|
| **Shop** | CORE-*, MKT-*, STK-01–04, WF-SHOP |
| **Live Kitchen** | WF-KITCHEN, PRD-06, POS-* (register), STK-*, REC-* |
| **Factory Flow** | WF-FACTORY, PRD-01–05, STK-* |
| **NGO / Freelancer** | CORE-INV-*, FIN-PORT-07, WF-NGO |
| **Custom** | Any row below |

---

## A. Workflow backends (tenant picks one on Grabio platform)

| ID | Feature | Grabio | POS | Finance | Status | Price |
|----|---------|:------:|:---:|:-------:|--------|-------|
| WF-SHOP | Shop — simple products, stock in/out | ✓ | ✓ | — | live | **included** |
| WF-KITCHEN | Live kitchen — recipe deducted **on sale** | — | **✓** | ref | port → Grabio | **$5/mo** · $50/yr |
| WF-FACTORY | Factory — BOM, batches, raw → finished | ✓ | partial | — | live | **$6/mo** · $60/yr |
| WF-NGO | NGO billing preset | plan | — | — | planned | **included** |
| WF-FREELANCE | Freelancer billing preset | plan | — | — | planned | **included** |
| WF-HOTEL | Hotels / hospitality | — | — | — | planned | **$18/mo** · $180/yr |

---

## B. Core platform (always on)

| ID | Feature | Grabio | POS | Finance | Status | Price |
|----|---------|:------:|:---:|:-------:|--------|-------|
| CORE-INV-01 | Invoicing & billing (PDF, WhatsApp, dual currency) | ✓ | ✓ | ✓ | live | **$5/mo** · $50/yr |
| CORE-INV-02 | Estimates / quotes → invoice | partial | — | ✓ | port | **$3/mo** · $30/yr |
| CORE-INV-03 | Receipts & payment orders | partial | ✓ | ✓ | port | **$3/mo** · $30/yr |
| CORE-PAY-01 | Payment gateways (OMT, Stripe, Square, Whish, BoB) | ✓ | partial | ✓ | live | **$4/mo** · $40/yr |
| CORE-PAY-02 | Expense tracking | ✓ | — | ✓ | live | **$3/mo** · $30/yr |
| CORE-PAY-03 | Bank reconciliation / cash collection | ✓ | — | — | live | **$6/mo** · $60/yr |
| CORE-DEL-01 | Delivery workflow + GPS + guest tracking | ✓ | — | ✓ | live | **$4/mo** · $40/yr |
| CORE-ANA-01 | Analytics & revenue dashboards | ✓ | partial | ✓ | live | **$3/mo** · $30/yr |
| CORE-ANA-02 | Account statements (AR/AP) | ✓ | ✓ | ✓ | live | **$4/mo** · $40/yr |
| CORE-ANA-03 | Exportable reports (PDF/CSV/Excel) | ✓ | ✓ | ✓ | live | **$3/mo** · $30/yr |
| CORE-SUB-01 | Subscription, trial, plan limits | ✓ | — | — | live | **included** |
| CORE-GDPR-01 | GDPR export & deletion | ✓ | — | — | live | **included** |
| CORE-CON-01 | Contact us (public form) | ✓ | — | — | live | **included** |

---

## C. Commerce & marketplace

| ID | Feature | Grabio | POS | Status | Price |
|----|---------|:------:|:---:|--------|-------|
| MKT-01 | Online storefront + cart + checkout | ✓ | — | live | **$16/mo** · $160/yr |
| MKT-02 | Platform marketplace search | ✓ | — | live | **$3/mo** · $30/yr |
| MKT-03 | Custom domain storefront | ✓ | — | live | *in ADD-DOMAIN* |
| MKT-04 | Product reviews | ✓ | — | live | **$2/mo** · $20/yr |
| MKT-05 | Favorites & customer profiles | ✓ | — | live | **$2/mo** · $20/yr |
| MKT-06 | Store announcements + push | ✓ | — | live | **$2/mo** · $20/yr |
| MKT-07 | Guest browse & checkout | ✓ | — | live | **included** w/ MKT-01 |
| MKT-08 | Buyer → seller upgrade | ✓ | — | live | **included** |
| MKT-09 | Meta catalog + shop + Instagram + ads API | ✓ | — | live | **$8/mo** · $80/yr |
| MKT-10 | Meta Pixel + Conversion API | ✓ | — | live | **$3/mo** · $30/yr |
| ADD-DOMAIN | Custom domain package add-on | ✓ | — | live | **$8/mo** · $80/yr |
| ADD-WA | WhatsApp Business add-on | ✓ | — | live | **$6/mo** · $60/yr |
| APP-WL | White-label buyer mobile app | partial | — | partial | **$18/mo** · $180/yr |

---

## D. Inventory & stock

| ID | Feature | Grabio | POS | Status | Price |
|----|---------|:------:|:---:|--------|-------|
| STK-01 | Product catalog (simple + service) | ✓ | ✓ | live | **$3/mo** · $30/yr |
| STK-02 | Inventory levels & dashboard | ✓ | ✓ | live | **$3/mo** · $30/yr |
| STK-03 | Purchase orders | ✓ | ✓ | live | **$4/mo** · $40/yr |
| STK-04 | Suppliers master | ✓ | ✓ | live | **$2/mo** · $20/yr |
| STK-05 | Supplier statements (AP) | ✓ | ✓ | live | **$3/mo** · $30/yr |
| STK-06 | Low-stock & expiry alerts | ✓ | ✓ | live | **$2/mo** · $20/yr |
| STK-07 | Supplier returns | ✓ | ✓ | live | **$3/mo** · $30/yr |
| STK-08 | Supplier credits | stub | — | stub | **$2/mo** · $20/yr |
| STK-09 | Dropship (Shein sync) | partial | — | partial | **$6/mo** · $60/yr |
| STK-10 | Deliveries receive + weighted avg cost | — | **✓** | port | **$3/mo** · $30/yr |
| STK-11 | Supplier balances & payments (register) | partial | **✓** | merge | **$3/mo** · $30/yr |
| STK-12 | SIM / legacy backup import | — | — | port | **$15** one-time |

---

## E. Production, recipes & kitchen

| ID | Feature | Grabio | POS | Status | Merge winner | Price |
|----|---------|:------:|:---:|--------|--------------|-------|
| PRD-01 | Raw materials | ✓ | ✓ | live | Grabio web | **$4/mo** · $40/yr |
| PRD-02 | Recipes / BOM editor | ✓ | **✓** | live | Platform | **$4/mo** · $40/yr |
| PRD-03 | Production batches (factory) | ✓ | — | live | Grabio | **$6/mo** · $60/yr |
| PRD-04 | Finished goods inventory | ✓ | — | live | Grabio | **$4/mo** · $40/yr |
| PRD-05 | Composed sellable products | ✓ | **✓** | live | Platform | **$3/mo** · $30/yr |
| PRD-06 | **Live deduction on sale** (kitchen) | — | **✓** | live POS | Port → Grabio | **$5/mo** · $50/yr |
| PRD-07 | FIFO / LIFO / weighted-average costing | ✓ | WAC | live | Unify | **$3/mo** · $30/yr |
| PRD-08 | Composed service bundles | type only | — | planned | Grabio | **$4/mo** · $40/yr |
| PRD-09 | Recipe snapshot history on sale | — | ✓ | live | Port | **$2/mo** · $20/yr |

---

## F. POS register & in-store (`pos` app — **$15/mo per extra location**; 1st loc included in Live Kitchen preset)

*Odoo includes POS in the user seat — no $79 POS Pro surcharge. À la carte POS rows are reference only; use **POS-BUNDLE**.*

| ID | Feature | POS module | Status | Price |
|----|---------|------------|--------|-------|
| **POS-BUNDLE** | **Full POS register (1 location)** | all | live | **$15/mo** · $150/yr **/extra location** · *1st included in Kitchen* |
| POS-01 | Register checkout & cart | `pos-core.js` | live | $3/mo |
| POS-02 | Categories + product grid | `categories.js` | live | $2/mo |
| POS-03 | Barcode scanner | `barcode-scanner.js` | live | $2/mo |
| POS-04 | Cash, card, on-account payments | `payment.js` | live | $2/mo |
| POS-05 | Partial payments / down payment | `partial-payments.js` | live | $2/mo |
| POS-06 | Hold & retrieve unpaid orders | `unpaid-orders.js` | live | $1/mo |
| POS-07 | Bill payments (customer account) | `bill-payments.js` | live | $2/mo |
| POS-08 | Refunds (full / partial) | `refunds.js` | live | $1/mo |
| POS-09 | Purchase returns | `purchase-returns.js` | live | $1/mo |
| POS-10 | Receipt print + branding | `receipt.js` | live | $1/mo |
| POS-11 | Cash drawer & shift tracking | `cash-drawer.js` | live | $2/mo |
| POS-12 | Customer-facing second display | `customer-display.js` | live | $2/mo |
| POS-13 | Virtual keyboard (touch) | `virtual-keyboard.js` | live | included |
| POS-14 | Tax & discount on sale + reports | `payment.js`, `reports.js` | live | included w/ POS-01 |
| POS-15 | Phonebook / client registry | `phonebook.js` | live | $1/mo |
| POS-16 | Offline SQLite + auto-backup | `db.js` | live | $3/mo |
| POS-17 | Disaster recovery backup / restore | `disaster-recovery.js` | live | $2/mo |
| POS-18 | Electron Windows desktop | `electron-main.js` | live | included w/ POS-BUNDLE |
| POS-19 | Browser / PWA mode | `sw.js` | live | included |
| POS-20 | Multi-user roles (cashier / admin) | `auth.js` | live | $2/mo |
| POS-21 | Dark / light theme | `theme-switcher.js` | live | included |
| POS-22 | In-store balance / P&L dashboard | `balance-dashboard.js` | live | $2/mo |
| POS-23 | VPS multi-branch sync | `sync-manager.js` | partial | **$6/mo** · $60/yr |
| POS-24 | Export CSV / PDF / Excel | `data-export.js` | live | $1/mo |
| POS-25 | Sales history + filtering | `reports.js` | live | $2/mo |
| POS-26 | POS mobile app | — | planned | **$10/mo** · $100/yr |
| POS-27 | Grabio Firebase ecosystem sync | — | planned | **included** w/ platform |

---

## G. CRM & team

| ID | Feature | Grabio | POS | Status | Price |
|----|---------|:------:|:---:|--------|-------|
| CRM-01 | Pipeline kanban | ✓ | — | live | **$2/mo** · $20/yr |
| CRM-02 | Activities + GPS + map | ✓ | mobile | live | **$3/mo** · $30/yr |
| CRM-03 | Rep provisioning + portals | ✓ | — | live | **$2/mo** · $20/yr |
| CRM-04 | Order → CRM sync | ✓ | — | live | **$2/mo** · $20/yr |
| **ADD-CRM** | **Sales CRM bundle (CRM-01–04)** | ✓ | — | live | **$12/mo** · $120/yr |
| **TEAM-USER** | **Extra admin / staff user** | ✓ | ✓ | live | **$24/mo** · $240/yr |
| TEAM-01 | Sub-accounts & RBAC | ✓ | ✓ | live | **$4/mo** · $40/yr |
| TEAM-02 | Staff directory | ✓ | ✓ | live | **$2/mo** · $20/yr |
| TEAM-03 | Salaries / payroll | ✓ | **✓** | live | **$4/mo** · $40/yr |
| TEAM-04 | Staff attendance + check-in/out | — | **✓** | merge | **$3/mo** · $30/yr |
| TEAM-05 | Attendance correction (last record) | — | **✓** | merge | **$2/mo** · $20/yr |
| TEAM-06 | Audit logs | ✓ | — | live | **$2/mo** · $20/yr |
| TEAM-07 | Customers master | ✓ | ✓ | live | **$2/mo** · $20/yr |
| TEAM-08 | Dashboard quick-action customization | ✓ | — | live | **included** |

---

## H. PSA & projects (Finance leads → Grabio port)

| ID | Feature | Finance | Grabio | Status | Price |
|----|---------|:-------:|:------:|--------|-------|
| PSA-01 | Client projects | ✓ | — | port | **$6/mo** · $60/yr |
| PSA-02 | Tasks & billable timesheets | ✓ | — | port | **$5/mo** · $50/yr |
| PSA-03 | AI proposal generation (RFP) | ✓ | — | port | **20 credits** / proposal |
| PSA-04 | PSA admin dashboard | ✓ | — | port | **$3/mo** · $30/yr |
| PSA-05 | Multi-org / org members | ✓ | — | port | **$5/mo** · $50/yr |
| **PSA-BUNDLE** | Projects + tasks + dashboard | ✓ | — | port | **$12/mo** · $120/yr |

---

## I. Invoice Manager app features

| ID | Feature | Finance | Grabio target | Status | Price |
|----|---------|:-------:|:-------------:|--------|-------|
| INV-01 | Invoice Manager mobile app shell | ✓ | port | live | **$6/mo** · $60/yr |
| INV-02 | Portfolio PDF (credentials doc) | stub | build | stub | **$4/mo** · $40/yr |
| INV-03 | Multi-currency / FX settings | ✓ | port | port | **$3/mo** · $30/yr |
| INV-04 | Company profile (Finance) | ✓ | merge | port | **included** |
| INV-05 | Finance premium / Stripe tier | ✓ | merge | port | **included** |
| INV-06 | PWA install prompt | ✓ | optional | port | **included** |

*No composed-product authoring in Invoice Manager app (platform only).*

---

## J. Marketing & SEO

| ID | Feature | Grabio | Status | Price |
|----|---------|:------:|--------|-------|
| SEO-01 | SEO analytics dashboard | ✓ | live | **$3/mo** · $30/yr |
| SEO-02 | Google Search Console audit | ✓ | live | **$4/mo** · $40/yr |
| SEO-03 | Crawl audit dashboard | partial | partial | **$3/mo** · $30/yr |
| SEO-04 | Sitemap + robots.txt | ✓ | live | **included** |
| SEO-05 | Per-store SEO meta + robots editor | ✓ | live | **$3/mo** · $30/yr |
| MKTG-01 | Email subscribers & campaigns | ✓ | live | **$6/mo** · $60/yr |
| MKTG-02 | Store templates & themes | ✓ | live | **included** |
| MKTG-03 | Free standard templates | ✓ | live | **included** |
| MKTG-04 | Paid custom templates | ✓ | live | **$12** one-time / template |
| BLOG-01 | Tenant blog / CMS | — | planned | **$5/mo** · $50/yr |
| WEB-01 | Web Builder (drag-drop hosted site) | — | planned | **$8/mo** · $80/yr |

---

## K. AI & credits (prepaid — not monthly; all agents draw from balance)

| ID | Feature | Status | Price (credits) |
|----|---------|--------|-----------------|
| **AI-CREDITS-S** | Credit pack — 100 credits | live | **$8** |
| **AI-CREDITS-M** | Credit pack — 350 credits | live | **$20** |
| **AI-CREDITS-L** | Credit pack — 1,000 credits | live | **$50** |
| AI-01 | AI settings + model catalog | live | included |
| AI-03 | AI Workflow Agent | partial | **3–8 credits** / session |
| AI-04 | AI Builder — wizard | port | **15–40 credits** / project |
| AI-05 | AI Builder — editor + preview | port | **2–5 credits** / edit |
| AI-06 | AI Builder — chat / codegen | port | **1–3 credits** / 1K tokens |
| AI-07 | AI Builder — publish share link | partial | **5 credits** / publish |
| AI-08 | Content Creator | planned | **2–6 credits** / draft |
| AI-09 | Market Strategy | planned | **8–15 credits** / report |
| AI-10 | Proposal Writer | port | **20 credits** / proposal |
| AI-11 | SEO Assistant | planned | **2–4 credits** / page |
| AI-12 | Business Insights | planned | **5–10 credits** / insight |
| AI-13 | Campaign / promo writer | partial | **2–5 credits** / campaign |
| AI-14 | Email marketing AI drafts | partial | **2–4 credits** / email |

---

## L. Native apps

| ID | App | Codebase | Status | Price |
|----|-----|----------|--------|-------|
| APP-ADMIN | Grabio Admin Android | `grabio-mobile/` | live | **included** w/ platform |
| APP-INV | Invoice Manager app | Finance → Firebase | live | **$6/mo** · $60/yr (= INV-01) |
| APP-POS-WIN | Grabio POS Windows | `pos-v1/` | **live** | **$15/mo** · $150/yr **/extra loc** (= POS-BUNDLE) |
| APP-POS-MOB | Grabio POS mobile | — | planned | **$10/mo** · $100/yr |
| APP-WL | White-label store app | `white-label-client-app/` | partial | **$18/mo** · $180/yr |

---

## M. Security & notifications

| ID | Feature | Grabio | POS | Status | Price |
|----|---------|:------:|:---:|--------|-------|
| SEC-01 | Admin MFA / TOTP | ✓ | — | live | **included** |
| SEC-02 | Admin IP allowlist | ✓ | — | live | **$2/mo** · $20/yr (Business tier) |
| SEC-03 | Privacy policy generator | ✓ | — | live | **included** |
| NOTIF-01 | FCM push (orders, stock, announcements) | ✓ | — | live | **included** |
| NOTIF-02 | Transactional email | ✓ | — | live | **included** |
| NOTIF-03 | Order notification retry API | ✓ | — | live | **included** |

---

## N. Stripe add-ons (live today)

| ID | Add-on | Market-aligned price |
|----|--------|---------------------|
| ADD-CRM | Sales CRM bundle | **$12/mo** · $120/yr |
| ADD-DOMAIN | Custom domain + hosting | **$8/mo** · $80/yr |
| ADD-WA | WhatsApp Business | **$6/mo** · $60/yr |
| ADD-STORAGE | Extra 5 GB | **$2/mo** · $20/yr |
| TEAM-USER | Extra user seat | **$24/mo** · $240/yr |

---

## S. Ready package totals (~80% of Odoo — 1 user included)

| Package | Features included | **Monthly** | **Annual** | vs Odoo |
|---------|-------------------|------------:|-----------:|---------|
| **Shop** | CORE-INV-01, PAY-01, DEL-01, ANA-01, MKT-01, STK-01–02 | **$27** | **$270** | 1 user: Odoo $31 → Grabio **$27** (87%) |
| **Live Kitchen** | Shop core + kitchen + POS (1 loc) + STK-03–06 | **$27** | **$270** | 1 user: under Odoo w/ POS |
| **Factory Flow** | Shop core + WF-FACTORY + PRD + STK | **$27** | **$270** | 1 user: under Odoo w/ MRP |
| **NGO / Freelancer** | CORE-INV-01, INV-01, INV-02 | **$22** | **$220** | Narrow billing scope |
| **Full commerce** | Shop + ADD-CRM + SEO-01 + MKTG-01 | **$30** | **$300** | Bundled under 1× Odoo |

### Multi-user (target ~80% of Odoo)

| Users | Odoo Standard | Grabio (preset $27 + users) | % of Odoo |
|------:|--------------:|----------------------------:|----------:|
| 1 | $31.10 | **$27** | 87% |
| 3 | $93.30 | **$75** ($27 + 2×$24) | **80%** |
| 5 | $155.50 | **$123** ($27 + 4×$24) | 79% |
| 10 | $311.00 | **$243** ($27 + 9×$24) | 78% |

*You set the floor: if Odoo is $93 for 3 users, Grabio is **$75**, not $53.*

### Shop breakdown ($/mo)

| ID | $/mo |
|----|-----:|
| CORE-INV-01 | 5 |
| CORE-PAY-01 | 4 |
| CORE-DEL-01 | 4 |
| CORE-ANA-01 | 3 |
| MKT-01 | 16 |
| STK-01 | 3 |
| STK-02 | 3 |
| **À la carte** | **38** → **preset $27** (package bundle) |

### Live Kitchen breakdown ($/mo)

| ID | $/mo |
|----|-----:|
| Shop preset | 27 |
| WF-KITCHEN + PRD + STK extras + POS (1 loc) | *bundled in preset* |
| **1 user total** | **$27** |
| **3 users total** | **$75** |

*2nd POS location: +$15/mo (does not require extra user seat).*

### Factory Flow breakdown ($/mo)

| ID | $/mo |
|----|-----:|
| Shop preset | 27 |
| WF-FACTORY + PRD + STK extras | *bundled in preset* |
| **1 user total** | **$27** |

### NGO / Freelancer breakdown ($/mo)

| ID | $/mo |
|----|-----:|
| CORE-INV-01 | 5 |
| INV-01 | 6 |
| INV-02 | 4 |
| WF-NGO / WF-FREELANCE | included |
| **Preset** | **$22** |

---

## O. Do not price yet (stub / internal)

| Item | Where |
|------|--------|
| Supplier credits UI | Grabio stub |
| Crawl audit (unrouted) | Grabio |
| Credits page | Grabio removed |
| `manufacturingBom` add-on flag | unused |
| POS supplier return reminder job | not exported |
| POS roadmap: loyalty, email receipts, forecasting | `FUTURE_FEATURES.md` |

---

## P. POS ↔ Grabio merge map (no duplicates after merge)

| Capability | Keep after merge | Retire / local-only |
|------------|------------------|---------------------|
| Register checkout UX | POS app shell | — |
| Live kitchen deduction | Port from POS → Firebase | POS local DB optional offline |
| Factory batches | Grabio web | POS duplicate |
| Templates / invoices | **Grabio** | POS receipt stays in POS app |
| Composed product source | Ask at POS connect: **platform** or **POS** | Dual BOM forbidden |
| Staff attendance at register | Port from POS | — |
| Offline SQLite | POS register only | Not second Firestore |
| Customers / suppliers | **Grabio Firebase** | Sync to POS |

**POS source path:** `the eco sys/ecosystem-plan/posfinal-main/pos-v1/` (extracted from zip)

---

## Q. Pricing workflow

1. User toggles features on `/pricing` or picks a ready package.
2. **Sum `$ /mo` column** (use bundle rows: POS-BUNDLE, ADD-CRM, PSA-BUNDLE).
3. **Preset (1 user):** Shop / Kitchen / Factory **$27/mo**; NGO **$22/mo**.
4. **Extra users:** `TEAM-USER` **$24/mo** each → 3 users = **$75** when Odoo = **$93**.
5. **Extra POS locations:** **$15/mo** each (1st included in Live Kitchen).
6. **Hard ceiling:** total must stay **below Odoo Standard** for same user count.
7. AI = prepaid credit packs (**§K**). Annual = monthly × 10.
8. **Production today** still uses legacy tiers ($10/$20/$30) until entitlements ship.

---

## R. File index (ecosystem-plan folder)

| File | Role |
|------|------|
| `feature-list-final.md` | **This file** — master list for pricing |
| `feature-list.md` | Detailed rev. 2 + appendices |
| `feature-inventory-study.md` | Audit + merge study |
| `plan-ecosys.md` | Architecture + safety rules |
| `grabio-builder-prompt-packages.md` | Package presets + onboarding |
| `posfinal-main.zip` | Windows POS source (extract `pos-v1/`) |

---

*Final feature list — rev. 5 Jun 2026. Under Odoo Standard (~80% parity). Example: 3 users → Odoo $93, Grabio $75. Review before `subscription.ts`.*
