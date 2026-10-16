# S0 — Structured itinerary model

**Why:** `TravelQuote.itinerary` is a text blob, so an Airial-style day-by-day proposal is impossible. Everything after S0 depends on this.
**Mode:** Build for real, on demo data (`VITE_TRAVEL_DEMO` / `VITE_TRAVEL_API_MOCK`). Real data is swapped in later without rewrites.

## Scope
Add a structured itinerary to quotes: `days[] > items[]`.

```ts
interface TravelItineraryItem {
  id: string;
  type: 'flight' | 'hotel' | 'activity' | 'transfer' | 'note';
  title: string;
  time?: string;          // "09:30"
  description?: string;
  imageUrl?: string;
  cost: number;
  sell: number;
}
interface TravelItineraryDay {
  id: string;
  dayNumber: number;
  title: string;          // "Day 1 — Arrival in Istanbul"
  date?: string;
  items: TravelItineraryItem[];
}
// TravelQuote gains: days?: TravelItineraryDay[]
```

## Files likely touched
- `web/src/lib/types.ts`
- `web/src/lib/demoStore.ts` (seed 2 realistic demo trips)
- `web/src/lib/travelFirestore.ts`, `travelService.ts`, `travelApi.ts`
- `web/src/pages/QuoteEditorPage.tsx`
- `web/src/lib/moneySummary.ts` (totals must stay correct)
- `functions/src/api/travelAgency.ts` (mock/public proposal payload includes `days`)
- `scripts/seedTravelAgencyDemo.cjs` (seed structured quotes)

## Requirements
1. `days` is optional. Old quotes with only `itinerary` text still open and render (fallback).
2. `total`, `costTotal`, `margin` are derived from items (`sell`/`cost` sums) when `days` exists. Existing `lines` behaviour is not broken.
3. Quote editor: add, edit, delete and reorder days; add, edit, delete and reorder items within a day (up and down buttons are enough, no drag-and-drop needed). Item type is a select. Margin per item and total are visible.
4. Demo data: 2 trips of at least 5 days each (e.g. Istanbul and Dubai), with all item types, realistic prices, and image URLs that load.
5. Public proposal payload (`/travel/p/:token`, `demo` token) returns `days`. The page keeps working as-is. A visual redo is S1, not S0.
6. Follow the existing Grabio/Tailwind style of `QuoteEditorPage`. No new UI patterns.

## Out of scope
Proposal page redesign (S1), AI drafting (S2), deposits and invoices (S3), real Nextra API.

## Acceptance criteria
- [ ] `npm run build` in `web/` and `npm run build` in `functions/` pass with no TS errors.
- [ ] An old text-only quote opens and saves without data loss.
- [ ] Create a new quote, add 3 days with 2+ items each, save, reload: everything persists.
- [ ] Changing an item's sell or cost updates total and margin immediately and after reload.
- [ ] Reorder days and items persists.
- [ ] Money page and deal detail totals are unchanged for old quotes.
- [ ] `/travel/p/demo` still loads and shows days (plain list is fine).
- [ ] Zero console errors on Today, CRM, Deals, quote editor, Money, `/p/demo`.

## Builder report must include
Files changed, how the fallback works, screenshots of the editor (empty, filled, mobile width), build output summary, open questions.
Write it to `../builder-reports/S0-structured-itinerary.report.md`, then set STATUS to `READY_FOR_TEST`.
