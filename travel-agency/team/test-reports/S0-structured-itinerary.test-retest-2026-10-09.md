# Test report — S0 structured-itinerary (retest 2)

Date: 2026-10-09
Environment: local dev `npm run dev -- --mode staging --port 5180` (http://localhost:5180/travel/, store `travel-agency-demo`, staging Firebase, `VITE_TRAVEL_API_MOCK=true`); staging hosting `market-flow-7b074--staging-jir26mhn.web.app/travel/` smoke only (not current, see below). Login: staging demo account (`.credentials.md` > "Travel Agency — staging demo login"; form prefilled by `VITE_DEMO_*`, no password recorded). Headless Chrome via `scripts/node_modules/playwright-core`.
Result: FAIL

## Acceptance criteria (from the task file)
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `npm run build` in `web/` and `functions/` pass with no TS errors | FAIL | `web`: `vite build` exit 0 (bundle `index-Dh7ZC23f.js`), but the script does not type-check; `npx tsc --noEmit -p web` exit 2: `src/lib/demoStore.ts(154,7)`, `(155,7)`, `src/lib/travelService.ts(185,5)`, `(186,5)` TS2322 `Type 'number \| undefined' is not assignable to type 'number'`. `functions`: `tsc --noEmit` exit 0 (not `npm run build`: its prebuild rewrites generated files). |
| 2 | Old text-only quote opens and saves without data loss | PASS | T1 |
| 3 | New quote, 3 days x 2 items, save, reload persists | PASS | quote `c4pkAE37sL9o0bagUpZr` (deal `demo-d3`); `retest2-t2-created-before-first-save.png`; after reload 3 days x 2 items, Firestore same |
| 4 | Sell/cost change updates total and margin now and after reload | PASS | UI margin USD 600.00 before save and after reload; doc costTotal 1230, total 1830, margin 600 |
| 5 | Reorder days and items persists | PASS | T2 |
| 6 | Money and deal detail totals unchanged for old quotes | PASS | `demo-q1` costTotal/total/margin 172600/185000/12400 before and after save; `retest2-console-money.png`, `retest2-console-deal-detail.png` |
| 7 | `/travel/p/demo` loads and shows days | PASS | local `retest2-console-public-demo.png`, staging `retest2-staging-p-demo.png` |
| 8 | Zero console errors on Today, CRM, Deals, quote editor, Money, `/p/demo` | PASS (local + staging Today, `/p/demo`) | 0 `console.error` / pageerror on these routes. Only: 2x React Router v7 future-flag warnings per load (local dev); 1x `Failed to load resource: ... 404 (Not Found)` for `http://localhost:5180/favicon.ico` on first load of `/login` (dev server only; staging `/favicon.ico` = 200, staging log empty). |

## Planner retests (T1–T3)
| Test | Result | Evidence |
|------|--------|----------|
| T1 legacy `demo-q1` (route `/deals/demo-d1/quote/demo-q1`): edit, save, reload | PASS | Appended `[retest 2026-10-09 16:02]`; after reload textarea and Firestore `itinerary` contain it; no `days` key; no error text/dialog; doc `updatedAt` 2026-10-09T13:06:21Z (16:06 Beirut). `retest2-t1-before-save.png`, `retest2-t1-after-reload.png` |
| T2 reorder day + item, save, reload; `dayNumber` 1..n | PASS | Moved Day B up, B1 down, C2 up. UI after reload `#1 Day B [B2,B1]`, `#2 Day A [A1,A2]`, `#3 Day C [C2,C1]`; Firestore `days[].dayNumber` = 1,2,3 with same order (read via app's `getQuote` in page). `retest2-t2-before-save.png`, `retest2-t2-after-reload.png` (byte-identical by design: same UI state before save and after reload) |
| T3 delete all items + days, save, reload; no stale `days`; `/p/:token` shows text | FAIL | Editor part PASS: deleted 6 items + 3 days, text `T3 text itinerary retest2 16:02`, saved; reload shows textarea + "No structured days"; Firestore doc has no `days` key (`retest2-t3-cleared-before-save.png`, `retest2-t3-after-reload.png`). Public part FAIL: "Get share link" returns `http://localhost:5180/travel/p/demo` (mocked `createProposalLinkApi`, token always `demo`) which shows the Dubai mock, not this quote (`retest2-t3-public.png`). Real API: `POST https://api-5nbn2jdbxa-uc.a.run.app/travel/proposal/link` → 404 `<pre>Cannot POST /travel/proposal/link</pre>`; `GET .../travel/proposal/public/c4pkAE37sL9o0bagUpZr` → 404 `<pre>Cannot GET /travel/proposal/public/c4pkAE37sL9o0bagUpZr</pre>`. `/travel/p/c4pkAE37sL9o0bagUpZr` renders `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` (`retest2-t3-public-real-token.png`). |

## Bugs
### BUG-1 — Proposal API not deployed on Cloud Run (carried over, ENV-1)
- Severity: blocker (T3 `/p/:token`)
- Steps: `curl` GET/POST `{VITE_API_BASE}/travel/proposal/public/<id>`, `/travel/proposal/link`, `/travel/proposal/accept`, `/travel/owner/summary` (2026-10-09 ~16:00 Beirut).
- Expected: JSON.
- Actual: all 404 Express HTML `Cannot GET|POST ...`; `GET /` = 200 `{"message":"Grabio API","version":"2.0.0",...}`.
- Evidence: probe output above; `retest2-t3-public-real-token.png`.

### BUG-2 — Share link always `/p/demo` in staging mode
- Severity: major
- Steps: open any quote, "Get share link".
- Expected: link for this quote.
- Actual: `VITE_TRAVEL_API_MOCK=true` in `web/.env.staging` makes `createProposalLinkApi` return token `demo`; customer sees the Dubai mock. T3 text check impossible in this config.
- Evidence: `src/lib/travelApi.ts` `createProposalLinkApi`; `retest2-t3-public.png`.

### BUG-3 — Raw JSON parse error on public page when API fails
- Severity: minor
- Steps: open `/travel/p/<non-demo token>`.
- Expected: friendly error.
- Actual: red text `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
- Evidence: `retest2-t3-public-real-token.png`.

### BUG-4 — TS type errors hidden by `vite build`
- Severity: major (AC1 says no TS errors)
- Steps: `cd web && npx tsc --noEmit -p .`
- Expected: exit 0.
- Actual: exit 2, 4x TS2322 in `demoStore.ts:154-155`, `travelService.ts:185-186`.
- Evidence: tsc output above.

## UI check (Grabio UI gate)
Mobile-first, loading/empty/error states, console errors, consistency: desktop 1280px only this run. Empty state "No structured days" OK. Error state on public page leaks raw parse error (BUG-3). After clearing all days the manual cost/sell keep the last derived values (1230/1830, margin 600) and are saved as such. Console: see AC 8. Planner U1–U3 (unlabeled cost/sell, 390px truncation, unlabeled totals row) still visible (`retest2-t2-after-reload.png`), deferred to S1. Staging login page shows demo credentials (`VITE_SHOW_STAGING_LOGIN=true`) by design.

## Not tested (and why)
- T1–T3 on staging hosting: staging serves `index-CA48nfI7.js` (same as Oct 4); it has 0 occurrences of `clearStructuredDays` vs 2 in local builds (old dist `index-B8rjvsBE.js` and fresh `index-Dh7ZC23f.js`) → R1 rework not deployed. Only staging Today and `/p/demo` smoke run (0 console messages).
- Mobile 390px pass: not in scope of retest.
- `/p/:token` with a real token: blocked by BUG-1/BUG-2.

## Notes
- Side effects in staging Firestore (`travel-agency-demo`): `demo-q1.itinerary` now ends with `[retest 2026-10-09 16:02]`; new quote `c4pkAE37sL9o0bagUpZr` on `demo-d3` (text-only after T3); deal stage writes `quoted` on save (unchanged values). Leftovers from Oct 4 on `demo-d3`: `P1upCheHZRtJwkpdR2ef`, `O6xfMfv8VJQuDGZASQsR` (1 day each), `jARyO1VOPh1NQnZihDUN`, `mF4C0RqTwvEV55LpUmeq`.
- `npm run build` replaced `web/dist` (`index-B8rjvsBE.js` → `index-Dh7ZC23f.js`).
- Previous retest assets (md5): `retest-console-public-demo.png` = `retest-staging-p-demo.png` = builder `s0-public-proposal-demo.png` (`15821f64…`); this run's three `/p/demo` captures also hash to `15821f64…` (deterministic mock render), so that identity alone is not proof of copying. `retest-t3-cleared-days.png` = `retest-t3-after-reload.png` (`469dcb24…`). `retest-t2-demo-q3-reorder.png` = `retest-console-quote-editor.png` (`f6d895ce…`) and both show only "Loading quote…": no evidence of reorder or editor. `demo-q1` doc carried no trace of the Oct 4 T1 edit; Oct 4 report's "404 on save" not reproduced (0 failed requests on save).
