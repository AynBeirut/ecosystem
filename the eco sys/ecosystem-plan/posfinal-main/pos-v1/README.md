# Ayn Beirut POS v1 - Technical Handoff

This is the active production POS application for Ayn Beirut.

It is an offline-first Electron + browser/PWA POS using SQL.js. The next developer reviewing this code for online ecosystem integration should start here, not from older repository notes.

## Current State

- App status: live, actively modified, production build available
- Current desktop build version: `1.0.2`
- Current Windows installer: [dist/Ayn Beirut POS-1.0.2-win.exe](dist/Ayn%20Beirut%20POS-1.0.2-win.exe)
- Main app entry: [index.html](index.html)
- Electron main process: [electron-main.js](electron-main.js)
- Main database module: [js/db-sql.js](js/db-sql.js)
- Current sync entry point: [js/sync-manager.js](js/sync-manager.js)

## Runtime Modes

### Electron Desktop

- Starts with `npm start`
- Uses [electron-main.js](electron-main.js) and [preload.js](preload.js)
- Loads [index.html](index.html) directly inside Electron
- Production build uses `electron-builder`

### Browser / PWA Mode

- Main URL: `http://localhost:8070/index.html`
- Used during browser-mode testing and troubleshooting
- `default-data.sqlite` is auto-seeded when storage is empty
- No-cache headers were used during recent debugging to avoid stale JS

## Build / Release

Run from [pos-v1](.):

```powershell
npm start
npm run build -- --publish never
```

Current artifact naming comes from [package.json](package.json):

- `Ayn Beirut POS-1.0.0-win.exe`
- `Ayn Beirut POS-1.0.1-win.exe`
- `Ayn Beirut POS-1.0.2-win.exe`

This versioned naming is intentional so new installers do not overwrite older production files.

## Architecture Summary

### Frontend

- Vanilla JavaScript modules in [js](js)
- HTML in [index.html](index.html)
- CSS in [css/styles.css](css/styles.css), [css/themes.css](css/themes.css), [css/ui-ux-standards.css](css/ui-ux-standards.css)

### Database Engine

- SQL.js (SQLite compiled to WebAssembly)
- WASM files in [lib/sql-wasm.js](lib/sql-wasm.js) and [lib/sql-wasm.wasm](lib/sql-wasm.wasm)
- Global DB bootstrap and save/load flow in [js/db-sql.js](js/db-sql.js)

### Storage Model

- Browser primary persistence: IndexedDB Blob storage
- Browser IndexedDB database name: `AynBeirutPOS_BlobStorage`
- Browser Blob key: `sqliteDb`
- Browser fallback path still exists in localStorage under `AynBeirutPOS_sqljs`
- Electron persistence goes through [electron-main.js](electron-main.js) IPC handlers and preload bridge

### Sync Layer

- Current sync code lives in [js/sync-manager.js](js/sync-manager.js)
- It is VPS-oriented and configuration-driven, not yet a full ecosystem integration layer
- Current config source is `app_settings`:
  - `vps_endpoint`
  - `api_key`
  - `branch_id`
  - `app_mode`
  - `sync_interval_minutes`
  - `sync_retry_count`

## Main Functional Areas

- Product management
- Categories
- Sales / checkout
- Receipts
- Customer management
- Inventory tracking
- Purchases and supplier flows
- Bill payments
- Unpaid orders
- Partial payments
- Refunds
- Cash drawer
- Staff / attendance / payroll
- Reports
- Admin dashboard
- Customer display
- Reservations / events / venues

## Recent Important Changes

### 1. Sales Reports Discount Fix

Files:

- [js/reports.js](js/reports.js)

What changed:

- Report revenue logic now correctly uses net revenue after discount
- Discount data in `totals.discount` and `totals.discountPercent` is surfaced correctly in reports and recent sales detail rows

Why it matters for integration:

- Remote analytics must not assume gross total is final revenue
- Online sync/export should preserve `totals` JSON fields exactly

### 2. Browser-Mode Data Auto-Seeding

Files:

- [js/db-sql.js](js/db-sql.js)
- [default-data.sqlite](default-data.sqlite)

What changed:

- Empty storage silently loads `default-data.sqlite`
- This replaced manual recovery prompts during browser-mode testing

Why it matters for integration:

- Fresh browser sessions may start from seeded local data
- External sync/bootstrap logic must distinguish seeded data from user-created data if that matters to onboarding

### 3. Browser Storage Fixes

Files:

- [js/storage-manager.js](js/storage-manager.js)
- [js/db-sql.js](js/db-sql.js)

