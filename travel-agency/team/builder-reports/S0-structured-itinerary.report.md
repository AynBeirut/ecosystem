# S0 — Structured itinerary model (Builder report)

**Date:** 2026-10-04 (rework R1–R2)  
**Status:** READY_FOR_TEST

## Rework summary

### R1 — Save payload (Firestore + demo store)

- Added `SaveQuoteInput` (`clearStructuredDays?`) in `web/src/lib/types.ts`.
- `buildQuoteWritePayload()` in `travelService.ts`: `stripUndefined()` on all writes; structured saves include `days`; text-only **updates** set `days: deleteField()` when `clearStructuredDays` is true; new text-only quotes omit `days`.
- `QuoteEditorPage`: passes `{ days }` in structured mode, else `{ clearStructuredDays: Boolean(quoteId) }` (never `days: undefined`).
- `demoStore.saveQuote`: same semantics — deletes `days` on `clearStructuredDays`, omits undefined keys.
- Helpers: `quoteHasStructuredDays()`, `stripUndefined()` in `quoteItinerary.ts`.

### R2 — Screenshots

Captured locally (`VITE_TRAVEL_DEMO=true` + `vite preview` on port 5176; staging used only for `/p/demo` earlier, regenerated from preview):

| File | Description |
|------|-------------|
| `assets/s0-quote-editor-empty.png` | New quote on deal `d1` |
| `assets/s0-quote-editor-dubai-q1.png` | Demo `q1` structured Dubai itinerary |
| `assets/s0-quote-editor-dubai-q1-390w.png` | Same editor, 390px viewport |
| `assets/s0-public-proposal-demo.png` | `/travel/p/demo` |

Regenerate: `VITE_TRAVEL_DEMO=true npm run build -- --mode staging` in `web/`, `npm run preview -- --port 5176`, then `TRAVEL_SCREENSHOT_BASE=http://127.0.0.1:5176/travel node scripts/capture-s0-screenshots.mjs`.

## Build

```
travel-agency/web: npm run build — OK (post-R1)
```

## Open questions

- Re-seed staging Firestore (`scripts/seedTravelAgencyDemo.cjs`): still **planner recommended, Anwar approval** — not run this rework.

## Questions

None — unblocked for retest (T1–T4 per planner review).
