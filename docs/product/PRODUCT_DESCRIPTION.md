# Market Flow - Complete Inventory & Sales Management System

## Overview
Market Flow is a comprehensive cloud-based inventory and sales management solution designed for retail businesses, wholesalers, and distribution companies. Built with modern web technologies and real-time synchronization, it helps businesses streamline operations, track inventory, manage staff, and grow sales efficiently.

## Key Features

### 📦 Inventory Management
- **Multi-level Inventory Tracking**: Manage raw materials, production items, and finished goods
- **Real-time Stock Updates**: Instant synchronization across all devices
- **Low Stock Alerts**: Automated notifications when inventory falls below minimum levels
- **Batch Production Management**: Track production batches with date filters and status monitoring
- **Smart Categorization**: Organize products by categories, units, and custom attributes

### 💰 Sales & Orders
- **Flexible Discount System**: Apply discounts at both order-level and individual item-level
  - Percentage or fixed amount discounts
  - 100% discount support for promotional items
  - Automatic calculation with detailed breakdown
- **Customer Credit Management**: Track customer balances and payment history
- **Invoice Generation**: Professional invoices with customizable details
- **Returns Processing**: Handle sales returns with inventory adjustments

### 👥 Staff & Payroll
- **Staff Management**: Complete employee records with roles and permissions
- **Automated Salary Processing**: Recurring salary expenses with date-based tracking
- **Smart Termination**: Staff termination automatically removes future salary obligations while preserving historical records
- **Multi-role Access Control**: Admin, Manager, and Staff permission levels

### 💳 Financial Management
- **Comprehensive Expense Tracking**: Record and categorize all business expenses
- **Account Statement**: Detailed financial overview with income and expense breakdowns
- **Sub-Accounts System**: Manage multiple business accounts and transactions
- **Payment Tracking**: Monitor customer payments and outstanding balances

### 📊 Analytics & Reporting
- **Real-time Dashboard**: Live business metrics and performance indicators
- **Sales Analytics**: Track daily, weekly, and monthly sales trends
- **Inventory Reports**: Stock levels, movement history, and valuation
- **Financial Reports**: Profit/loss statements and cash flow tracking

### 📱 Mobile-First Design
- **Responsive Interface**: Seamless experience on desktop, tablet, and mobile devices
- **Touch-Optimized Controls**: Intuitive gesture navigation including swipe-to-go-back
- **Progressive Web App (PWA)**: Install on any device for offline capability
- **Interactive Tutorial**: First-time user guidance with animated hints

### 🔐 Security & Access Control
- **Firebase Authentication**: Secure user login with email/password
- **Role-Based Permissions**: Granular access control for different user types
- **Data Isolation**: Store-specific data segregation
- **Cloud Backup**: Automatic data backup and recovery

## Full Feature Catalog (End-to-End)

This section is a complete platform capability snapshot, including legacy and currently active modules beyond backlog-only items.

### Customer Experience and Storefront
- Marketplace browsing and store discovery
- SEO-friendly store and product routes (`/:slug`, category pages, product pages)
- Custom-domain storefront support
- Product details, image/gallery presentation, and review display
- Shopping cart and favorites flows
- Guest order tracking and authenticated order history
- Order confirmation page
- Customer profile area
- Contact page and store contact forms with multiple styles
- Cookie consent and marketing-script gating
- WhatsApp storefront chat widget

### Store Design and Branding System
- Template system with multiple storefront themes
- Advanced color palette controls and preset palettes
- Layout controls (hero, menus, product display, section styles)
- Section visibility/order management
- Drag-and-drop for section ordering
- Drag-and-drop for carousel/gallery media ordering
- Store media management (background, carousel, gallery)
- Custom design import/export and white-label support

### Admin Core Operations
- Admin dashboard and operational summaries
- Product management
- Inventory management (raw materials, composed products, finished goods)
- Recipes and production management
- Purchases and supplier workflows
- Sales returns and supplier returns
- Supplier credits and supplier statements
- Delivery operations and service renewals