What changed:

- Browser mode now defaults to IndexedDB Blob storage instead of relying on File System API
- This avoided quota failures from large base64 localStorage payloads

Why it matters for integration:

- Browser-mode persistence is not a normal server database
- Any online connector must explicitly decide when local browser state becomes authoritative

### 4. Reservations / Events / Venues

Files:

- [js/reservations.js](js/reservations.js)
- [index.html](index.html)

What changed:

- Added reservations/events feature
- Added venue management
- Added calendar view for reservations
- Reservations can be scheduled months ahead
- Reservation/venue actions were added to the UI and tested live

Data model details:

- Reservations are stored in `sales`, not a separate reservation table
- Reservation marker is in `sales.notes` JSON: `"_res": 1`
- Additional reservation metadata in `sales.notes` includes:
  - `eventName`
  - `eventDate`
  - `venueId`
  - `venueName`
  - `userNotes`
  - `_closedAt`
- Open/closed state is driven by `paymentStatus` (`partial` / `paid`)
- Remaining balance is stored in `remainingBalance`
- Deposit is stored in `downPayment`
- Close-event payments are inserted into `partial_payments`
- New `venues` table is created by the reservations module when needed

Important schema note:

- The `sales` table does **not** have a `paidDate` column
- That bug was removed; close date now lives in `notes._closedAt`

Why it matters for integration:

- Remote systems cannot model reservations only by looking for a dedicated reservation table
- They must parse `sales.notes` JSON and `paymentStatus`

### 5. Admin UI Cleanup

Files:

- [index.html](index.html)

What changed:

- Top burger menu was shortened
- Bills, Purchases, Inventory were moved into Admin Overview
- Admin Dashboard action area now renders in 3 rows:
  - 4 admin buttons
  - 3 admin buttons
  - 3 POS buttons
- A root-cause CSS issue was fixed by overriding the inherited horizontal `.stat-card` layout for the Admin Operations card

Why it matters for integration:

- Mostly UI-only
- Useful for reviewers because the current navigation does not match older screenshots/docs

## Database / Schema Notes

Core tables the next developer will likely need first:

- `products`
- `categories`
- `sales`
- `customers`
- `partial_payments`
- `bill_payments`
- `unpaid_orders`
- `purchases`
- `supplier_payments`
- `staff`
- `attendance`
- `venues`
- `app_settings`

Important `sales` columns referenced in recent work:

- `id`
- `timestamp`
- `date`
- `items`
- `totals`
- `paymentMethod`
- `customerInfo`
- `receiptNumber`
- `cashierName`
- `cashierId`
- `notes`
- `paymentStatus`
- `remainingBalance`
- `downPayment`

Important warning:

- Several business features serialize structured JSON into columns like `items`, `totals`, `customerInfo`, and `notes`
- Any online sync layer must define a stable parse/transform policy for those JSON payloads

## Entry Points Worth Reviewing

### App Startup

- [js/app.js](js/app.js)
- [js/pos-core.js](js/pos-core.js)
- [index.html](index.html)

### Persistence

- [js/db-sql.js](js/db-sql.js)
- [js/storage-manager.js](js/storage-manager.js)
- [electron-main.js](electron-main.js)
- [preload.js](preload.js)

### Sync / Online Direction

- [js/sync-manager.js](js/sync-manager.js)
- [js/settings.js](js/settings.js)
- [js/admin-dashboard.js](js/admin-dashboard.js)

### Business Modules

- [js/reports.js](js/reports.js)
- [js/reservations.js](js/reservations.js)
- [js/partial-payments.js](js/partial-payments.js)
- [js/bill-payments.js](js/bill-payments.js)
- [js/purchases-ui.js](js/purchases-ui.js)

## Online Ecosystem Integration Notes

The next developer should decide these upfront before writing sync code:

1. What is the source of truth: local-first with eventual sync, or server-first with offline queue?
2. Which entities stay denormalized as JSON vs. which must be normalized before upload?
3. How are sales, refunds, partial payments, reservations, and venue bookings represented remotely?
4. How is idempotency handled so retried uploads do not duplicate sales or payments?
5. How are branch identity and cashier identity mapped to remote users/locations?
6. What conflict policy applies when local changes happen before remote download completes?

Specific technical caution points:

- Browser-mode seeded data can look like user data if not tagged externally
- `sync-manager.js` is VPS-sync oriented, not a full abstraction layer yet
- Reservation state is derived from `sales` plus `notes` JSON, not a dedicated workflow engine
- Reports depend on net totals after discount, so remote analytics must match that rule

