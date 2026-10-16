# Travel Agency Platform — Scope & References

**Owner:** Anwar (aynbeirut.com / emoove.co)  
**Created:** 2026-10-01  
**Status:** MVP scaffold — agent web app + Cloud Functions Nextra adapter + public proposals.

## Purpose

Blueprint for a **travel agency** stack covering:

1. **API system integration** — supplier inventory, fares, payments (API-first mid-office pattern).
2. **Workflow + CRM** — internal operations, agents, clients, pipelines.
3. **Proposals & quotations** — interactive quotes, margins, acceptance → invoice/booking.

## Reference products (benchmarks)

| Vendor | URL | Role in our map |
|--------|-----|-----------------|
| TravelBoost | https://travelboost.app/products/proposals | Proposals, engagement, AI draft, rate cards, accept → pay |
| Iween | https://www.iweensoft.com | API gateway, 30+ integrations, mid-office, TAs/TMCs/OTAs |

Detailed notes: `docs/references/`.

## Session 2026-10-01

**Problem:** Need a dedicated folder to collect travel-agency product scope and competitor/reference assets.  
**Method:** Created project docs + reference summaries from public marketing pages.  
**Results:** `README.md`, `architecture.md`, `backlog.md`, `decision-log.md`, `docs/references/*`.  
**Run:** `travel-agency/web/README.md` · **Architecture:** `architecture.md`

### Session 2026-10-01 — Implementation

**Method:** Phases 0–4 per approved plan: docs/wireframes, `travel-agency/web`, `functions` travel + Nextra integration, Firestore rules, hosting `/travel/**`.  
**Next:** Client Nextra API verification; deploy web dist to hosting; set secrets (`TRAVEL_PROPOSAL_SECRET`, `NEXTRA_API_KEY`).

### Session 2026-10-01 — Client opportunity (Nextra + benchmarks)

**Problem:** Client has Nextra agent account; exploring TravelBoost and Iween.  
**Method:** Compared captured Nextra routes vs benchmark docs; wrote phased plan (hybrid: our CRM/quotes/finance + Nextra booking engine).  
**Results:** `docs/plan-better-travel-platform.md`, `backlog.md` updated.  
**Next:** Discovery call checklist in plan §7; confirm Phase 1 scope/pricing before build.

## Project files (Rule 21)

- `README.md` — this file  
- `backlog.md` — plan & TODO  
- `decision-log.md` — decisions  
- `architecture.md` — target system shape  
