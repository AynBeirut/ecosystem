# Optional HR and Venue Ops bridges — 2026-09-28

**Status:** local only. Not deployed. Anwar has not tested this.

Roadmap: `docs/handoff/hr-venue-ops-builder-roadmap-2026-09-28.md`. Next phase is Phase 6, and it waits for Anwar to name a store and approve a preview import.

## What this is

Links to modules that already exist. They render only when that module's gate passes. Turning finance, inventory, CRM, or reservations off hides the matching link. HR and Venue Ops records still save without those modules.

- Attendance shows "Review pay from attendance" only when payroll is on. It opens the existing Salary Payments screen. It does not calculate or post pay.
- The HR payroll tab links to Staff and Salary Payments only when payroll is on.
- Beverage specs link to Recipes and Inventory only when inventory is on.
- Floor map links to Reservations and Guest CRM only when those gates pass.
- Briefings link to HR training only when Official HR is on.

## Changed files

- `src/lib/hrVenueOpsShell.ts`
- `src/pages/admin/AdminHrShell.tsx`
- `src/pages/admin/AdminVenueOpsShell.tsx`
- `src/pages/admin/hr/HrCorePanels.tsx`
- `src/pages/admin/venue/VenueOpsPanels.tsx`
- `src/__tests__/venueOpsPhase3.test.ts`
- `docs/handoff/hr-venue-ops-builder-roadmap-2026-09-28.md`
- `README.md`, `decision-log.md`

## Not deployed

Hosting, functions, Firestore rules, APK, POS, and production data were not released. Salary payment logic and payroll GL were not changed.

## Test steps

Use your own store. Do not use a client store. This pass is not on the current staging URL.

1. With finance off, open `/admin/hr/attendance`. Daily Presence is there. The pay link is not.
2. Turn finance and payroll on. The pay link appears and opens Salary Payments. Existing amounts still load. Nothing new is posted.
3. With inventory off, open `/admin/venue-ops/specs`. The spec form has no recipe or inventory link.
4. Turn inventory on. Recipes and Inventory links appear. A spec still saves with no cost.
5. With reservations and CRM off, the floor screen has no Reservations or Guest CRM link. Turn one on and that link appears.
6. Turn Official HR off. The briefing screen has no HR training link. Venue Ops still opens.

Reviewed: vitest `venueOpsPhase3` — 5 passed, and `hrVenueOpsPhase1` — 7 passed. Not opened in the browser. Not deployed.