## Recommended First Review Order For The Next Developer

1. [package.json](package.json)
2. [index.html](index.html)
3. [js/db-sql.js](js/db-sql.js)
4. [electron-main.js](electron-main.js)
5. [js/storage-manager.js](js/storage-manager.js)
6. [js/sync-manager.js](js/sync-manager.js)
7. [js/reports.js](js/reports.js)
8. [js/reservations.js](js/reservations.js)

## Last Updated

- Date: 2026-06-30
- Build version: `1.0.2`
- Production artifact confirmed in `dist/`
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  }
];
```

### Common Patterns

**Show Modal**
```javascript
window.showModal = (id) => {
  document.getElementById(id).style.display = 'flex';
};
```

**Close Modal**
```javascript
window.hideModal = (id) => {
  document.getElementById(id).style.display = 'none';
};
```

**Toast Notification**
```javascript
window.showToast('Success message', 'success'); // green
window.showToast('Error message', 'error');     // red
```

## 🐛 Recent Fixes & Known Issues

### Latest Update (Dec 29, 2025)
✅ **Staff Payment Tracking System**
   - Added comprehensive payment history for each staff member
   - Total Owed column in staff list with real-time calculation
   - Payment statement modal with filters (date range, status, type)
   - Inline payment actions (Approve/Mark Paid) with auto-refresh
   - Export statements to PDF/Excel/CSV with full transaction details
   - Integration of formal payroll + unpaid attendance earnings
   - Running balance calculation across all transactions
   - Fixed SQL queries to use explicit column lists
   - Fixed export data formats to match export-utils.js signatures
   - Files: index.html, staff-management.js, payroll.js

### Fixed (Dec 2025)
✅ **Menu buttons not responding** (5+ hour debug)
   - Issue: Scripts loaded after user clicks due to dynamic loading
   - Fix: Added 9 script tags directly to HTML (index.html lines 3111-3129)
   - Commits: 516d0aa70

✅ **Database not loading**
   - Issue: electron-main.js path resolution bug
   - Fix: Added fallback to direct path `C:\AynBeirutPOS-Data\pos-database.sqlite`
   - Commits: 9a77fa361

✅ **Inventory alerts showing wrong stock levels**
   - Issue: Composed products (burgers) showing "Out of Stock" but ingredients available
   - Fix: Added `getActualStock()` helper in 3 locations (inventory.js)
   - Impact: Stats, alerts, badge now accurate
   - Commits: 9a77fa361

✅ **Data loss (16 products, 107 sales)**
   - Issue: Migration 17 failed, restored from empty backup
   - Fix: Restored from `backup-2025-12-28-172657.sqlite` (1400 KB)
   - Prevention: Auto-backup every 30 seconds

### Known Limitations
⚠️ **Windows Only**: Installer built for Windows x64 (macOS/Linux require separate builds)
⚠️ **Single Instance**: Cannot run multiple POS terminals from same database file
⚠️ **Backup Path**: Hardcoded to D: drive (may need adjustment for different setups)

## 📦 Build & Deployment

### Local Development
```powershell
# Install dependencies
npm install

# Run in development mode (hot reload)
npm start

# Clear previous builds
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
```

### Production Build
```powershell
# Build Windows installer (NSIS)
npm run build

# Output
dist/Ayn Beirut POS-1.0.0-win.exe  # 77.9 MB installer

# Install for users
# Double-click installer
# Installs to: C:\Users\{User}\AppData\Local\Programs\ayn-beirut-pos
# Creates desktop shortcut
```

### Package.json Build Config
```json
{
  "build": {
    "appId": "com.aynbeirut.pos",
    "productName": "Ayn Beirut POS",
    "directories": {
      "output": "dist"
    },
    "files": [
      "**/*",
      "!**/*.md",
      "!test*"
    ],
    "win": {
      "target": "nsis",
      "icon": "icon.png"
    }
  }
}
```

## 🧪 Testing

### Manual Testing Checklist
- [ ] Login with test user (admin / admin123)
- [ ] Add product to cart
- [ ] Process cash payment
- [ ] Print receipt
- [ ] Open burger menu → all 9 buttons work
- [ ] Check inventory alerts (badge shows accurate count)
- [ ] Create purchase order
- [ ] Process refund
- [ ] View sales reports
- [ ] Logout

### Database Testing
```powershell
# Test database integrity
npm run test-db

# View database file size
Get-Item "C:\AynBeirutPOS-Data\pos-database.sqlite" | Format-List

