# Test report — S0 structured-itinerary (retest)

Date: 2026-10-04  
Environment: **local** `npm run dev -- --mode staging` → `http://127.0.0.1:5177/travel/` (post–R1 rework). **Staging hosting not current** (`index-CA48nfI7.js`, pre-R1); smoke only on `/travel/p/demo`.  
Store: `travel-agency-demo`  
Login: staging demo account (`VITE_DEMO_EMAIL` in `web/.env.staging`; password in same file / monorepo `.credentials.md` — not recorded here).  
Tester: independent Cursor session (T4).  
Result: **FAIL**

## Planner retests (T1–T3)

| Test | Result | Evidence |
|------|--------|----------|
| **T1** Legacy text-only `demo-q1`: edit, save, reload, no error | **PASS** | Legacy textarea; edit persisted in Firestore + UI after reload. Screenshot: `assets/retest-t1-demo-q1.png`. One benign `404` on save (owner/wallet mock path), no user-visible error. |
| **T2** Reorder day + item, save, reload; `dayNumber` 1..n | **PASS** | Quote `mF4C0RqTwvEV55LpUmeq` on `demo-d3`: after swap, Firestore `days` = `[{n:1,title:"Day 2",items:["Hotel C","Breakfast"]},{n:2,title:"Day 1",items:["Transfer B","Tour A"]},{n:3,...}]`. UI after reload: `assets/retest-t2-after-reload.png`. |
| **T3** Structured → delete all days, save, reload; no stale `days`; `/p/:token` text | **PARTIAL FAIL** | Quote `jARyO1VOPh1NQnZihDUN`: after Remove all + Save, Firestore **no `days` field**; reload shows text itinerary + “No structured days” (`assets/retest-t3-cleared-days.png`, `assets/retest-t3-after-reload.png`). **Public proposal not verifiable:** `POST/GET https://api-5nbn2jdbxa-uc.a.run.app/travel/proposal/*` → **404** (`Cannot POST/GET /travel/proposal/...`). `/p/demo` is mock structured data, not quote-specific. |

## Acceptance criteria (from task)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | R1 text-only save clears stale `days` | **PASS** (local) | T3 Firestore + editor |
| 2 | Reorder persists | **PASS** | T2 |
| 3 | Legacy quote save/reload | **PASS** | T1 |
| 4 | Public proposal shows text when no structure | **FAIL** | API routes not deployed on Cloud Run |
| 5 | Zero console errors (Today, Deals, quote editor, Money, `/p/demo`) | **PASS** (local) | `assets/retest-console-*.png`; staging `/p/demo` smoke: `assets/retest-staging-p-demo.png` |

## Bugs

### ENV-1 — Travel proposal API missing on Cloud Run
- Severity: **blocker** (for T3 `/p/:token` AC)
- Steps: Sign in locally; save text-only quote `jARyO1VOPh1NQnZihDUN`; sign JWT token locally; `GET {VITE_API_BASE}/travel/proposal/public/{token}`.
- Expected: JSON quote with text `itinerary`, no structured day list.
- Actual: HTTP **404** HTML (`Cannot GET /travel/proposal/public/...`). Same for `POST /travel/proposal/link`.
- Evidence: API probe during test run; functions code exists in `functions/src/api/travelAgency.ts` but not on live `VITE_API_BASE`.

## UI check (Grabio UI gate)
Mobile-first layouts OK on exercised routes. Loading states on quote fetch (~1–2s). No `console.error` on local routes listed above. Staging bundle not exercised for R1 save paths.

## Not tested (and why)
- **Staging R1 save paths** — hosting still `index-CA48nfI7.js` (pre-rework); planner gate: no redeploy without Anwar.
- **T3 `/p/:token` UI** — blocked by ENV-1 (not app regression in editor/Firestore).
- **demo-q3 seed quote** — doc `demo-q3` absent in Firestore; used `mF4C0RqTwvEV55LpUmeq` instead.

## Process (T4)
Tester session separate from builder; no implementation changes in this run.
