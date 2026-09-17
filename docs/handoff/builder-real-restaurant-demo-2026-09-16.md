# Builder Prompt - Real Restaurant Interactive Demo

Use this prompt in the builder/execution conversation.

---

You are working in `/home/anwar/Documents/grabio space`.

Mission: build a real interactive restaurant demo for Grabio's fine-dining / Live Kitchen package.

The public store pages already let visitors see storefronts. This demo is different: it shows the admin/dashboard experience a restaurant client unlocks after subscription.

## Product Goal

A visitor should be able to open a demo restaurant dashboard and try real flows without creating real production data.

They can create limited demo objects such as:

- products / menu items
- customers / guests
- reservations / events
- orders
- invoices or documents
- CRM notes/tasks

But every write must be saved as demo data only.

Example:

- If visitor creates an invoice, it becomes a **demo invoice**, not a real invoice.
- If visitor creates a product, it becomes a **demo product**, not a real store product.

## Hard Rules

- Do not write demo visitor data into real production store collections.
- Do not use a real client store as the write target.
- Do not expose real client financial, customer, staff, order, or inventory data.
- Do not let anonymous demo users trigger real payments, real emails, real WhatsApp, real stock movement, real GL, real POS sync, or real document numbering.
- Every generated document must be visibly marked `DEMO`.
- Demo data must expire/delete after 30 minutes.
- Visitor can create up to 5 demo items/actions per session.
- No deploy or push without Anwar approval.

## Recommended Architecture

Use a separate demo session namespace.

Suggested model:

```text
demoRestaurantSessions/{sessionId}
demoRestaurantSessions/{sessionId}/products/{id}
demoRestaurantSessions/{sessionId}/guests/{id}
demoRestaurantSessions/{sessionId}/reservations/{id}
demoRestaurantSessions/{sessionId}/orders/{id}
demoRestaurantSessions/{sessionId}/documents/{id}
demoRestaurantSessions/{sessionId}/crmTasks/{id}
```

Each session stores:

- `createdAt`
- `expiresAt`
- `actionCount`
- `maxActions: 5`
- `visitorId` or anonymous session id
- `demoPackage: pkg_live_kitchen`
- `businessWorkflow: live_kitchen`

All demo records store:

- `demo: true`
- `sessionId`
- `expiresAt`
- `createdByDemoVisitor: true`

## Cleanup

Implement cleanup so demo data expires after 30 minutes.

Preferred:

- Firestore TTL field: `expiresAt`, if already enabled/safe.

Fallback:

- Scheduled Cloud Function cleanup for expired `demoRestaurantSessions`.

Do not rely only on frontend localStorage cleanup.

## UI Direction

Create an interactive demo entry for restaurant prospects.

Suggested routes:

- `/demo/restaurant/admin`
- `/demo/live-kitchen/admin`
- or extend existing `/demo-os` if cleaner.

The demo should feel like a subscribed restaurant admin account:

- Today / Daily Operations
- Reservations
- Guests & CRM
- Service / Orders
- Kitchen
- Staff
- Reports
- Website / Content / SEO preview
- Settings preview

Optional sections can show locked/upgrade behavior:

- Inventory
- Purchasing
- Accounting
- Finance

## Existing Files To Inspect

Start with existing demo/public architecture:

- `src/data/marketing/demoOsCatalog.ts`
- `src/pages/public/DemoOsIndexPage.tsx`
- `src/pages/public/DemoOsModulePage.tsx`
- `src/pages/public/DemoVerticalOsPage.tsx`
- `src/components/marketing/DemoOsGate.tsx`
- `src/components/marketing/DemoOsLayout.tsx`
- `src/components/marketing/DemoPreviewMockScreen.tsx`
- `src/components/marketing/DemoPreviewViewer.tsx`
- `src/pages/public/ModularHome.tsx`
- `src/pages/public/Pricing.tsx`

Then inspect admin/dashboard pieces to reuse UI safely:

- `src/pages/admin/AdminDashboard.tsx`
- `src/hooks/useAdminNavigation.ts`
- `src/lib/effectiveStoreContext.ts`
- `src/lib/featureAccessGate.ts`
- `src/lib/venueOpsNav.ts`
- `src/lib/venueSetupReadiness.ts`
- `src/lib/restaurantRolePolicy.ts`
- `src/types/storeProfile.ts`

If backend cleanup is needed, inspect:

- `functions/src/index.ts`
- `functions/src/scheduled/*`
- `firestore.rules`

## Implementation Direction

Build the demo as a sandbox, not a fake static screenshot.

Minimum viable interactive demo:

1. Create demo session.
2. Load seeded restaurant sample data.
3. Allow visitor to create up to 5 demo objects.
4. Save demo writes under `demoRestaurantSessions/{sessionId}/...`.
5. Show created demo objects immediately in the demo dashboard.
6. Mark documents and rows with `DEMO`.
7. Disable real side effects.
8. Expire session after 30 minutes.

## Data Separation

Use adapters/services so demo writes do not touch production services directly.

Example direction:

```text
restaurantDemoService.createDemoInvoice(...)
```

must write to:

```text
demoRestaurantSessions/{sessionId}/documents
```

not:

```text
stores/{storeId}/journalEntries
stores/{storeId}/invoices
orders
products
customers
```

If reusing admin components, inject a demo data provider or demo mode flag so writes route to demo services.

## Security Requirements

Firestore rules must ensure:

- Demo visitor can only read/write their own session.
- Demo visitor cannot write outside `demoRestaurantSessions/{sessionId}`.
- Max actions cannot be bypassed from client.
- Real store collections reject demo visitor writes.

If max-action enforcement cannot be guaranteed in rules, use a callable/server endpoint that increments `actionCount` transactionally.

## Limits

- Max 5 create actions per demo session.
- 30-minute expiry.
- No real integrations.
- No real notifications.
- No real payments.
- No real GL/posting.
- No real POS sync.
- No real email/WhatsApp send.

## Done When

- Visitor can open restaurant admin demo without paid subscription.
- Visitor sees what a restaurant package unlocks.
- Visitor can create up to 5 demo items.
- Created items are visible immediately but marked demo.
- Demo data is isolated from real store data.
- Demo data expires after 30 minutes.
- Direct URL/Firestore access cannot escape the demo namespace.
- Tests or evidence cover the write limit and isolation.
- Docs/evidence are written under `reporting/data/`.

## Required Final Report

Report:

- Routes added/changed.
- Data namespace used.
- Which demo actions are supported.
- How the 5-action limit is enforced.
- How 30-minute deletion/expiry is enforced.
- Which real side effects are disabled.
- Tests/builds run.
- Evidence files written.
- Whether deploy/push is pending approval.

Do not say verified unless the demo was actually run.
