# Venue Ops add and edit — 2026-09-28

**Status:** local only. Not deployed. The staging channel still serves `index-ryGUiGT_.js`, which does not include this pass. Anwar has not tested this.

## What you can do

`/admin/venue-ops` saves real records. Finance and inventory can stay off.

- Allergen Matrix: add and edit item name, category, allergens, cross-contamination note, review date, approver, and draft/reviewed status.
- Menu Bible: add and edit item name, category, ingredients, story, buzz words, one-liner, service notes, and allergens.
- Specs: add and edit name, glassware, storage vessel, ingredient lines with quantity and unit, garnish, method, par, and batch quantity. No cost.
- Briefings: daily or monthly, food focus from menu cards, beverage focus from specs, manager prompt, draft or published.
- Dashboard counts: allergen items, bible cards, specs, briefings.

Lists use those names. Firestore ids are not shown.

## Changed files

- `src/lib/venueOpsCore.ts`
- `src/lib/venueOpsCoreService.ts`
- `src/pages/admin/venue/VenueOpsPanels.tsx`
- `src/__tests__/venueOpsPhase3.test.ts`
- `README.md`, `decision-log.md`

## Not deployed

Hosting, functions, Firestore rules, APK, POS, and production data were not released. Payroll, invoice templates, and client stores were not changed.

Saves use `venueKnowledgeItems` and `venueBriefings`. Those rules are still local, so a save returns missing permissions until you ask for a rules release.

## Test steps

Use your own store with Venue operations on and finance and inventory off. Do not use a client store. This pass is not on the current staging URL.

1. Open `/admin/venue-ops` and note the four counts.
2. Add an allergen item with a name. The allergen count goes up by one. Edit the approver and save. The list shows the new approver.
3. Add a menu card with a name and one-liner. The bible count goes up by one. Edit the one-liner and save.
4. Add a spec with a name and one ingredient line. The spec count goes up by one. No cost field is on the form.
5. Add a briefing for today, choose that menu card and spec, and set it to Published. The briefing count goes up by one.
6. Staff, Salary Payments, and invoice setup still open as before.

Reviewed: vitest `venueOpsPhase3` — 4 passed. Not opened in the browser. Not deployed.