# Check backups
Get-ChildItem "D:\AynBeirutPOS-Backups\" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

## 🚀 Deployment Checklist

**Pre-Release**
- [ ] Run full manual test suite
- [ ] Check database migrations (version 17+)
- [ ] Verify backup system operational
- [ ] Test on clean Windows 10/11 install
- [ ] Clear IndexedDB/localStorage from dev builds
- [ ] Update version in package.json
- [ ] Update README with release notes

## Session Notes - 2026-04-07

- Problem: Client reported that a refund showed in sales history, but report revenue did not reflect the refund correctly.
- Method: Reviewed the refund write path and the reports aggregation logic, then aligned reports with the current refund model and added report-cache invalidation after refund processing.
- What worked: Reports now exclude refund ledger rows from net sales analytics, refresh cached Today/Week results after a refund, fully refunded sales are removed from report counts/lists, the Admin Overview today's-sales card now uses mixed-timestamp net sales instead of the legacy date field, and the refund browser now blocks refund-ledger rows from being refunded again.
- What did not: The prior item-based report logic could not safely use refund rows as normal sales because partial refunds already modify the original sale while also writing a separate refund ledger entry.
- Continue next session: Verify on the client machine that refunding a full sale and refunding part of a sale both update Today/Week revenue, charts, and exports immediately.

**Build**
- [ ] `npm run build`
- [ ] Test installer on target machine
- [ ] Verify database path resolution
- [ ] Check auto-backup creates files
- [ ] Confirm all menu buttons respond

**Post-Deploy**
- [ ] Monitor error logs (js/logger.js)
- [ ] Check disk space usage
- [ ] Verify backup rotation
- [ ] Test composed product stock calculations
- [ ] Validate receipt printing

## 📚 Additional Documentation

- **BARCODE-REFERENCE.md** - Barcode scanner setup & format guide
- **VIRTUAL-KEYBOARD-GUIDE.md** - Touch screen keyboard usage
- **LOGIN-CREDENTIALS.md** - Default users & permissions
- **ICONS-AND-CATEGORIES-GUIDE.md** - UI customization
- **IMPLEMENTATION_SUMMARY.md** - Feature development history
- **FIXES-SUMMARY.md** - Bug fix changelog

## 🤝 Contributing

### Code Style
- **Indentation**: 2 spaces (not tabs)
- **Quotes**: Single quotes for strings
- **Naming**: camelCase for variables, PascalCase for classes
- **Comments**: JSDoc for public functions

### Pull Request Process
1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Commit Message Format
```
Type: Brief description

- Detailed change 1
- Detailed change 2

Fixes: #issue-number
```

**Types**: Fix, Feature, Docs, Style, Refactor, Test, Chore

## 📞 Support & Contact

- **Developer**: Alaa
- **Repository**: AynBeirut/posfinal
- **Issues**: GitHub Issues tab
- **Last Update**: December 28, 2025

## 📜 License

Proprietary - All rights reserved

---

**Built with ❤️ for Ayn Beirut Restaurant**  
*Production-ready since December 2025*

Edit `js/pos-core.js`:

```javascript
const TAX_RATE = 0.11; // 11%
```

### Update Branding

Edit `css/styles.css` - modify CSS variables in `:root`

## Performance

- **Load Time**: <2 seconds (after first load)
- **Search**: <50ms
- **Cart Operations**: Instant
- **Receipt Generation**: <1 second
- **Database Operations**: <100ms

## Offline Capability

- All assets cached by Service Worker
- IndexedDB stores all sales history
- LocalStorage for cart persistence
- Works 100% without internet after first load
- Installable as PWA (Add to Desktop)

## Future Enhancements

- [ ] Logo upload/customization
- [ ] Product image support
- [ ] Barcode scanner integration
- [ ] Multiple payment methods
- [ ] User authentication
- [ ] Sales reports/analytics
- [ ] Inventory management
- [ ] Multi-location support
- [ ] Receipt printer driver integration
- [ ] Export sales data (CSV/JSON)

## Lessons Learned (from 3 previous attempts)

1. ❌ **Odoo (879MB)** - Too large, broken dependencies, 5-minute startup
2. ❌ **Electron wrapper** - Blank page issues, complexity overhead
3. ❌ **Bootstrap dependency** - Missing files caused complete failure
4. ✅ **Vanilla JS MVP** - Simple, fast, works offline, no dependencies

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

## License

Built by **Ayn Beirut** - Tech made in Beirut, deployed worldwide

---

**Version**: 1.0.0 (MVP)  
**Last Updated**: December 2025
