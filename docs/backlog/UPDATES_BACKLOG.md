# Updates Backlog

Last updated: 2026-04-27

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
- [x] Add section background image support
- [x] Add section-level animations/transitions
- [x] Add custom CSS per section
- [x] Add drag-and-drop reordering for sections

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

### Newly Requested Enhancements
- [x] Product ratings and reviews flow (storefront + customer history + admin moderation)
- [x] Automatic order notifications for guest and signed-in buyers via email and optional WhatsApp
- [x] Critical payment gateway control center (admin toggles + backend enforcement for disabled providers)
- [x] Product/service completion with store-level service billing policy controls and enforcement
- [x] Subscription billing infrastructure settings (auto-renew, retry policy, grace/invoice lead times, preferred renewal gateway)
- [x] SEO basics expansion (keywords, robots, canonical/meta overrides, OG/Twitter enrichments)
- [x] Meta/Facebook integration settings and runtime pixel wiring from store profile


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
- Channel mapping templates and pre-sync validation gates are now included in `/admin/marketplace`: admins can set required fields per channel (e.g., Alibaba/Amazon/eBay templates), run validation to see invalid product samples, and only enqueue sync jobs after a passing validation report.
- Finance suite hub is now available at `/admin/finance` with Balance/Capital/Credit/Bill Pay modules, real-time finance KPIs (gross/paid/receivable/expenses), and quick actions linked to existing finance workflows (`/admin/payments`, `/admin/revenue`, `/admin/account-statement`, `/admin/expenses`, `/admin/bank-reconciliation`).
- Store template editor now supports richer section controls in `/admin/templates`: per-section background images, section animation presets, custom CSS blocks, and drag-and-drop section ordering with live storefront rendering support.
- Product reviews are now implemented end-to-end: customers can submit product reviews from product pages after purchase, order history surfaces review status, and admins moderate reviews in `/admin/product-reviews` with product rating aggregates updated on approve/reject.
- Automatic order notifications are now active for checkout-created orders: email confirmations are sent for guest/signed-in buyers, optional WhatsApp webhook delivery is supported when configured, and delivery logs with retry are available in `/admin/order-notifications`.
- Payment gateway controls are now consolidated in `/admin/payments` with a gateway control center (Whish/Stripe/PayPal/Bank transfer/COD), persistent store-level gateway preferences, and backend checkout enforcement that blocks Whish/Stripe checkout when disabled in store settings.
- Service policy controls are now available in `/admin/profile` (allow services, recurring billing policy, default billing type, minimum service duration, renewal reminder defaults) and enforced in `/admin/products` create/edit flows.
- Subscription billing policy controls are now available in `/admin/profile` (auto-renew toggle, retry behavior, max retries, grace days, invoice lead days, preferred renewal gateway) and persisted per store profile for operational billing workflows.
- SEO and Meta/Facebook configuration now supports store-level overrides in `/admin/profile`, and storefront/product metadata rendering now consumes those settings (keywords, robots directives, canonical/meta description/title suffix, OG image, twitter handle, fb app id, optional per-store pixel id).
