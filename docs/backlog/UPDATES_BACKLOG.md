# Updates Backlog (Master Remaining List)

Last updated: 2026-04-27 (AI roadmap moved, GDPR removed, P2 SSL auto-provisioning + Square + OMT + BOB + Whish ops checklist + Whish production cutover + auto currency rates + split payments + refund management workflow + modern minimalist theme + classic e-commerce theme + fashion boutique theme + food/restaurant theme + tech/electronics theme completed)

## Purpose
This is now the single source of truth for remaining updates.
Only pending items are listed here. Completed items and old split lists were removed.

Tag format used on each item:
- `Size`: estimated change size in MB (`2 MB` to `5 MB`)
- `Best`: best timing window (`now`, `soon`, `after N clients`, `after <feature> done`)

## 1) Immediate Execution (P0)

### Whish Production Go-Live
- [ ] Confirm authorized live domain and production callback URLs (`Size: 2 MB`, `Best: now`)
- [ ] Replace sandbox credentials with live credentials (`Size: 2 MB`, `Best: now`)
- [ ] Validate production payment callback and order finalization end-to-end (`Size: 3 MB`, `Best: after Whish cutover done`)
- [ ] Final production smoke test for success/failure payment flows (`Size: 2 MB`, `Best: after Whish callback validation done`)

## 2) Core Upgrades (P1)

- No pending items.

## 3) Commerce and Growth Upgrades (P2)

### WhatsApp Business Expansion
- [ ] Automated order confirmation messages via WhatsApp (`Size: 3 MB`, `Best: after Whish go-live done`)
- [ ] Abandoned cart recovery notifications via WhatsApp (`Size: 3 MB`, `Best: after conversion tracking done`)
- [ ] Delivery status updates via WhatsApp (`Size: 3 MB`, `Best: after order status automation done`)
- [ ] Broadcast campaigns to opted-in customers (`Size: 4 MB`, `Best: after opt-in compliance done`)
- [ ] WhatsApp product catalog sync (`Size: 4 MB`, `Best: after catalog sync quality done`)
- [ ] Chatbot / auto-reply flows (`Size: 4 MB`, `Best: after WhatsApp core workflow done`)

## 4) Payments, Billing, Subscription Expansion (P2)

### Payment Gateways


### Billing Features
- [ ] Payment retry for failed transactions (`Size: 3 MB`, `Best: after primary gateway stability done`)
- [ ] Subscription recurring payments completion (`Size: 4 MB`, `Best: after subscription engine done`)
- [ ] Payment reminder emails (`Size: 2 MB`, `Best: after recurring payments done`)
- [ ] Payment receipts (email/SMS) (`Size: 3 MB`, `Best: after notification channels done`)

### Subscription Platform Completion
- [ ] Subscription engine completion (`Size: 4 MB`, `Best: soon`)
- [ ] Customer subscription portal (`Size: 3 MB`, `Best: after subscription engine done`)
- [ ] Admin subscription management completion (`Size: 3 MB`, `Best: after subscription engine done`)

## 5) Storefront and Theme Expansion (P3)

### Templates and Branding


### Document and Invoice UX
- [ ] Email template controls for notifications (`Size: 3 MB`, `Best: soon`)

## 6) Customer and Order Experience (P3)

### Customer Experience
- [ ] Related products suggestions (`Size: 3 MB`, `Best: soon`)
- [ ] Recently viewed products (`Size: 2 MB`, `Best: now`)
- [ ] Back-in-stock notifications (`Size: 3 MB`, `Best: after inventory event reliability done`)
- [ ] Gift cards (`Size: 4 MB`, `Best: after 100 clients`)
- [ ] Expanded discount codes management (`Size: 3 MB`, `Best: soon`)
- [ ] Abandoned cart recovery (email/web) (`Size: 3 MB`, `Best: after conversion tracking done`)
- [ ] Email marketing integrations (Mailchimp, etc.) (`Size: 3 MB`, `Best: after consent model done`)

### Order Operations
- [ ] Shipping rate calculation enhancements (`Size: 3 MB`, `Best: soon`)
- [ ] Order notes and internal comments (`Size: 2 MB`, `Best: now`)

