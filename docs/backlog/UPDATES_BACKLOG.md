# Updates Backlog

Last updated: 2026-04-26

## Scope
This backlog consolidates unfinished updates into one place.

## Source Documents
- STORE_TEMPLATE_UPDATES.md
- TEMPLATE_UPDATES.md
- Shopify Features.docx (feature gap review)

## A) Open Items From Store Template Updates

### 1) Pending Testing Checklist
- [x] Test fullscreen hero: Container=Full, Padding=0, BG=Off, Border=Off
- [x] Verify other sections with full-width containers
- [x] Test unsaved changes warning when closing tab
- [x] Verify save buttons at bottom of all tabs
- [x] Test grid width combinations (full/half/third)
- [x] Verify color-coded button styling
- [x] Test reset to template defaults
- [x] Verify auto-save for template selection

### 2) Follow-up Enhancements (Not Implemented Yet)
- [ ] Add section background image support
- [ ] Add section-level animations/transitions
- [ ] Add custom CSS per section
- [ ] Add drag-and-drop reordering for sections

## B) Platform Feature Backlog (From Shopify Feature Gap Review)

### High Priority
- [x] Customer self-serve returns flow (initiate return from customer account)
- [x] Exchanges workflow end-to-end (net payable/refundable scenarios)
- [x] Supplier returns backend + admin frontend integration (API + UI) completed and deployed
- [x] Delivery settings full integration with operational fulfillment workflow

### Medium Priority
- [x] Smart order routing across multiple fulfillment locations
- [x] Split/merge orders workflow
- [x] Shipping labels workflow (bulk labels, manifests, pickup scheduling)
- [x] Saved custom order views
- [x] Marketplace integrations (Amazon, Walmart, eBay, Etsy)
- [x] Finance suite (Balance/Capital/Credit/Bill Pay style modules)

### Low Priority / Future
- [ ] AI assistant (Sidekick-style) for merchant operations
- [ ] AI image editing/generation workflow for products
- [ ] AI-assisted live chat response system


## Notes
- TEMPLATE_UPDATES.md reports "No Pending Work" for that specific deployment session.
- Open checklist items above are mostly from STORE_TEMPLATE_UPDATES.md and platform feature-gap review.
- Supplier returns API routes are now live in production and require auth (401 without token confirmed).
- Legacy supplier returns route was hidden; primary route is `/admin/supplier-returns`.
- Customer self-serve return requests are now available in `/orders` for delivered/completed orders and are written to `returnRequests` for admin processing in `/admin/returns`.
- Exchange requests are now supported in `/orders` with replacement-item selection and automatic net settlement calculation (customer payable/refundable/even), visible in `/admin/returns` with exchange finalization.
- Delivery settings now persist in store profile and are operationally enforced in order creation/editing (`deliveryMethod`, computed `deliveryFee`, ETA, working schedule) and reflected in order totals/records.
- Smart order routing is now active in order create/edit: orders auto-select best active fulfillment location by delivery compatibility + city coverage + priority, with optional manual override, and persist routing metadata (`fulfillmentLocationId`, name, score, auto/manual flag).
- Split/merge workflow is now available in `/admin/orders` for active unpaid orders: split selected item quantities into a child order and merge one active unpaid order into another with totals recomputed and merge/split metadata persisted.
- Shipping labels workflow is now available in `/admin/orders`: select eligible orders (confirmed/processing/ready), generate single/bulk printable labels, generate printable manifests, and schedule pickups with carrier/date/notes persisted to orders.
- Delivery partner configuration now supports multiple shipping partners, multiple local delivery partners, and optional own in-house delivery via `/admin/delivery`; pickup carrier choices in `/admin/orders` are loaded dynamically from these settings with a configurable default.
- Saved custom order views are now available in `/admin/orders`: admins can filter by search/status/payment/delivery method, save the current filter set as a named view, re-apply views, and delete views (persisted per store admin).
- Marketplace integration foundation is now available in `/admin/profile`: admins can enable/configure Amazon, Walmart, eBay, Etsy, and Alibaba credentials, plus manage multiple dropshipping partners (enabled state, contact, webhook, notes).
- Marketplace sync center is now available at `/admin/marketplace`: admins can run connection tests per enabled channel, filter product scope, manually push product snapshots (starting with Alibaba-first operational flow), and review recent sync history.
- Marketplace sync status flow now supports queued/processing/completed/failed states with failed-item reason visibility, per-channel sync settings (full/incremental + auto-retry toggle), and one-click retry for failed jobs.
- Finance suite hub is now available at `/admin/finance` with Balance/Capital/Credit/Bill Pay modules, real-time finance KPIs (gross/paid/receivable/expenses), and quick actions linked to existing finance workflows (`/admin/payments`, `/admin/revenue`, `/admin/account-statement`, `/admin/expenses`, `/admin/bank-reconciliation`).
