# Official HR core — phase 2 — 2026-09-28

**Status:** local only. Not deployed. Anwar has not tested this phase.

## What this is

`/admin/hr` now holds the store HR core: dashboard cards, employee directory, a link to Daily Presence, leave requests, training assignments, and document metadata. Payroll, salaries, presence, and GL posting were not rewritten.

## Surfaces

| Path | What you see |
|---|---|
| `/admin/hr` | Counts: employees, active, open leave, training due, documents to review |
| `/admin/hr/employees` | Add a person with name, position, department, hire date. No wage field |
| `/admin/hr/attendance` | Link to `/admin/staff-presence` |
| `/admin/hr/leave` | Leave request for an employee in this store |
| `/admin/hr/training` | Training title, then assign it |
| `/admin/hr/documents` | Title, type, expiry. No file upload |
| `/admin/hr/payroll` | Shown only when finance/payroll is on. Links to existing Staff and Salaries |
| `/admin/staff`, `/admin/salaries`, `/admin/staff-presence` | Unchanged |

Gate is unchanged: Team entitlement + Official HR toggle + owner/manager. Finance off hides payroll and still shows the HR core.

## Data

- Employees are `staff` rows. Write sets `payrollExcluded: true` and does not set salary, hourly rate, or monthly salary. They stay off the existing payroll roster, so they do not appear as $0 rows on Staff (Payroll) or Daily Presence.
- Attendance source stays `staffPresence`. This phase only links to the existing screen.
- New collections, each with `storeId`: `hrLeaveRequests`, `hrTrainingItems`, `hrTrainingAssignments`, `hrDocuments`.
- Lists use the person or document name. Firestore ids are not shown as labels.

## Changed files

- `src/lib/hrCore.ts`
- `src/lib/hrCoreService.ts`
- `src/pages/admin/hr/HrCorePanels.tsx`
- `src/pages/admin/AdminHrShell.tsx`
- `src/components/admin/OpsHubShell.tsx` (optional children slot)
- `src/lib/hrVenueOpsShell.ts` (section summaries)
- `src/__tests__/hrCorePhase2.test.ts`
- `README.md`, `architecture.md`, `decision-log.md`

## Not deployed

- Live hosting and the staging channel were not released.
- Functions, APK, and POS were not touched.
- No production documents were written.
- HR collection rules in `firestore.rules` were **not** released. The live ruleset still has `salaryPayments` and does **not** have `hrLeaveRequests`. Leave, training, and document saves will show missing permissions until a later rules release. The employee directory can save, because `staff` rules are already live for a store admin.

## How Anwar should test

Use your own Grabio store. Turn on **Store Profile → HR and Venue Ops → Official HR**. Do not use a client store.

1. Open `/admin/hr`. Cards load. With finance off, the note says payroll is hidden and the Payroll tab is absent.
2. Add an employee with a name and no wage. They appear on Employees by name. They do not appear on Staff (Payroll) or Salary Payments.
3. Open Staff and Salary Payments. Existing people and amounts still load.
4. Leave, training, and documents will fail with a permissions error until the HR rules are released. That failure is expected in this handoff.
5. A manager from another store must not see this store's rows. Rules for the new collections are local only, so this check waits for the rules release.

Reviewed: `npx vitest run` on `hrCorePhase2`, `hrVenueOpsPhase1`, and `featureAccessGate` — 18 passed. Not tested in the browser. Not deployed.
