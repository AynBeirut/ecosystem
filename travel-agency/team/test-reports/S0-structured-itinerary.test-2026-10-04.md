# S0 — Structured itinerary — test report

**Date:** 2026-10-04  
**Environment:** https://market-flow-7b074--staging-jir26mhn.web.app/travel/ (`index-CA48nfI7.js`)  
**Store:** `travel-agency-demo` (existing session)  
**Verdict:** **TESTED_PASS** (minor gaps noted)

## Acceptance criteria

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Web + functions build | PASS (builder) | Not re-run this session |
| Text-only quote opens/saves | PASS | `demo-q1`: legacy textarea, INR 185000/172600, no `days` in Firestore |
| New quote 3 days × 2+ items, save/reload | PASS | Created on `demo-d3` → `…/quote/mF4C0RqTwvEV55LpUmeq`; reload shows 3 days, Tour A/Hotel C/Flight E, sell **1270**, margin **370** |
| Sell/cost → total/margin live + reload | PASS | Margin updated live while editing; after reload totals match |
| Reorder days/items persists | **NOT RUN** | Up/down controls visible; no dedicated reorder save/reload test |
| Money / deal totals for old quotes | PASS | Dubai deal still **INR 185000** on deal detail; Money loads (pipeline margin **15970** after new quote) |
| `/travel/p/demo` shows days | PASS | 5 day headings, INR **185000** total |
| Zero console errors (key routes) | PASS | Hooked `console.error`: **[]** on exercised flows; Money/Today/Deals/quote editor/`/p/demo` |

## Routes exercised

- `/travel/p/demo` — structured day list
- `/travel/deals`, `/travel/deals/demo-d1`, `/travel/deals/demo-d1/quote/demo-q1`
- `/travel/deals/demo-d3/quote` → save → `/travel/deals/demo-d3/quote/mF4C0RqTwvEV55LpUmeq` (reload)
- `/travel/money`

## Gaps / follow-ups

1. **Re-seed** optional: Firestore `demo-q1` still text-only; `/p/demo` uses client mock (structured). Run `node scripts/seedTravelAgencyDemo.cjs` for aligned demo quotes.
2. **Reorder** AC: manual retest recommended (5 min).
3. **Goa text-only** (`demo-q2`): not in current Firestore seed on staging; only `demo-q1` verified as legacy.

## Tester

Cursor agent (substitute for Boot tester), browser automation on staging.
