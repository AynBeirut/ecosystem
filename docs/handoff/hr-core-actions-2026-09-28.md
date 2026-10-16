# HR actions — 2026-09-28

**Status:** staging hosting released 2026-09-28. Live hosting was not released. Anwar has not tested this.

Staging: https://market-flow-7b074--staging-qj6e98fx.web.app — `index-ryGUiGT_.js`. Release `sites/market-flow-7b074/channels/staging/releases/1790597205819000`. Live stayed `versions/407c48ddaa0f7ed0`.

## What you can do

`/admin/hr` is a working HR desk, not placeholder tabs.

- Employees: add and edit. Name, position, and status are required. Phone, email, department, and hire date are optional. No wage field. Edit does not write salary or payroll exclusion.
- Leave: create a request, filter by Requested / Approved / Rejected, then Approve or Reject.
- Training: add a title, assign it with a due date, then Mark complete. An assignment due today or earlier counts as overdue until it is completed.
- Documents: type, employee, issue date, expiry, notes. No file upload.
- Dashboard cards: active employees, pending leave, overdue training, expiring documents.

`/admin/staff`, `/admin/salaries`, salary payment math, and payroll GL were not changed. Payroll stays hidden when finance is off.

## Changed files

- `src/lib/hrCore.ts`
- `src/lib/hrCoreService.ts`
- `src/pages/admin/hr/HrCorePanels.tsx`
- `src/lib/hrVenueOpsShell.ts`
- `src/__tests__/hrCorePhase2.test.ts`
- `README.md`, `decision-log.md`

## Not deployed

Hosting, functions, Firestore rules, APK, and POS were not released. No production documents were written.

Employee add/edit uses the live `staff` rules, so that save can succeed for a store admin once this build is running. Leave, training, and documents use collections whose rules are still local. Those saves return missing permissions until you ask for a rules release.

## Test steps

Use your own store on staging with Official HR on. Do not use a client store. Hard-refresh.

1. Open `/admin/hr`. Note the four counts.
2. Employees: add a person with a name and position and no wage. They appear in the list. Edit the position and save. They do not appear on Salary Payments.
3. Leave: create a request. It shows under Requested and pending leave goes up by one. Approve it. It leaves Requested and the pending count drops. Reject works the same on another request.
4. Training: add a title, assign it due today. Overdue training goes up by one. Mark complete. The count drops.
5. Documents: add a type, employee, and an expiry inside 30 days. Expiring documents goes up by one.
6. Open Staff and Salary Payments. Existing payroll still loads.

Reviewed: vitest `hrCorePhase2` and `hrVenueOpsPhase1` — 11 passed. Not opened in the browser. Not deployed.
