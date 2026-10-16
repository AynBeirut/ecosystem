# HR + Venue Ops phase 1 — 2026-09-27

Phase 1 only. Shells and gates. No records, payroll posting, or imports.

## Files

- `src/pages/admin/AdminHrShell.tsx`
- `src/pages/admin/AdminVenueOpsShell.tsx`
- `src/components/admin/OpsHubShell.tsx`
- `src/lib/hrVenueOpsShell.ts`
- `src/lib/featureAccessGate.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `docs/handoff/hr-venue-ops-phase1-2026-09-27.md`

## What changed

- Store Profile → Venue operations layout: **Official HR** and **Venue operations** toggles (`enableOfficialHr`, `enableVenueOpsHub`).
- Sidebar and dashboard shortcuts: **HR** (`/admin/hr`) and **Venue Ops** (`/admin/venue-ops`) when the triple gate passes.
- Shell tabs only. No employee, allergen, or briefing records.
- Payroll tab and Staff (Payroll) stay behind finance. Daily Presence stays on `/admin/staff-presence`.
- Firestore rule skeleton for the planned HR and venue collections. Same-store owner/manager only. Not deployed.

## Surfaces

- Store Profile venue layout (not Invoice Document setup, not website theme).
- Admin nav, dashboard shortcuts, `/admin/hr`, `/admin/venue-ops`.
- Old routes left in place: `/admin/staff`, `/admin/salaries`, `/admin/staff-presence`.

## Staging

Hosting channel only, 2026-09-27: https://market-flow-7b074--staging-qj6e98fx.web.app

Bundle `assets/index-DO22cJYE.js` (2026-09-27 evening). Live channel was not released. Functions, Firestore rules, and production hosting were not deployed.

Grabio’s own store uses the classic menu, so the live-kitchen layout panel was hidden. Store Profile now shows **HR and Venue Ops** for every store, under Subscription Plan. Turn those switches on, then open the hubs.

Staging uses the live database. Turning a venue toggle on writes that store’s profile. Do not do that on a client store you want left unchanged.

## How Anwar should test

Open https://market-flow-7b074--staging-qj6e98fx.web.app and hard refresh. Use a live-kitchen store with restaurant-focused admin menu on. Do not use a client store that should stay unchanged.

1. Finance off, inventory off, Team module on: sidebar shows HR and Venue Ops. Payroll tab and Staff (Payroll) stay hidden. Open both hubs.
2. Turn Official HR off in Store Profile: `/admin/hr` is blocked. Venue Ops can stay.
3. Cashier: Venue Ops opens. HR does not.
4. Finance on: Payroll tab appears on HR and links to the existing Staff and Salary screens. Those old screens still work.
5. Invoice PDF template and Theme Editor are unchanged.

Confirmed tests get a date and **confirmed** written back on this file.