### Orders, Payments, and Billing
- Full order management lifecycle
- Partial payments (split payments)
- Refund workflow with history tracking
- Payment status tracking and reconciliation views
- Account statement and cash/bank reconciliation
- Payment gateway controls in admin
- Whish checkout and callback pipeline
- Additional gateway integrations (Square, OMT, BOB)

### Subscription and Access Monetization
- Subscription plans and subscription page flows
- Trial activation and enforcement flows
- Subscription status handling and renewals
- Service subscription and recurring-service hooks
- Billing and payment linkage for subscription state changes

### CRM, Reviews, and Communications
- Customer management (CRM)
- Product review administration
- Marketing subscriber and campaign tooling
- Order notification system and retry handling
- Admin announcements module

### Analytics, Reporting, and Finance
- Revenue and analytics dashboards
- Reports module and export-oriented workflows
- Finance suite and expense tracking
- Salary management and payroll-related operations
- Staff lifecycle and termination-safe payroll behavior

### Team and Permissions
- Sub-account management
- Role-specific dashboards (admin and sub-account)
- Permission-gated route access by capability
- Sales and delivery sub-role support

### Integrations, SEO, and Growth Tooling
- Google Analytics and Meta tracking integrations
- Meta catalog and campaign-related tooling
- SEO controls (sitemap/robots/structured data support)
- Custom domain onboarding and status workflows
- Marketplace sync capabilities

### Security, Audit, and Compliance
- Authentication and protected route enforcement
- Admin IP allowlist controls
- Audit logs module
- GDPR export/delete support and related controls
- Privacy-policy support flows

### Platform Infrastructure
- Firebase hosting/functions/firestore-backed architecture
- API endpoints for checkout, callbacks, webhooks, subscriptions, marketing, and SEO
- PWA assets and service-worker support
- Mobile-responsive UI across admin and storefront surfaces

## Recent Updates

