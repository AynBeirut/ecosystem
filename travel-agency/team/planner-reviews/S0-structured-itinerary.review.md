# S0 — Planner review

**Date:** 2026-10-04
**Verdict:** REWORK (small, 1 real bug + 2 test gaps). Not ACCEPTED yet.

## What is good
- Data model matches the spec; fallback to text-only works; totals derive from items; demo data (Dubai, Istanbul) is realistic.
- Day renumbering on reorder/remove is handled in code (`QuoteEditorPage.tsx`).

## Rework items (builder)
**R1 — Save payload bug (major).** In `travelService.ts` `saveQuote`, the payload spreads `input`, which carries `days: undefined` when the quote is text-only (`QuoteEditorPage.tsx`, `days: structuredMode ? days : undefined`). Firestore rejects `undefined` field values unless `ignoreUndefinedProperties` is set (it is not, in `firebase.ts`), so saving a legacy text-only quote very likely fails. The same path has a second bug: with `{ merge: true }`, a quote switched back to text-only keeps its old `days`, so `/p/:token` and the PDF show stale itinerary. Fix:
- Never send `undefined` values (strip them from the payload).
- When saving in text mode on an existing quote, remove `days` with `deleteField()`.
- Mirror the same behaviour in `demoStore.saveQuote`.
This also answers builder open question 2: yes, clear `days` explicitly.

**R2 — Missing screenshots.** The report promised none; the task required: editor empty, editor filled (Dubai), editor at 390px width, `/travel/p/demo`. Save to `builder-reports/assets/`.

**R3 — Process.** Staging deploy was done before Anwar confirmed the tests passed (Deployment Gate). Do not deploy again; Anwar approves deploys.

## Test gaps (tester, after rework)
- T1: Open legacy text-only `demo-q1`, edit the text, save, reload. Must persist with no error. (The first test only proved it opens.)
- T2: Reorder a day and an item, save, reload, order persists and `dayNumber` is 1..n.
- T3: Save a structured quote, delete every item/day, save, reload: no stale `days` in Firestore, `/p/:token` shows text.
- T4: Tester must be a **separate session from the builder** (the S0 tester was the same Cursor agent). Use the other app or a fresh Cursor chat with no build context.

## Decisions
- Builder Q1 (re-seed staging): **recommended yes** (adds docs, deletes nothing). Needs Anwar's OK before running.
- Skipped test of Goa `demo-q2`: covered by T1 once re-seeded.

## Next
After R1–R2 fixed and T1–T3 pass: S0 = ACCEPTED, then S1 (`tasks/S1-proposal-experience.md`, already written).

## Round 2 (after rework) — planner code + screenshot review
- R1: **code OK.** `stripUndefined` on the write payload, `deleteField()` only on updates in text mode, `days` written only when structured, same in `demoStore`. New items omit optional keys, so no nested `undefined`. Not yet proven against real Firestore: T1 and T3 must exercise it.
- R2: **screenshots OK** (4 PNGs).
- **UI defects found in screenshots** (agent editor, not blocking S0 acceptance, to be fixed inside S1's editor work):
  - U1: cost and sell inputs have no labels; the agent cannot tell which number is which. Add visible labels "Cost" / "Sell" (the bottom total row too).
  - U2: at 390px the item title truncates ("Atlantis The Palm — 5 nig"). Stack title above time on narrow widths.
  - U3: the bottom row (currency, 172600, 185000) is unlabeled and looks editable but is derived; show it as a read-only summary (Cost / Sell / Margin).
- Status stays `READY_FOR_TEST`. Tester must be a separate session from the builder (T1–T4 above).

## Round 3 (after 2026-10-09 retest) — REWORK (Builder action required)
The tester's 2026-10-09 report is high quality:
- T1 (legacy quote edit/save) and T2 (reorder day/items) **PASSED**.
- Core data model and persistence logic work properly.

However, S0 is **REWORK** due to 2 builder defects:

### Fix 1: 4 TypeScript compilation errors (BUG-4)
- `src/lib/demoStore.ts:154-155` and `src/lib/travelService.ts:185-186`: `costTotal: input.costTotal ?? 0, total: input.total ?? 0`.
- In `web/package.json`: change script to `"build": "tsc && vite build"` so `npm run build` enforces zero TS errors. Verify `npx tsc --noEmit` exits 0.

### Fix 2: Public proposal share link in mock/demo mode (BUG-1, BUG-2, BUG-3 / T3 failure)
- In `web/src/lib/travelApi.ts`:
  - `createProposalLinkApi(storeId, quoteId)`: in mock mode (`useApiMocks()`), do NOT hardcode `token: 'demo'`. Return `token: `demo-${quoteId}`` and `publicPath: `/travel/p/demo-${quoteId}``.
  - `fetchPublicProposal(token)`:
    - If `token === 'demo'`: keep existing static Dubai honeymoon mock for backwards compatibility.
    - If `token.startsWith('demo-')` or in mock mode: extract `quoteId = token.replace(/^demo-/, '')`. Load the actual quote from `demoStore` or Firestore (via `getQuote`). Return it in the proposal format, sanitizing out sensitive fields (`costTotal`, `margin`, line item `cost`). If quote not found, throw friendly `new Error('Proposal not found or expired')`.
    - Wrap the real API `fetch()` in `fetchPublicProposal` so that non-JSON / HTML responses (e.g. 404/500 from Cloud Run) throw a clean user-facing error (`Proposal service temporarily unavailable`) instead of letting `Unexpected token '<'` crash to the screen.
  - In `web/src/pages/PublicProposalPage.tsx`: ensure the error state renders a friendly user alert.

After Builder applies these 2 fixes and verifies `npm run build` (with `tsc`), set status back to `READY_FOR_TEST`.

