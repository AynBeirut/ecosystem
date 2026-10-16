# Fine-Dining Daily Tasks Planning — 2026-09-27

## Scope

This is a planning handoff only. Do not execute, deploy, push, sideload, or write production data from this chat.

Berenjak / Michelin-star restaurant materials are discovery input and a first test-client reference only. The product work must be white-label Grabio and usable by any fine-dining brand.

## Source Folder

Folder path includes a trailing space:

`/home/anwar/Documents/grabio space/the eco sys/finedinnig `

Source files reviewed or detected:

- `Allergy matrix Berenjak UAE .docx`
- `allergy matrix updated chef Ponzo.pdf`
- `Berenjak Al Wasl Seat Numbers.pdf`
- `Berenjak Brand Book.pdf`
- `Berenjak_Brand_Book AUGUST 26.pdf`
- `Berenjak Dubai Beverage Specs - 06.05.2024.xlsx`
- `Berenjak ME. Beverages specs. 2026 .xlsx`
- `Berenjak Food & Beverage Bible.pdf`
- `Berenjak_UAE_Food_Bible.pdf`
- `BERENOAK VALUES.pdf`
- `Copy2-MONTHLY BRIEFING F&B.xlsx`
- `HOW CAN WE DEMONSTRATE OUR VALUES.pdf`
- `Makhsoos.pdf`
- `Noon O Mazeh.pdf`

## Platform Rules

- Tenant binding stays `users.subAccountId` -> that sub-account's `storeId`.
- Never resolve tenants by email-only or unscoped `limit(1)`.
- Access is entitlement AND store toggle AND user/sub-account permission.
- New features are platform defaults or tenant options, not one-store patches.
- Berenjak names, branding, Michelin copy, and proprietary SOP language must not become hardcoded product labels.
- Features must work with or without finance/accounting enabled.

## Finance-Optional Behavior

Daily operations must not require accounting setup.

- Inventory can track item, recipe, stock count, prep quantity, par, and wastage without price/cost.
- Food and beverage specs can exist without COGS.
- Staff tasks, training, values checks, and role readiness can work without payroll.
- Seat/table/service flows can work without sales, GL, or invoice modules.
- When finance is enabled, the same records may connect to costing, purchasing, payroll, COGS, stock valuation, or reports through optional gated extensions.

## First Feature Map

### 1. Allergen Matrix

White-label feature: menu-item allergen matrix with cross-contamination notes, review date, approver/signature, and staff-visible guest warning mode.

Surface: restaurant/menu setup, not Invoice Document setup.

Gate: fine-dining operations entitlement, store toggle for allergen controls, role permission for view/edit/approve.

Finance: none required. Optional link to recipe/inventory ingredients later.

### 2. Food & Beverage Bible

White-label feature: item knowledge base for ingredients, description, meaning/story, buzz words, one-liner, allergens, service notes, and pairing/use context.

Surface: restaurant operations / staff training / menu knowledge.

Gate: fine-dining operations entitlement, store toggle for staff training or menu bible, role permission for view/edit/publish.

Finance: none required. Optional link to recipe costing and stock items later.

### 3. Beverage Specs and Batch Specs

White-label feature: drink recipe/spec cards with glassware, quantities, ingredient lines, garnish, method, storage vessel, par, batch quantity, and service prep.

Surface: operations / bar prep / inventory maturity.

Gate: fine-dining operations entitlement plus optional inventory toggle for stock/prep tracking.

Finance: price/cost optional. Without finance, it tracks prep, par, and method. With finance, it can calculate cost, variance, and purchasing needs.

### 4. Monthly F&B Briefing

White-label feature: daily staff briefing calendar for food item, beverage item, buzz words, one-liners, and training prompts.

Surface: daily ops / staff training.

Gate: fine-dining operations entitlement, store toggle for daily briefings, role permission for manager publish and staff acknowledge.

Finance: none required.

### 5. Seat / Table Number Map

White-label feature: floor-seat map and service-position memory for staff, reservations, table assignment, and guest context.

Surface: reservations / service floor operations.

Gate: reservations or fine-dining operations entitlement, store toggle for floor map, role permission by host/server/manager.

Finance: none required. Optional sales/service reporting later.

### 6. Brand Standards, Values, SOP, Audit

White-label feature: brand standards library, values-to-behavior checklist, opening/audit tasks, market SOP variations, uniform/table setup/job description references.

Surface: staff training / brand standards / operations checklist.

Gate: fine-dining operations entitlement, store toggle for standards library, role permission for owner/manager/staff.

Finance: none required. Optional HR/payroll link later only if enabled.

## Planning TODO Before Execution

1. Anwar names the next feature in one sentence.
2. For that feature, write the execution plan with setup surface, data model, gates, finance-optional behavior, and test steps.
3. Confirm no Berenjak-only labels or store IDs.
4. Execute only in a separate execution chat after Anwar confirms.
5. Builder must document changed files, surface, what was not deployed, and how Anwar should test.
