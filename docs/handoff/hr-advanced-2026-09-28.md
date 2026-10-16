# HR schedule, notes, assets, reports — 2026-09-28

**Status:** local only. Not deployed. Not on staging. Anwar has not tested this.

## What you can do

`/admin/hr` now saves shifts, notes, and assets. Finance can stay off. Payroll stays on the existing Staff and Salary screens.

- Schedule: add and edit a shift with employee, date, start, end, station, and notes. The list is the current week.
- Notes: owner or manager only. Types are note, incident, warning, praise, and review, plus date, severity, and the note text. A cashier does not get this tab.
- Assets: assign an item with type, name, issue date, return date, issued or returned, and notes.
- Reports: active employees, pending leave, training overdue, expiring documents, shifts this week, open incidents, and issued assets.

Lists use the person or item name. Firestore ids are not shown.

## Changed files

- `src/lib/hrCore.ts`
- `src/lib/hrCoreService.ts`
- `src/lib/hrVenueOpsShell.ts`
- `src/pages/admin/hr/HrAdvancedPanels.tsx`
- `src/pages/admin/AdminHrShell.tsx`
- `src/pages/admin/hr/HrCorePanels.tsx` (empty bundle fields only)
- `src/__tests__/hrCorePhase2.test.ts`
- `README.md`, `decision-log.md`

## Not deployed

Hosting, functions, Firestore rules, APK, POS, and production data were not released. `/admin/staff`, `/admin/salaries`, salary payment math, and payroll GL were not changed.

Shift, note, and asset saves use collections whose rules are still local. Those saves return missing permissions until you ask for a rules release.

## Test steps

Use your own store with Official HR on and finance off. Do not use a client store. This pass is not on the current staging URL.

1. Open `/admin/hr/reports` and note the counts.
2. Add a shift for an employee on a date in this week. Shifts this week goes up by one. Edit the station and save.
3. Add an incident note. Open incidents goes up by one. Sign in as a cashier: the Notes tab is absent.
4. Assign a uniform with status Issued. Issued assets goes up by one. Edit it to Returned. The count drops.
5. Open Staff and Salary Payments. Existing payroll still loads.

Reviewed: vitest `hrCorePhase2` and `hrVenueOpsPhase1` — 11 passed. Not opened in the browser. Not deployed.
