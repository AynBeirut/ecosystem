# Conversation Log

## 2026-06-18 Importer Reliability

Problem: CSV imports for clients, suppliers, and products can reject valid rows with `Missing required 'name'`, especially when files come from Excel or use header variants.

Method:
- Audit `src/lib/csvImport.ts` and `src/components/DataImportDialog.tsx`.
- Fix CSV parsing for UTF-8 BOM, quoted fields, comma and semicolon delimiters, Excel `sep=` preambles, and empty rows.
- Add automatic and adjustable source-column to destination-field mapping.
- Add validation for required fields, invalid email/date values, and duplicates with exact source-column references.
- Add sample CSV fixtures and tests for clients, suppliers, and products.

Expected Results:
- Excel and Google Sheets CSV exports import without false missing-name failures.
- Header mismatches show a mapping screen instead of rejecting every row.
- Import preview clearly reports valid and invalid rows before writing data.

Next Steps:
- Completed parser, mapping, preview UI, validation, fixtures, and verification commands.

Results:
- Root cause confirmed: comma-only parsing and exact-header lookup failed semicolon/Excel/header-variant files, causing every row to miss the `name` field.
- Added source-aware parsing and mapping in `src/lib/csvImport.ts`.
- Added adjustable mapping preview in `src/components/DataImportDialog.tsx`.
- Added real sample fixtures under `src/lib/__fixtures__`.
- `npm test` passed: 6 importer tests.
- `npm run build` passed.
- `npm run lint` still fails on existing app-wide lint debt outside the changed importer files.

Remaining Limitations:
- CSV import is supported; native `.xlsx` parsing is not included.
- Current clients, suppliers, and products import schemas do not include a date destination field, but the importer now has shared date validation support for date-capable fields.

## 2026-06-18 Stabilization And SIM Migration

Problem: The app must replace Simple Invoice Manager before the subscription expires. Pending blockers are Google OAuth 404s, direct URL refresh 404s, SIM backup migration, and making `anwar@aynbeirut.com` Premium Plan by authorized override.

Method:
- Replace Lovable-hosted Google OAuth broker usage with Supabase native OAuth for self-hosted deployment.
- Add Apache/Webuzo SPA fallback so direct routes like `/invoices` serve the React app.
- Keep the completed CSV importer fixes as regression-tested work.
- Parse the SIM backup at `backup invoice manger/Backup_17Jun2026_0807.sim`.
- Add a migration preview/import path for clients, products/services, invoices, and receipts/payments.
- Keep invoice calculations, inventory calculations, payment verification, organization architecture, and existing working CRUD unchanged.

Backup Findings:
- Format: JSON with top-level `OtherData` and `InvoiceTBLs`.
- Clients: 85.
- Products/services: 276.
- Invoices: 15.
- Invoice line items: 42.
- Invoice payments: 5.
- Receipt rows: 6.

Next Steps:
- Completed OAuth/routing fixes.
- Completed SIM parser, preview, import UI, and sanitized tests.
- Completed app-level Premium override for `anwar@aynbeirut.com`.

Results:
- Google OAuth now uses Supabase native OAuth with `/auth/callback`; it no longer depends on Lovable `/~oauth/initiate`.
- Apache/Webuzo route refresh support added through `public/.htaccess`; build output includes `dist/.htaccess`.
- SIM migration UI added in Settings. It imports clients, products/services, invoices, and receipts/payments into the active organization.
- Historical invoice import bypasses normal invoice creation to avoid replaying stock deductions, document limits, and calculation side effects.
- `anwar@aynbeirut.com` receives app-level Premium Plan behavior through a narrow override; payment verification flow remains unchanged.
- `npm test` passed: 8 tests across CSV and SIM import.
- `npm run build` passed.
- `npm run lint` still fails on pre-existing app-wide lint debt, not in the new SIM/OAuth files.

Remaining:
- Real production data import requires logging into the app as `anwar@aynbeirut.com`, opening Settings > Data, selecting the SIM backup, reviewing the preview, and clicking import. No authenticated production session/service-role credential was available in this workspace for a direct terminal-side data write.
- Supabase Auth dashboard must allow redirect URL `https://<production-domain>/auth/callback` for Google OAuth.
