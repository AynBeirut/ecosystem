# Grabio — Modular Package System + Smart Suggestion Engine
## Builder Implementation Prompt

You have access to the existing Grabio codebase, module manifest, and feature flag system (as shown on grabio.space). Implement the following package architecture on top of the existing modular core.

---

## 0. Main plan (primary onboarding)

Every new tenant chooses **one of two equal entry paths**:

1. **Customize your package** — build your own module stack from the full catalog (blank start, user toggles modules).
2. **Choose a ready package** — pick one of five presets below (defaults applied; all modules remain individually toggleable afterward).

Neither path is secondary. Custom is not a fallback — it is co-primary with ready packages.

After either path: run the smart suggestion engine (Section 2) for contextual module recommendations.

---

## 1. Package System Overview

Grabio ships 5 starting packages. Packages are **presets, not locked tiers** — every module remains individually toggleable regardless of which package the user starts from. Packages only determine: (a) which modules are active by default at signup, and (b) which onboarding question set runs.

### Package Defaults (bare minimum only)

**Shop**
- Inventory (simple products only)
- Invoicing & Billing (core, always-on)
- Online Marketplace (included by default — not optional for this package only)

**Live Kitchen**
- Inventory (simple + composed products/services)
- Composed Products & Services module
- POS
- Restaurant Production (live deduction: recipe/BOM consumed instantly at point of sale — no separate production phase, no finished-goods stage)

**Factory Flow**
- Inventory (simple + composed + raw materials)
- Factory & Production (full BOM, batch production runs, raw-to-finished-goods tracking, finished goods inventory)

**NGO**
- Invoicing & Billing (core, always-on)
- Invoice Manager → Portfolio PDF feature (standalone — see Section 3)
- No inventory module active

**Freelancer**
- Invoicing & Billing (core, always-on)
- Invoice Manager → Portfolio PDF feature (standalone — see Section 3)
- No inventory module active

### Universal Rules
- Online Marketplace / e-commerce storefront is **optional add-on for every package except Shop**, where it ships included.
- Any module from the full catalog (CRM, PSA, Web Builder, AI tools, POS, Team & Sub-Accounts, Dropship Sync, Service Subscriptions, etc.) can be added to any package at any time. Packages never restrict what a user can ultimately activate.
- A user on the **Customize your package** path starts from a blank module stack (core invoicing only).
- A user on the **Choose a ready package** path picks one of five presets below.

---

## 2. Smart Suggestion Engine (Contextual, Not Static)

After a user selects a starting package, do not auto-bundle additional modules. Instead, run a short contextual onboarding flow that asks targeted questions and recommends modules dynamically based on answers — not a fixed if-package-X-then-suggest-Y rule table.

### Required onboarding question categories (logic should branch per package):
- Team size / do you have staff beyond yourself? → suggests Team & Sub-Accounts, and conditionally Sales CRM if staff includes sales roles
- Do you sell or plan to sell online? → suggests Online Marketplace (for non-Shop packages)
- Do you manage client projects or recurring engagements? → suggests Projects (PSA) — primarily surfaced for NGO/Freelancer at a later maturity stage, not at first signup
- Do you need to send proposals or quotes to clients? → suggests Proposal Writer (AI tool)
- Do you need a website or landing page? → suggests Web Builder (distinct from the Invoice Manager Portfolio PDF feature — see Section 3 for the difference)
- Do you operate from multiple locations or branches? → suggests Multi-location inventory visibility (Factory Flow / Live Kitchen relevant)
- Do you want help with marketing/content/customer support? → surfaces relevant AI Suite tools (Content Creator, Market Strategy, Email Marketing, SEO Assistant, Business Insights)

### Growth-stage logic (NGO + Freelancer specific)
These two packages should NOT be offered PSA or full Proposal Writer at initial signup. Surface them as a **second-stage suggestion** once usage signals maturity — e.g., after the user has created multiple invoices, added a second client, or explicitly asks "what else can I do here?" Implement this as a tiered suggestion timing, not a hard gate — the user can still manually activate these modules early if they want.

### Implementation requirement
Build this as a recommendation engine that takes onboarding answers + package selection as input and outputs a ranked list of suggested modules with a one-line reason for each suggestion (e.g., "You mentioned managing a sales team — Sales CRM adds GPS visit tracking and pipeline stages"). User can accept individual suggestions one at a time, not just "accept all."

---

## 3. Invoice Manager — Portfolio PDF (Standalone Feature)

This is NOT the Web Builder module. It does not produce a live website. It is a standalone feature inside the existing Invoice Manager module.

### Functional spec:
- User selects a template (multiple layout options)
- User uploads images and inputs text into template fields (project samples, bio, service descriptions, testimonials, etc.)
- Output: a generated PDF document — a portfolio/credentials document
- This PDF is **standalone** — it is NOT automatically attached to an invoice, NOT a cover page prepended to invoices, and NOT linked to the invoice-sending flow
- User can generate, save, re-edit, and re-export this PDF independently from any invoice or client record
- Primary use case: NGOs and Freelancers sending a portfolio/credentials document to a prospective client or donor, separate from billing

### Distinction to enforce in UI/UX copy:
- "Portfolio PDF" (Invoice Manager) = static document export, template-based, image+text only, no hosting, no domain, no live URL
- "Web Builder" (separate module, in development) = live website/landing page, drag-and-drop, hosted, has a URL, AI site generation at end of wizard

Do not let these two features share UI language that could confuse users into thinking they're the same capability.

---

## 4. Module Dependency Rules

Implement the following constraints in the module activation logic:

1. **Live Kitchen's live production logic and Factory Flow's full production logic are mutually exclusive at the inventory-deduction level.** A single store/tenant cannot run both simultaneously, since they represent two different stock-deduction models (instant deduction at sale vs staged batch production with finished-goods inventory). If a user wants both behaviors for different product lines, this requires a future multi-profile inventory mode — flag as a backlog item, do not attempt in this implementation.
2. Sales CRM does not hard-require Team & Sub-Accounts to be active, but the onboarding suggestion engine should default to recommending Sub-Accounts alongside CRM whenever a user indicates they have sales staff, since CRM reps are managed through the sub-account/role system.
3. PSA does not need a separate dependency check on Invoicing, since Invoicing & Billing is a core module that is always active for every tenant regardless of package.

---

## 5. Naming Reference (for UI labels — do not alter)

| Internal Package Key | Display Name |
|---|---|
| `pkg_shop` | Shop |
| `pkg_live_kitchen` | Live Kitchen |
| `pkg_factory_flow` | Factory Flow |
| `pkg_ngo` | NGO |
| `pkg_freelancer` | Freelancer |

---

## 6. Out of Scope for This Build Phase

- No pricing logic — pricing architecture will be defined separately and is not part of this implementation
- No changes to existing live/beta module functionality (Invoicing, Marketplace, Analytics, Payments, Delivery, Inventory, Sales CRM, Admin App)
- Web Builder, AI Builder, PSA, Blog Publisher remain "in development" — only wire up the suggestion engine references to them, do not build their internal functionality in this phase

---

Reply "confirm" or ask clarifying questions before starting Phase 0 (package presets + module manifest update + onboarding question schema).
