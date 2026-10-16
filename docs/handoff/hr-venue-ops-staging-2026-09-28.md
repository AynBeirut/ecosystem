# HR + Venue Ops staging — 2026-09-28

## Changed

- `src/lib/venueSourcePreview.ts` — maps spreadsheet rows to specs, briefings, menu knowledge, and allergens. Does not write.
- `src/pages/admin/venue/VenueImportPreview.tsx` — Import preview tab. Save stays off.
- `src/pages/admin/hr/HrAdvancedPanels.tsx` — reports use training assignments.
- `src/lib/hrCore.ts` — report counts tolerate a missing list.
- `firestore.rules` — same-store HR and venue collection rules. Released to the live database because staging uses that database.

## Surface

- Staging: https://market-flow-7b074--staging-qj6e98fx.web.app
- `/admin/hr` and `/admin/venue-ops` on E-Moove.
- Live hosting was not released.

## Test on E-Moove

Employee Staging Host, leave approved, training Service greeting completed, document Work permit, shift Floor, note, asset Black apron, allergen Herb plate, menu card, spec House cooler, briefing, and a spreadsheet preview that says Saved: no.

Reports was blank, then fixed. Recheck on staging showed 5 active employees, 1 expiring document, 1 shift this week, and 1 issued asset. No page error.

## Not done

- Live hosting.
- Applying an import into a store.
- Anwar has not confirmed the checklist.