### Recently Completed Platform Features (April 2026)
✨ **Storefront Templates Enhancements**: Template preview before apply, more custom color controls, and extended banner customization.
✨ **Custom Design Import Completed**: Stores can import full design configurations (template, colors, layout, and section settings) and run in white-label mode for a fully customized storefront identity.
✨ **Invoice UX Improvements**: Multiple invoice designs with custom branding and PDF customization options.
✨ **Billing Currency Support**: Multi-currency support currently available for USD and LBP.
✨ **Order Operations**: Expanded shipping option matrix for broader delivery setup coverage.
✨ **Analytics Upgrade**: Google Analytics 4 deep integration with expanded sales and product performance reporting.
✨ **SEO Delivery Completed**: XML sitemap generation + submission workflow, Schema.org product/store structured data, custom product/category URLs, image alt-text workflow, and robots.txt management controls.
✨ **Meta Ecosystem Completed**: Meta catalog feed + sync, Facebook Shop integration, Instagram Shopping integration, conversion tracking completion, Meta Ads campaign creation flow, and dynamic product ads support.
✨ **Domain Enablement Completed**: Custom domain registration for stores, DNS onboarding instructions, custom-domain storefront routing, admin domain status verification checks, and SSL auto-provisioning with automatic retry/status polling.
✨ **Security and GDPR Tooling Completed**: Admin TOTP MFA, optional admin IP allowlist, GDPR export/delete request APIs, admin GDPR controls, customer GDPR request UI, and privacy policy generator flow.
✨ **AI Integration Foundation Completed**: External AI API integration settings, model catalog loading, model selection, and per-model prepaid credit cost configuration in admin.
✨ **Storefront Commerce Upgrade Completed**: Floating WhatsApp chat widget added to storefront and product pages for direct customer messaging.
✨ **Square Gateway Integration Completed**: Square checkout session creation, return confirmation handling, inventory deduction linkage, and admin Square gateway controls.
✨ **OMT Gateway Integration Completed**: OMT transfer checkout initialization, transfer-reference generation, admin OMT receiver controls, and order confirmation workflow hooks.
✨ **BOB Finance Integration Completed**: BOB transfer checkout initialization, transfer-reference generation, admin receiver controls, and order confirmation workflow hooks.
✨ **Whish Production Ops Checklist Completed**: Admin checklist runner now validates cutover readiness, callback references, live credential quality signals, payment success/failure evidence, and order finalization coverage.
✨ **Whish Production Cutover Completed**: Functions now default to Whish production API endpoints, sandbox fallback credentials were removed, and Whish credentials are enforced through secure runtime environment variables.
✨ **Authorized Callback Domain Configuration Completed**: Checkout now resolves and validates live callback/redirect domains from store payment settings, supports secure success/failure callback URL overrides, and removes hardcoded production redirect hosts.
✨ **Whish Callback Validation Automation Completed**: Added a production audit script that validates callback URL persistence, failed callback handling, credentials readiness, and order-finalization evidence from Firestore with timestamped reports.
✨ **Exchange Rate Automation Completed**: USD→LBP now supports optional auto-refresh mode with persisted provider metadata, one-click refresh, and manual override fallback.
✨ **Split Payments Completed**: Admin order billing now supports controlled partial payments with remaining-balance guardrails, payment history tracking, and receipt voucher generation for each payment event.
✨ **Refund Management Workflow Completed**: Admin order billing now includes structured refund processing with amount/date/method validation, partial or full refund support, automatic paid-balance recalculation, refunded status visibility, and refund entries in payment history.
✨ **Modern Minimalist Theme Completed**: Added a dedicated storefront template with editorial spacing, neutral palettes, centered layout defaults, and minimalist product/review presentation from Admin Templates through storefront rendering.
✨ **Classic E-Commerce Theme Completed**: Added a conversion-focused classic storefront template with trusted commerce styling, catalog-first layout defaults, and dedicated palette presets available directly in Admin Templates.
✨ **Fashion/Boutique Theme Completed**: Added a boutique-first storefront template with premium editorial styling, fashion-focused palette presets, and high-end layout defaults tuned for visual merchandising.
✨ **Food/Restaurant Theme Completed**: Added a menu-first storefront template with warm culinary palette presets, dining-focused section styling, and reservation-friendly contact defaults.
✨ **Tech/Electronics Theme Completed**: Added a gadget-focused storefront template with high-contrast digital styling, spec-friendly product layout defaults, and modern tech palette presets.

### Latest Features (January 2026)
✨ **Swipe Gesture Navigation**: Navigate back with intuitive right-swipe gesture on mobile
✨ **Item-Level Discounts**: Apply individual discounts to each item in orders
✨ **Production Date Filters**: Filter production batches by date range (from/to)
✨ **Enhanced Menu Navigation**: Unified desktop and mobile menu structure
✨ **Account Statement Integration**: Quick access to financial overview from all menus
✨ **Mobile Quantity Input**: Improved number input behavior for touch devices
✨ **Smart Staff Management**: Automatic cleanup of future salary expenses on termination

## Product Roadmap (Coming Soon)

This section reflects all remaining backlog items and marks each pending capability as Coming Soon.
It is maintained as an end-to-end mirror of the pending feature backlog so no incomplete item is left out.

### Immediate Execution (P0)
- Coming Soon: Validate production payment callback and order finalization end-to-end.
- Coming Soon: Final production smoke test for success/failure payment flows.

### Commerce and Growth Upgrades (P2)
- Coming Soon: Automated order confirmation messages via WhatsApp.
- Coming Soon: Abandoned cart recovery notifications via WhatsApp.
- Coming Soon: Delivery status updates via WhatsApp.
- Coming Soon: Broadcast campaigns to opted-in customers.
- Coming Soon: WhatsApp product catalog sync.
- Coming Soon: Chatbot / auto-reply flows.

