# HR + Venue Ops Builder Roadmap — 2026-09-28

This is the workspace roadmap for builders. Do not make Anwar copy/paste phase prompts from chat.

## Read First

1. `README.md`
2. `architecture.md`
3. `decision-log.md`
4. `docs/handoff/builder-coc-2026-09-27.md`
5. This file

## Non-Negotiable Rules

- No deploy, push, APK, POS, or production writes unless Anwar explicitly approves.
- Do not hardcode Berenjak, NIPCO, Little Hands, or any store id.
- Tenant binding: `users.subAccountId` -> `subAccounts/{id}.storeId`.
- Access: entitlement AND store toggle AND user/sub-account permission.
- HR and Venue Ops must work without finance.
- Payroll, GL, costing, inventory, CRM, and reservations links are optional bridges only.
- Do not break production payroll, finance, Staff, Salaries, Invoice Manager, or existing old routes.
- Do not ask Anwar to test placeholder tabs. Ask for testing only when the feature has real data entry/list/update behavior.
- Venue Ops is not complete unless the UI fields match the reference documents in Phase 3A. A generic add/edit form is not a finished claim.

## Current Status

Venue Ops screens now use the reference fields: allergen columns and cross-contamination marker, bible meaning and description, cocktail or batch specs, briefing buzz words and one-liner, seat numbers, and standards checklists. Anwar has not confirmed them. Live hosting was not released.

- Phase 1: shells and gates. Staging has an older shell plus later HR actions (`index-ryGUiGT_.js`). Live hosting was not released.
- Phase 2A: employee, leave, training, documents, and HR counts. Local, and the employee/leave/training/document actions are in the current staging bundle.
- Phase 3A: allergen, menu bible, specs, briefings, and venue counts, including edit. Local after the last staging publish.
- Phase 4A: shifts, manager notes, assets, and HR report counts. Local after the last staging publish.
- Phase 5: optional bridges. Local. Hidden when the target module is off. Payroll posting was not changed.
- Phase 6: do not start until Anwar names a target store and approves a preview import.

Firestore rules for the new HR and venue collections are still local. Saves return missing permissions until Anwar approves a rules release.

## Phase 2A — Real HR Core

Mission: make `/admin/hr` real and testable.

Build:

- Employees: list, add, edit from `staff`.
- Leave Requests: create, list, approve/reject using `hrLeaveRequests`.
- Training: create item, assign to employee, mark complete using `hrTrainingItems` and `hrTrainingAssignments`.
- Documents: add metadata using `hrDocuments`.
- HR Dashboard: real counts for active employees, pending leave, overdue training, expiring documents.

Acceptance:

- Anwar can create an employee with no salary.
- Anwar can create and approve/reject leave.
- Anwar can create training and mark it complete.
- Anwar can add document metadata.
- Dashboard counts change.
- Finance off still works.
- Payroll remains hidden unless finance/payroll gate passes.

## Phase 3A — Real Venue Ops Core

Mission: make `/admin/venue-ops` real and testable.

Correction from Anwar: Venue Ops must match the reference data shape, not generic CRUD.

Reference folder:

`/home/anwar/Documents/grabio space/the eco sys/finedinnig `

Before calling Venue Ops complete, map these sources into UI fields:

- Allergy matrix files -> dish rows, allergen columns, cross-contamination marker, review date, chef/approver.
- Food/Beverage Bible PDFs -> item name, category, buzz words, ingredients, description, meaning, one-liner, allergens, service notes.
- Beverage specs spreadsheets -> cocktail/batch, glassware/storage vessel, quantity, unit, ingredient, garnish, method, par, batch quantity.
- Monthly briefing spreadsheet -> daily briefing calendar with food item, beverage item, buzz words, one-liners, staff talking points.
- Seat-number PDF -> floor/table/seat map structure.
- Values/SOP/brand/audit PDFs -> standards, values-to-behavior checklist, SOP library, audit/opening checklist, staff training.

Do not ask Anwar to test Venue Ops as finished unless at least one source-shaped feature works end to end with fields matching the reference documents.

Build:

- Allergen Matrix: add/edit item, allergen flags, cross-contamination note, review date, approver/status.
- Menu Bible: add/edit card with ingredients, story/meaning, buzz words, one-liner, service notes, allergens.
- Beverage / Batch Specs: add/edit spec with glassware/storage vessel, ingredient lines, garnish, method, par/batch qty.
- Briefings: create daily/monthly briefing, focus items, manager prompt, draft/published status.
- Venue Ops Dashboard: real counts for allergen items, bible cards, specs, briefings.

Acceptance:

- Each screen shows the fields listed for that reference file, not a shorter generic form.
- Anwar can enter one real row from a reference file and see those fields on the list.
- Dashboard counts change.
- Finance off and inventory off still work.
- Generic CRUD alone is not acceptance.

## Phase 4A — Advanced HR

Mission: complete advanced HR features with real records.

Build:

- Schedule / Shifts using `hrSchedules`.
- HR Notes / Incidents using `hrNotes`.
- Assets / Uniforms using `hrAssets`.
- HR Reports with real counts.

Acceptance:

- Anwar can create a shift.
- Anwar can add manager-only HR note/incident.
- Anwar can assign asset/uniform.
- HR report counts update.
- HR notes are manager/admin only.
- Finance off still works.

## Phase 5 — Optional Bridges

Mission: connect optional modules without making them dependencies.

Build only if the base feature exists and gates pass:

- Attendance -> payroll suggestions.
- Venue specs -> inventory/recipe links.
- Floor map -> reservations/CRM context.
- Briefings/training -> HR completion.
- Payroll -> existing salary payment/GL flow.

Acceptance:

- Bridges are hidden when target module is off.
- Core HR/Venue Ops still work when finance/inventory/CRM/reservations are off.
- Existing production finance/payroll behavior is unchanged.

## Phase 6 — Source Import + Polish

Mission: import source material only after explicit approval.

Rules:

- Berenjak files are discovery/test material only.
- No Berenjak/Michelin proprietary text becomes platform default.
- First build an import preview, not direct production writes.
- Production import requires Anwar to name the target store and approve write.

Acceptance:

- Preview maps rows into white-label fields.
- No production write happens by default.
- Imported UI labels are human-readable and store-scoped.

## Builder Handoff Requirement

After each phase, write/update a handoff in `docs/handoff/` with:

- Changed files.
- Surface touched.
- What was not deployed.
- How Anwar should test.
- What remains for the next phase.

When Anwar confirms a test passed, update that handoff with:

- Date.
- What he tested.
- Result: confirmed.
- What is later polish, not a bug.
