# Product modules — Travel Agency (draft scope)

## 1. API system integration

- Unified **API gateway** (auth, rate limits, audit, webhooks).
- **Supplier adapters**: flights, hotels, packages, transfers, insurance (prioritize per client list).
- **Rate & markup engine**: dynamic markup, currency, agent/branch overrides.
- **Sync jobs**: availability, fare rules, cancellation policies; idempotent booking refs.
- **Sandbox + contract tests** per supplier.

## 2. Workflow & CRM (internal operations)

- **Accounts**: agencies, branches, agents, roles/permissions.
- **Contacts & leads**: source, stage, assignment, follow-up tasks.
- **Pipelines**: inquiry → quote → negotiation → won/lost.
- **Tasks & SLAs**: reminders, handoffs, approval chains (discount, override fare).
- **Activity timeline**: calls, emails, notes, linked proposals and bookings.
- **Reporting**: agent productivity, conversion, margin by route/supplier.

## 3. Proposals & quotation formation

- **Quote builder**: day-by-day itinerary, inclusions/exclusions, optional upsells.
- **Pricing**: pull from integrated rates; show **live margin**; version history.
- **Outputs**: shareable link + PDF; branding per agency.
- **Engagement** (phase 2+): open/section analytics if we own the viewer.
- **Acceptance**: e-sign or one-click accept → deposit invoice → booking hold.
- **Templates**: reusable blocks per destination/product type.

## Cross-cutting

- Multi-language / multi-currency display (customer-facing).
- Audit trail for finance and disputes.
- No opaque IDs in customer PDFs/links (human refs: `QT-2026-10-01-001`).

## Open questions (see `backlog.md`)

- Build custom vs white-label/partner (Iween mid-office, TravelBoost CRM, hybrid).
- First market: Lebanon/GCC/EU — drives payment and supplier set.
- Grabio reuse: invoice mobile, CRM patterns, Firebase vs separate tenant.
