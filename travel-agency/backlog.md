# Backlog — Travel Agency Platform

## Plan 2026-10-04 — Airial-inspired UX on Grabio UI (build real, demo data)

UI rule for every slice: Grabio design language, mobile-first for client-facing pages, no new UI patterns without the planner's approval, empty/loading/error states required, no console errors.

- [ ] **S0 Structured itinerary model** — add `days[] > items[]` (type: flight/hotel/activity/transfer/note; title, time, description, image, cost, sell) to `TravelQuote` in `types.ts`, Firestore, demo store, and mock API. Keep `itinerary` text as a fallback. Margin and total derive from items.
- [ ] **S1 Proposal experience (Present)** — rebuild `/p/:token`: hero cover (destination image, title, dates, pax), day-by-day cards, inclusions/exclusions, price card, Approve button, agent contact. Agent-side live preview in the quote editor.
- [ ] **S2 Brief to draft** — "Describe the trip" box on New Deal (text first) producing a draft structured itinerary. Provider-agnostic Cloud Function `POST /travel/ai/draft`; deterministic mock on demo data. Agent must review/edit before send.
- [ ] **S3 Convert & Collect** — approve > deposit > invoice > voucher on one deal thread; deal timeline shows proposal views and approval.
- [ ] **S4 Document hub + auto-pricing** — upload rate sheet/supplier doc, extract priced lines with source reference shown per line.
- [ ] **S5 Cutover** — swap demo data for real data and real Nextra API; deploy `functions:api`.
- [ ] Later: WhatsApp companion, embeddable planner, Nextra booking parity.

Order: S0 > S1 > S2 > S3 > S4 > S5. Each slice ends with: staging deploy, planner UI review, client-visible demo script.

## Implemented (2026-10-01)

- [x] Phase 0: `docs/nextra-api-matrix.md`, wireframes, `docs/agent-journeys.md`
- [x] Phase 1: Firestore collections + rules; `travel-agency/web` CRM, deals, clients, quote builder/PDF/share link
- [x] Phase 2: `functions/src/integrations/nextra/*` + `/travel/nextra/*` routes; Book page + deal PNR attach
- [x] Phase 3: Public proposal `/travel/p/:token`, accept + deposit API
- [x] Phase 4: `GET /travel/owner/summary` + Money page (margin, pipeline, credit alert)

## Next (client-specific)

- [ ] Fill Nextra API matrix with verified endpoints from client docs
- [ ] Wire real Nextra auth (disable mock in prod)
- [ ] Copy web `dist` into main hosting pipeline / CI
- [ ] Engagement analytics on proposal views (Phase 3.1)
- [ ] Optional: sync deposits to Grabio `financeInvoices`

## Run locally

```bash
cd travel-agency/web && npm install && npm run dev
cd functions && npm run build   # compile travel routes
```
