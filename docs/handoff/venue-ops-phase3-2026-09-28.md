# Venue Ops core — phase 3 — 2026-09-28

**Status:** local only. Not deployed. Anwar has not tested this phase.

## What this is

`/admin/venue-ops` now holds allergen cards, menu bible cards, beverage and batch specs, daily and monthly briefings, a floor table list, and standards. Records do not store price, cost, or stock. Invoice PDF setup, Theme Editor, POS, Staff, and Salaries were not changed.

## Surfaces

| Path | What you see |
|---|---|
| `/admin/venue-ops` | Counts for allergens, menu bible, specs, briefings, floor, standards |
| `/admin/venue-ops/allergens` | Item, allergens, cross-contamination, guest warning |
| `/admin/venue-ops/bible` | Item, one-liner, ingredients, service notes |
| `/admin/venue-ops/specs` | Name, glassware, method, par, batch quantity |
| `/admin/venue-ops/briefings` | Daily or monthly briefing |
| `/admin/venue-ops/floor` | Section, table, seats, station |
| `/admin/venue-ops/standards` | Title, category, role, content |
| `/admin/venue-ops/training` | Shown only when Official HR is on. Link to HR training |

A cashier can open the hub. The add forms stay hidden. Owner and manager see the forms. With inventory on, a note says recipe and stock links are not connected. With inventory off, that note is hidden.

## Data

- `venueKnowledgeItems` with `kind` of `allergen`, `bible`, or `spec`
- `venueBriefings`, `venueFloorMaps`, `venueStandards`
- Every row has `storeId`. Lists use the item, briefing, table, or standard name.

## Changed files

- `src/lib/venueOpsCore.ts`
- `src/lib/venueOpsCoreService.ts`
- `src/pages/admin/venue/VenueOpsPanels.tsx`
- `src/pages/admin/AdminVenueOpsShell.tsx`
- `src/lib/hrVenueOpsShell.ts`
- `src/lib/restaurantRolePolicy.ts` (`canManageVenueOpsContent`)
- `src/__tests__/venueOpsPhase3.test.ts`
- `README.md`, `architecture.md`, `decision-log.md`

## Not deployed

- Live hosting and the staging channel were not released.
- Functions, APK, POS, and source import were not touched.
- No production documents were written.
- Venue collection rules in `firestore.rules` were **not** released. Allergen, bible, spec, briefing, floor, and standard saves will show missing permissions until a later rules release.

## How Anwar should test

Use your own Grabio store. Turn on **Store Profile → HR and Venue Ops → Venue operations**. Do not use a client store.

1. With finance and inventory off, open `/admin/venue-ops`. All six modules are in the tab row. The notes do not ask for a price or stock.
2. As owner, the add forms are visible. A save will fail with missing permissions until the venue rules are released. That failure is expected.
3. As a cashier, the hub opens and the add forms are hidden.
4. Turn Official HR off. The Training tab and the HR training link are gone. Venue Ops stays.
5. Staff, Salary Payments, invoice PDF setup, and the theme editor still open as before.

Reviewed: `npx vitest run` on `venueOpsPhase3`, `hrVenueOpsPhase1`, and `hrCorePhase2` — 15 passed. Not tested in the browser. Not deployed.
