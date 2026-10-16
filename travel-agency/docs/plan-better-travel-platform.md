# Plan — Travel platform better than Nextra + TravelBoost + Iween (for your client)

**Context:** Client already runs **Nextra** (agent portal: flights, hotels, activities, cabs, group tours, wallet/credit, bookings, basic reports). They are **evaluating** [TravelBoost Proposals](https://travelboost.app/products/proposals) and [Iween](https://www.iweensoft.com).  
**Goal:** One coherent product that beats **all three together** and clearly beats **what they have today** on Nextra.  
**Status:** **Implemented (scaffold)** — see [architecture.md](../architecture.md), [web/README.md](../web/README.md). Confirm Nextra API field mapping with client before production.

---

## 1. Where each option stops short

| Capability | Client’s Nextra today | TravelBoost | Iween | Gap for your client |
|------------|----------------------|-------------|-------|---------------------|
| Book flights/hotels/etc. | ✓ Agent portal | Partial / CRM-led | ✓ Mid-office + APIs | Nextra works; **sales layer is weak** |
| Wallet + agent credit | ✓ | ? | ✓ | Good ops; **not tied to CRM/deals** |
| Interactive proposals | ✗ (booking-first UI) | ✓✓ Core product | ✗ | **Why they’re looking at TravelBoost** |
| Proposal engagement (opens, sections) | ✗ | ✓ | ✗ | Follow-up is blind today |
| Accept → deposit → confirm | Checkout in portal | ✓ One-click | Varies | **No single “deal” object** end-to-end |
| CRM (leads, pipeline, tasks) | Minimal (reports only) | ✓ Travel-specific | Ops-focused | **Internal workflow is the pain** |
| API / supplier scale | Nextra-hosted | Rate cards import | ✓✓ 30+ integrations | Iween wins **only if** they outgrow Nextra inventory |
| Brand | Subdomain white-label | Strong proposal brand | Platform brand | **Client brand on every customer touch** |
| Finance trail | Ledger in portal | Invoice on accept | Mid-office | **No Grabio-grade docs** (invoice, receipt, VAT) unless added |

**Insight:** They don’t need “another booking site.” They need **sell → convince → collect → book → reconcile** in one place, with Nextra (or similar) as **inventory engine** until/unless you replace it.

---

## 2. What we do better (positioning)

**One platform, three layers — not three vendors:**

1. **Grow** — CRM + pipeline + tasks (beat empty “reports” on Nextra).
2. **Win** — Proposals/quotes **better than TravelBoost** for *their* workflow: live margin, multilingual, accept + deposit, **linked to the same booking ref** (TravelBoost often feels like a separate CRM SKU).
3. **Operate** — Keep or integrate **Nextra-class** booking + wallet; add **owner dashboards** (margin, agent performance, dues) and **human document numbers** everywhere.

**Differentiators we can actually own (leverage Grabio):**

- **Finance-native:** quotation → proforma → invoice → receipt → ledger (already in Grabio invoice mobile / finance patterns).
- **Tenant-safe CRM** (store-scoped agents, no cross-agency leaks).
- **Proposal + booking same `dealId`:** customer sees `QT-…` / `BK-…`; memos never show Firebase/POS-style opaque ids.
- **WhatsApp / email share** of proposal links (region-critical; Nextra portal is login-heavy for agents only).
- **Hybrid integration:** Phase 1 **does not** require ripping out Nextra — agents book where inventory already works; **our layer** owns client relationship and quotes.

---

## 3. Target product (v1 vision)

### A. Agent & owner console (replace “spreadsheet + Nextra tabs”)

- Lead/inquiry capture (web form, WhatsApp handoff, walk-in).
- Pipeline: *Inquiry → Quoted → Awaiting deposit → Booked → Traveled → Closed*.
- Tasks & SLAs (“send revised quote in 24h”).
- Client 360°: every quote, booking, payment, note.

### B. Proposal & quotation (beat TravelBoost)

- Day-by-day builder + packages (fit **group tours** and custom FIT).
- **Live margin** from rate card OR manual lines (for non-GDS products).
- Shareable link + PDF; agency branding (logo, colors, T&Cs).
- **v1.1:** section-level engagement (opens/time) — match TravelBoost.
- **v1.0 must-have:** accept + record deposit (payment method chips, due dates — reuse Grabio finance UX).

### C. Booking & inventory (beat “only Nextra” by integration, not day-one rebuild)

- **Phase 1:** Deep link or API bridge to Nextra for search/book; store **booking ref + PNR** on the deal.
- **Phase 2:** Additional suppliers via gateway (Iween-style) only where Nextra is thin (e.g. specific DMC, insurance).

### D. Money

- Wallet/credit **mirror** or import from Nextra where possible; internal ledger for quotes/deposits we control.
- Owner view: agent credit, dues, margin by trip (screenshot showed balance/credit/due — make that **reportable and alertable**).

### E. Customer experience

- Customer gets **magazine-style proposal** (TravelBoost bar), not agent login.
- Optional: “my trip” page post-booking (itinerary, vouchers) — lighter than full OTA app.

---

## 4. Phased delivery (sellable to client)

| Phase | Duration (indicative) | Deliverable | Client outcome |
|-------|------------------------|-------------|----------------|
| **0 — Discovery** | 1–2 weeks | Supplier list, markets, languages, payment methods, Nextra API/access check | Go/no-go on hybrid vs replace |
| **1 — CRM + quotes** | 6–10 weeks | Pipeline, contacts, quote builder, PDF/link, accept + deposit invoice | **Immediately better than Nextra-only** for sales |
| **2 — Nextra bridge** | 4–6 weeks | Attach bookings to deals; import booking list; wallet snapshot | **One screen** for “what we sold vs what we booked” |
| **3 — Proposal intelligence** | 4 weeks | Engagement analytics, templates, AI draft (optional) | **Parity/surpass TravelBoost** on conversion tools |
| **4 — Integration hub** | Ongoing | Extra APIs where ROI clear | **Iween-class** only where needed |

**MVP rule:** Phase 1 alone must be compelling enough that the client stops shopping TravelBoost for *quoting*.

---

## 5. Architecture direction (summary)

- **New product module** under Grabio ecosystem OR dedicated Firebase project `travel-agency-*` with same tenant rules as Rule 35.
- **Core entities:** `Agency`, `Agent`, `Contact`, `Deal`, `QuoteVersion`, `BookingLink`, `Payment`, `Task`.
- **Integration service:** `nextraAdapter` (auth, search, book, wallet read) — isolate vendor swap later.
- **Public:** proposal viewer (static/SSR link, signed token).

Detail: `architecture.md` (update when Phase 0 completes).

---

## 6. Why not “just buy TravelBoost + keep Nextra”?

- **Two systems:** quotes in TravelBoost, bookings in Nextra → duplicate clients, manual reconciliation, agents hate it.
- **Iween** is heavy and enterprise-priced for an agency that **already has** Nextra inventory.
- **Custom layer** on Grabio: you control roadmap, local payments, Arabic/EN, and **one invoice story** the client already trusts you to deliver.

---

## 7. Client discovery checklist (next call)

1. Markets & currencies (Nextra demo is INR-heavy — confirm theirs).
2. Team size: agents, sub-agents, branches.
3. % revenue: packages vs flight-only vs hotels.
4. Must-have suppliers beyond Nextra.
5. Nextra contract: API, export, or screen-only?
6. Pain ranked: quoting time, follow-up, margin visibility, credit control, reporting.
7. Budget band: SaaS fees vs build (phased).

---

## 8. Success metrics (agree with client)

- Time to send first quote (target: **&lt;15 min** for standard package).
- Quote-to-book conversion (baseline then improve).
- % deals with deposit recorded in-system.
- Owner: weekly margin report without Excel.
- Zero cross-agent data leaks (tenant isolation tests).

---

## 9. Recommendation

**Build the Grabio travel layer (Phases 1–2)** and **keep Nextra as booking engine** until data proves replacement. That beats their **current account** fast, matches what they liked in **TravelBoost**, and avoids **Iween** cost/complexity until they scale suppliers.

Confirm Phase 0 + Phase 1 scope and pricing with Anwar before any production commit.