## 7) Analytics and Reporting Expansion (P3)

- [ ] Customer behavior tracking (`Size: 3 MB`, `Best: soon`)
- [ ] Traffic source analytics (`Size: 3 MB`, `Best: soon`)
- [ ] Conversion funnel visualization (`Size: 3 MB`, `Best: after behavior tracking done`)
- [ ] Custom date-range reports (`Size: 2 MB`, `Best: now`)
- [ ] Export reports to PDF/Excel completion (`Size: 3 MB`, `Best: after reporting schema done`)

## 8) Notification Infrastructure Expansion (P3)

- [ ] SMS notification channel (`Size: 3 MB`, `Best: after email and push baseline done`)
- [ ] Full WhatsApp Business API workflow (`Size: 4 MB`, `Best: after WhatsApp expansion done`)

## 9) Localization and Mobile Platform (P4)

### Localization
- [ ] English localization package completion (`Size: 2 MB`, `Best: soon`)
- [ ] Arabic RTL completion (`Size: 4 MB`, `Best: after 20 clients`)
- [ ] French localization package (`Size: 3 MB`, `Best: after English localization done`)
- [ ] Language switcher (`Size: 3 MB`, `Best: after English localization done`)
- [ ] Currency by location (`Size: 3 MB`, `Best: after localization baseline done`)
- [ ] Date/time formatting by locale (`Size: 2 MB`, `Best: after language switcher done`)

### Mobile
- [ ] React Native iOS app (`Size: 5 MB`, `Best: after 100 clients`)
- [ ] React Native Android app (`Size: 5 MB`, `Best: after 100 clients`)
- [ ] Store owner dashboard app (`Size: 4 MB`, `Best: after Android app done`)
- [ ] Customer shopping app (`Size: 5 MB`, `Best: after owner dashboard app done`)
- [ ] Mobile push notifications (`Size: 3 MB`, `Best: after mobile auth stability done`)
- [ ] Offline mode (`Size: 4 MB`, `Best: after core mobile app done`)
- [ ] Barcode scanner for inventory (`Size: 3 MB`, `Best: after owner dashboard app done`)

## 10) Legacy Pending QA/Triage (still unchecked in planning docs)

### Production and Receiving Flow QA
- [ ] Complete Production dialog: open/action/state/error/success behavior checks (`Size: 2 MB`, `Best: now`)
- [ ] Verify stock movement and status updates for production completion (`Size: 3 MB`, `Best: now`)
- [ ] Verify Receive Items flow updates raw material stock and PO status (`Size: 3 MB`, `Best: now`)

### Reporting and Finance QA
- [ ] Fix filtered totals in sales/revenue views (`Size: 3 MB`, `Best: now`)
- [ ] Fix net amount print calculation issues (`Size: 2 MB`, `Best: now`)
- [ ] Validate decimal input behavior and validation edge cases (`Size: 2 MB`, `Best: now`)
- [ ] Review and fix revenue calculation logic for all order statuses (`Size: 3 MB`, `Best: now`)

### Recipe and Order UX Tasks
- [ ] Add recipe edit impact dialog (new production vs update existing inventory) (`Size: 2 MB`, `Best: soon`)
- [ ] Add order search UX (ID/customer/product + clear search) (`Size: 2 MB`, `Best: now`)

### Mobile Backend Rules Verification
- [ ] Add low stock push trigger in `checkExpiringStock` (`Size: 2 MB`, `Best: soon`)
- [ ] Verify mobile upload storage rules (`Size: 2 MB`, `Best: after mobile beta done`)
- [ ] Verify Firestore `products` write rules for store owner mobile flow (`Size: 3 MB`, `Best: after mobile beta done`)

### Incident Approval Tasks
- [ ] Approve production-only reconciliation implementation (`Size: 2 MB`, `Best: now`)
- [ ] Approve no-apply current order-based dry-run result (`Size: 2 MB`, `Best: now`)

## Notes
- This backlog intentionally contains pending work only.
- If an item is completed elsewhere, mark it done here and remove duplicates from old planning docs in the same PR.