### Payments, Billing, and Subscription Expansion (P2)
- Coming Soon: Payment retry for failed transactions.
- Coming Soon: Subscription recurring payments completion.
- Coming Soon: Payment reminder emails.
- Coming Soon: Payment receipts (email/SMS).
- Coming Soon: Subscription engine completion.
- Coming Soon: Customer subscription portal.
- Coming Soon: Admin subscription management completion.

### Storefront and Theme Expansion (P3)
- Coming Soon: Email template controls for notifications.

### Customer and Order Experience (P3)
- Coming Soon: Related products suggestions.
- Coming Soon: Recently viewed products.
- Coming Soon: Back-in-stock notifications.
- Coming Soon: Gift cards.
- Coming Soon: Expanded discount codes management.
- Coming Soon: Abandoned cart recovery (email/web).
- Coming Soon: Email marketing integrations (Mailchimp, etc.).
- Coming Soon: Shipping rate calculation enhancements.
- Coming Soon: Order notes and internal comments.

### Analytics and Reporting Expansion (P3)
- Coming Soon: Customer behavior tracking.
- Coming Soon: Traffic source analytics.
- Coming Soon: Conversion funnel visualization.
- Coming Soon: Custom date-range reports.
- Coming Soon: Export reports to PDF/Excel completion.

### Notification Infrastructure Expansion (P3)
- Coming Soon: SMS notification channel.
- Coming Soon: Full WhatsApp Business API workflow.

### Localization and Mobile Platform (P4)
- Coming Soon: English localization package completion.
- Coming Soon: Arabic RTL completion.
- Coming Soon: French localization package.
- Coming Soon: Language switcher.
- Coming Soon: Currency by location.
- Coming Soon: Date/time formatting by locale.
- Coming Soon: React Native iOS app.
- Coming Soon: React Native Android app.
- Coming Soon: Store owner dashboard app.
- Coming Soon: Customer shopping app.
- Coming Soon: Mobile push notifications.
- Coming Soon: Offline mode.
- Coming Soon: Barcode scanner for inventory.

### Legacy Pending QA and Triage
- Coming Soon: Complete Production dialog: open/action/state/error/success behavior checks.
- Coming Soon: Verify stock movement and status updates for production completion.
- Coming Soon: Verify Receive Items flow updates raw material stock and PO status.
- Coming Soon: Fix filtered totals in sales/revenue views.
- Coming Soon: Fix net amount print calculation issues.
- Coming Soon: Validate decimal input behavior and validation edge cases.
- Coming Soon: Review and fix revenue calculation logic for all order statuses.
- Coming Soon: Add recipe edit impact dialog (new production vs update existing inventory).
- Coming Soon: Add order search UX (ID/customer/product + clear search).
- Coming Soon: Add low stock push trigger in `checkExpiringStock`.
- Coming Soon: Verify mobile upload storage rules.
- Coming Soon: Verify Firestore `products` write rules for store owner mobile flow.
- Coming Soon: Approve production-only reconciliation implementation.
- Coming Soon: Approve no-apply current order-based dry-run result.

## Technology Stack
- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom components
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **State Management**: React Context API
- **UI Components**: Radix UI primitives
- **Build Tool**: Vite for fast development and optimized production builds

## Perfect For
- 🏪 Retail Stores
- 🏭 Manufacturing Businesses
- 📦 Wholesale Distributors
- 🍽️ Restaurants & Cafes
- 🛒 E-commerce Operations
- 🏢 Small to Medium Enterprises

## Getting Started
1. Visit [https://market-flow-7b074.web.app](https://market-flow-7b074.web.app)
2. Sign up with your business details
3. Configure your inventory categories and products
4. Start managing sales and tracking inventory in real-time

## Support & Contact
For inquiries, support, or custom implementations, please contact the development team.

---

**Market Flow** - Streamline Your Business, Maximize Your Growth 🚀
