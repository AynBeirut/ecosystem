# Decision log — Travel Agency Platform

## 2026-10-04 — Replace Nextra; Airial-inspired UX, Grabio UI

**Decision:** Single platform (Nextra/API = backend only, no hybrid pitch). Client benchmark is **Airial** (`Airial-for-Travel-Agents.pdf`): take its UX (brief-to-proposal, branded itinerary proposal, convert & collect, document hub), keep Grabio visual language.
**Build mode:** Build for real (real data model, real logic, real AI path) on **demo data**. On client acceptance: swap in real data only — no rewrite. Demo flags: `VITE_TRAVEL_DEMO`, `VITE_TRAVEL_API_MOCK`.
**Roles:** Anwar's planner (this agent) writes specs/tasks and reviews; a builder implements.
**Key finding:** `TravelQuote.itinerary` is a plain text blob. Airial UX needs a structured itinerary (days > items). This is the first schema change.
**Out of scope for now:** WhatsApp companion, embeddable widget, Nextra booking parity.

## 2026-10-01 — Nextra API + web-first build

**Decision:** Nextra provides real API; implement `nextraAdapter` in Cloud Functions with mock fallback. Agent surface is **responsive web** (`travel-agency/web`), not native mobile.

**Status:** Implemented scaffold — verify live Nextra paths in Phase 0 matrix with client.

## 2026-10-01 — Project folder

**Decision:** `grabio space/travel-agency` in workspace.

## 2026-10-01 — Strategy

**Decision:** Deal-centric Grabio layer; Nextra as inventory engine; no TravelBoost/Iween for MVP.
