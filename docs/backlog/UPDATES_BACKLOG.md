# Updates Backlog (Master Remaining List)

Last updated: 2026-04-27

## Purpose
This is now the single source of truth for remaining updates.
Only pending items are listed here. Completed items and old split lists were removed.

## 1) Immediate Execution (P0)

### Security and Compliance (Optional, recommended hardening)
- [ ] (Optional) Enable Firebase Auth MFA (TOTP) for admin accounts
- [ ] (Optional) Add 2FA enrollment flow in admin profile/first login
- [ ] (Optional) Show QR setup for authenticator enrollment
- [ ] (Optional) Add IP whitelist for admin panel
- [ ] (Optional) Complete GDPR compliance tooling
- [ ] (Optional) Add customer data export flow (GDPR)
- [ ] (Optional) Add right-to-be-forgotten flow (GDPR delete)
- [ ] (Optional) Add privacy policy generator flow

### GDPR API + UI
- [ ] Implement `POST /gdpr/export`
- [ ] Implement `POST /gdpr/delete`
- [ ] Add admin UI and customer request UI for GDPR actions

### Whish Production Go-Live
- [ ] Finish Whish production cutover (sandbox -> production)
- [ ] Confirm authorized live domain and production callback URLs
- [ ] Replace sandbox credentials with live credentials
- [ ] Validate production payment callback and order finalization end-to-end
- [ ] Final production smoke test for success/failure payment flows

## 2) Core Upgrades (P1)

### AI Roadmap (from active platform backlog)
- [ ] AI assistant (Sidekick-style) for merchant operations
- [ ] AI image editing/generation workflow for products
- [ ] AI-assisted live chat response system

## 3) Commerce and Growth Upgrades (P2)

### WhatsApp Business Expansion
- [ ] Automated order confirmation messages via WhatsApp
- [ ] Abandoned cart recovery notifications via WhatsApp
- [ ] Delivery status updates via WhatsApp
- [ ] WhatsApp chat widget on storefront
- [ ] Broadcast campaigns to opted-in customers
- [ ] WhatsApp product catalog sync
- [ ] Chatbot / auto-reply flows

### SEO and Discoverability (advanced)
- [ ] XML sitemap generation endpoint and submission workflow
- [ ] Structured data (Schema.org) for product/store pages
- [ ] Custom URLs for products/categories
- [ ] Alt text workflow for uploaded images
- [ ] Robots.txt management controls

### Meta Ecosystem (advanced)
- [ ] Meta Catalog sync completion
- [ ] Facebook Shop integration
- [ ] Instagram Shopping integration
- [ ] Meta Ads campaign creation flow
- [ ] Conversion tracking completion
- [ ] Dynamic product ads support

### Domain and White-label Growth
- [ ] Allow stores to use own domains (`store.com`)
- [ ] SSL auto-provisioning
- [ ] DNS configuration wizard
- [ ] Domain verification system

## 4) Payments, Billing, Subscription Expansion (P2)

### Payment Gateways
- [ ] Add Square integration
- [ ] Add OMT integration
- [ ] Add BOB Finance integration
- [ ] Complete production-grade Whish payment ops checklist

### Billing Features
- [ ] Auto-updating currency rates
- [ ] Split payments (partial payment)
- [ ] Refund management workflow
- [ ] Payment retry for failed transactions
- [ ] Subscription recurring payments completion
- [ ] Payment reminder emails
- [ ] Payment receipts (email/SMS)

### Subscription Platform Completion
- [ ] Subscription engine completion
- [ ] Customer subscription portal
- [ ] Admin subscription management completion

## 5) Storefront and Theme Expansion (P3)

### Templates and Branding
- [ ] Modern minimalist theme
- [ ] Classic e-commerce theme
- [ ] Fashion/boutique theme
- [ ] Food/restaurant theme
- [ ] Tech/electronics theme
- [ ] Logo positioning controls

### Document and Invoice UX
- [ ] Email template controls for notifications

## 6) Customer and Order Experience (P3)

### Customer Experience
- [ ] Related products suggestions
- [ ] Recently viewed products
- [ ] Back-in-stock notifications
- [ ] Gift cards
- [ ] Expanded discount codes management
- [ ] Abandoned cart recovery (email/web)
- [ ] Email marketing integrations (Mailchimp, etc.)

### Order Operations
- [ ] Shipping rate calculation enhancements
- [ ] Order notes and internal comments

## 7) Analytics and Reporting Expansion (P3)

- [ ] Customer behavior tracking
- [ ] Traffic source analytics
- [ ] Conversion funnel visualization
- [ ] Custom date-range reports
- [ ] Export reports to PDF/Excel completion

## 8) Notification Infrastructure Expansion (P3)

- [ ] SMS notification channel
- [ ] Full WhatsApp Business API workflow

## 9) Localization and Mobile Platform (P4)

### Localization
- [ ] English localization package completion
- [ ] Arabic RTL completion
- [ ] French localization package
- [ ] Language switcher
- [ ] Currency by location
- [ ] Date/time formatting by locale

### Mobile
- [ ] React Native iOS app
- [ ] React Native Android app
- [ ] Store owner dashboard app
- [ ] Customer shopping app
- [ ] Mobile push notifications
- [ ] Offline mode
- [ ] Barcode scanner for inventory

## 10) Legacy Pending QA/Triage (still unchecked in planning docs)

### Production and Receiving Flow QA
- [ ] Complete Production dialog: open/action/state/error/success behavior checks
- [ ] Verify stock movement and status updates for production completion
- [ ] Verify Receive Items flow updates raw material stock and PO status

### Reporting and Finance QA
- [ ] Fix filtered totals in sales/revenue views
- [ ] Fix net amount print calculation issues
- [ ] Validate decimal input behavior and validation edge cases
- [ ] Review and fix revenue calculation logic for all order statuses

### Recipe and Order UX Tasks
- [ ] Add recipe edit impact dialog (new production vs update existing inventory)
- [ ] Add order search UX (ID/customer/product + clear search)

### Mobile Backend Rules Verification
- [ ] Add low stock push trigger in `checkExpiringStock`
- [ ] Verify mobile upload storage rules
- [ ] Verify Firestore `products` write rules for store owner mobile flow

### Incident Approval Tasks
- [ ] Approve production-only reconciliation implementation
- [ ] Approve no-apply current order-based dry-run result

## Notes
- This backlog intentionally contains pending work only.
- If an item is completed elsewhere, mark it done here and remove duplicates from old planning docs in the same PR.
