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

## Recent Updates

### Recently Completed Platform Features (April 2026)
✨ **Storefront Templates Enhancements**: Template preview before apply, more custom color controls, and extended banner customization.
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
✨ **Exchange Rate Automation Completed**: USD→LBP now supports optional auto-refresh mode with persisted provider metadata, one-click refresh, and manual override fallback.
✨ **Split Payments Completed**: Admin order billing now supports controlled partial payments with remaining-balance guardrails, payment history tracking, and receipt voucher generation for each payment event.
✨ **Refund Management Workflow Completed**: Admin order billing now includes structured refund processing with amount/date/method validation, partial or full refund support, automatic paid-balance recalculation, refunded status visibility, and refund entries in payment history.
✨ **Modern Minimalist Theme Completed**: Added a dedicated storefront template with editorial spacing, neutral palettes, centered layout defaults, and minimalist product/review presentation from Admin Templates through storefront rendering.

### Latest Features (January 2026)
✨ **Swipe Gesture Navigation**: Navigate back with intuitive right-swipe gesture on mobile
✨ **Item-Level Discounts**: Apply individual discounts to each item in orders
✨ **Production Date Filters**: Filter production batches by date range (from/to)
✨ **Enhanced Menu Navigation**: Unified desktop and mobile menu structure
✨ **Account Statement Integration**: Quick access to financial overview from all menus
✨ **Mobile Quantity Input**: Improved number input behavior for touch devices
✨ **Smart Staff Management**: Automatic cleanup of future salary expenses on termination

## Planned Feature Roadmap (Merged Feature List)

This section merges the future feature list into the product description so there is one main product and features reference.

### Commerce and Growth
- WhatsApp Business API automation (order confirmations, abandoned cart recovery, delivery updates, chatbot flows)
- Domain and white-label growth (custom domains, SSL provisioning, DNS wizard, domain verification)

### Payments and Subscriptions
- Additional gateways completed (Square, OMT, BOB Finance)
- Billing enhancements (live currency rates, split payments, refunds, retry, reminders, receipts)
- Subscription platform completion (engine completion, customer portal, admin management)

### Storefront and Operations
- New storefront themes (modern minimalist completed; remaining: classic, fashion, food, tech)
- Branding controls expansion (logo positioning, notification email template controls)
- Customer experience upgrades (related products, recently viewed, back-in-stock, gift cards, marketing integrations)
- Order operations enhancements (shipping calculation refinements, order notes and internal comments)

### Analytics and Notifications
- Analytics depth upgrades (behavior, traffic sources, funnels, custom ranges, PDF and Excel export)
- Notification channels completion (SMS and full WhatsApp Business API workflow)

### Localization and Mobile
- Language packs and locale behavior (English, Arabic RTL, French, language switcher, locale-based currency and date formatting)
- Mobile platform apps (iOS, Android, owner dashboard, customer app, offline mode, barcode scanner)

### Security and Compliance
- 2FA and admin hardening (MFA, enrollment flow, authenticator QR, optional IP allowlist)
- GDPR flows (data export, delete workflow, privacy tooling)

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
