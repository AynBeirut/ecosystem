# AYN BEIRUT POS v1.0 - Production Ready

**Modern, full-featured Point of Sale system built with Electron + SQL.js**  
Offline-first architecture with enterprise-grade features for restaurants and retail businesses.

## 🚀 Current Status

✅ **Production Ready** - Deployed and tested with real business operations  
✅ **16 Products** - Live inventory with 107+ completed sales  
✅ **Setup.exe** - 77.9 MB Windows installer ready for distribution  
✅ **All Features Working** - Menu buttons, inventory, composed products, stock alerts  
✅ **Database Backup System** - Automatic backups every 30 seconds to D:\ drive

## ✨ Key Features

### Core POS Functions
- ✅ **Product Management** - Full CRUD operations with categories and icons
- ✅ **Composed Products** - Recipe system with ingredient tracking and auto-stock calculation
- ✅ **Real-time Cart** - Instant updates with quantity adjustments and totals
- ✅ **Multiple Payment Methods** - Cash, card, on account with customer tracking
- ✅ **Receipt Printing** - Professional branded receipts with company details
- ✅ **Customer Management** - Contact info, payment terms, visit tracking
- ✅ **Sales History** - Complete transaction log with filtering and export

### Advanced Features
- ✅ **Inventory Management** - Stock tracking, low stock alerts, composed product calculations
- ✅ **Purchase Orders** - Supplier management and inventory receiving
- ✅ **Bill Payments** - Customer account management and payment tracking
- ✅ **Unpaid Orders** - Hold and retrieve orders for later completion
- ✅ **Partial Payments** - Accept down payments, track remaining balances, installment processing
- ✅ **Refunds System** - Full and partial refunds with inventory restoration
- ✅ **Cash Drawer** - Opening/closing balance tracking with shift reports
- ✅ **Staff Management** - Attendance tracking, payroll, and payment history with statement exports
- ✅ **Staff Attendance Correction** - Edit/delete most recent attendance record (fraud prevention)
- ✅ **Staff Payment Tracking** - Complete payment history with running balance, inline actions, PDF/Excel/CSV exports
- ✅ **Sales Reports with Tax/Discount** - Detailed sales analysis with tax and discount breakdown
- ✅ **Customer Display** - Secondary screen for customer-facing information
- ✅ **Virtual Keyboard** - Touch-friendly input for all fields

### Technical Features
- ✅ **Offline First** - SQL.js database with file system persistence
- ✅ **Auto Backup** - Every 30 seconds to D:\AynBeirutPOS-Backups\
- ✅ **Database Migrations** - Schema versioning with automatic upgrades
- ✅ **Disaster Recovery** - Built-in backup/restore from admin panel
- ✅ **Multi-user Support** - Admin, Manager, Cashier roles with permissions
- ✅ **Dark/Light Themes** - User preference with brand colors

## 🛠️ Tech Stack

- **Runtime**: Electron 28.3.3 (Node.js + Chromium)
- **Database**: SQL.js (SQLite compiled to WebAssembly)
- **Frontend**: Vanilla JavaScript ES6+, HTML5, CSS3
- **Storage**: File system (C:\AynBeirutPOS-Data\pos-database.sqlite)
- **Backup**: Automatic to D:\AynBeirutPOS-Backups\ (30-second intervals)
- **Build**: electron-builder for Windows installer
- **Size**: 77.9 MB installer, ~200 MB installed

## 📋 System Requirements

- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Storage**: 500 MB free space (1 GB with backups)
- **Display**: 1280x720 minimum resolution
- **Optional**: Secondary display for customer screen

## 🚦 Quick Start (Development)

### Prerequisites
```powershell
# Node.js 18+ required
node --version

# Install dependencies
npm install
```

### Run Development Mode
```powershell
# Method 1: NPM script
npm start

# Method 2: Batch file
.\START-POS.bat

# Method 3: PowerShell
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
npm start
```

### Build Production Installer
```powershell
# Clean build
npm run build

# Output: dist/Ayn Beirut POS-1.0.0-win.exe
```

## 📂 Project Structure

```
pos-v1/
├── index.html                 # Main application entry point
├── login.html                 # Authentication page
├── electron-main.js           # Electron main process (IPC, windows, file system)
├── package.json               # Dependencies and build config
├── manifest.json              # PWA configuration
├── sw.js                      # Service Worker (offline support)
│
├── css/
│   ├── styles.css             # Main styles with brand colors
│   ├── themes.css             # Dark/light theme definitions
│   └── ui-ux-standards.css    # Consistent UI patterns
│
├── js/
│   ├── app.js                 # Application initialization & auth
│   ├── pos-core.js            # Core POS logic (cart, checkout)
│   ├── product-management.js  # Product CRUD & search
│   ├── payment.js             # Payment processing
│   ├── receipt.js             # Receipt generation & printing
│   ├── customers.js           # Customer management
│   ├── inventory.js           # Inventory tracking & alerts
│   ├── purchases-ui.js        # Purchase orders
│   ├── bill-payments.js       # Customer account payments
│   ├── unpaid-orders.js       # Order hold/retrieve
│   ├── refunds.js             # Refund processing
│   ├── cash-drawer.js         # Cash management
│   ├── staff-management.js    # Staff attendance & payroll
│   ├── admin-dashboard.js     # Admin panel & reports
│   ├── customer-display.js    # Secondary display control
│   │
│   ├── db-sql.js              # SQL.js database wrapper
│   ├── storage-manager.js     # File system & storage abstraction
│   ├── migrate-to-sql.js      # Database migration engine
│   ├── migrations-bundle.js   # All migration definitions
│   ├── disaster-recovery.js   # Backup/restore utilities
│   │
│   ├── auth.js                # User authentication & permissions
│   ├── categories.js          # Category management
│   ├── phonebook.js           # Country code & phone utilities
│   ├── virtual-keyboard.js    # Touch keyboard for inputs
│   ├── theme-switcher.js      # Dark/light mode toggle
│   ├── dropdown-manager.js    # Dropdown menu controller
│   ├── page-navigation.js     # SPA routing
│   ├── settings.js            # App configuration
│   ├── sync-manager.js        # Future cloud sync
│   ├── error-boundary.js      # Global error handling
│   ├── logger.js              # Logging system
│   └── anti-blocking.js       # Modal & UI utilities
│
└── lib/
    ├── sql-wasm.js            # SQL.js library
    └── sql-wasm.wasm          # SQLite WebAssembly binary
```

## 🏗️ Architecture Overview

### Database System
- **Engine**: SQL.js (SQLite in WebAssembly)
- **File**: `C:\AynBeirutPOS-Data\pos-database.sqlite`
- **Size**: ~1.4 MB (16 products, 107+ sales)
- **Migrations**: 17+ migrations (migrations-bundle.js)
- **Backup**: Auto-backup every 30 seconds to `D:\AynBeirutPOS-Backups\`

### Schema Highlights
```sql
-- Core Tables
products          # Product catalog with barcode & pricing
categories        # Product categorization
sales             # Transaction records
cart_items        # Current sale items
customers         # Customer accounts & credit
inventory         # Stock tracking & raw materials
composed_products # Recipe-based products (burger = bun + patty + etc.)

-- Advanced Tables
purchases         # Purchase orders & supplier invoices
expenses          # Operating expenses
staff             # Employee management & payroll
cash_drawer       # Cash-in/cash-out tracking
refunds           # Product returns & refunds
bill_payments     # Customer account payments
unpaid_orders     # Hold/retrieve incomplete orders
```

### Composed Products System
**Key Feature**: Dynamic stock calculation from raw materials

```javascript
// Example: Burger stock calculated from ingredients
// inventory.js lines 74-102 (calculateInventoryStats)
// inventory.js lines 204-256 (renderLowStockAlerts)
// inventory.js lines 593-610 (checkLowStock)

const getActualStock = (product) => {
  if (product.is_composed && window.calculateComposedProductStock) {
    return window.calculateComposedProductStock(product.id);
  }
  return product.stock || 0;
};
```

### Electron IPC Communication
- **Main Process**: electron-main.js (file system, database loading)
- **Renderer Process**: All js/*.js files (UI logic)
- **IPC Channels**: `load-database`, `save-database`, `auto-backup`

### Script Loading Order (Critical)
```html
<!-- index.html lines 3111-3129 -->
<!-- Must load BEFORE pos-core.js to register menu handlers -->
<script src="js/inventory.js?v=16"></script>
<script src="js/purchases-ui.js?v=5"></script>
<script src="js/unpaid-orders.js?v=6"></script>
<script src="js/refunds.js?v=4"></script>
<script src="js/cash-drawer.js?v=4"></script>
<script src="js/staff-management.js?v=6"></script>
<script src="js/admin-dashboard.js?v=5"></script>
<script src="js/customer-display.js?v=4"></script>
<script src="js/bill-payments.js?v=5"></script>
<script src="js/pos-core.js?v=69"></script>  <!-- Core last -->
```

## 🔧 Development Guide

### Database Access
```javascript
// Global database object (db-sql.js)
window.db = {
  exec: (sql, params) => { /* Returns array of results */ },
  run: (sql, params) => { /* Returns { lastInsertRowid, changes } */ },
  export: () => { /* Returns Uint8Array for saving */ },
  close: () => { /* Cleanup */ }
};

// Wait for database ready
if (!db && window.dbReady) {
  await window.dbReady;
}

// Execute query
const results = db.exec('SELECT * FROM products WHERE id = ?', [productId]);
```

### Adding New Features
1. **Add UI**: Update index.html with section
2. **Add Script**: Create js/feature-name.js
3. **Load Script**: Add `<script src="js/feature-name.js?v=1"></script>` BEFORE pos-core.js
4. **Register Handler**: Use `window.showFeature = () => {}` pattern
5. **Add Menu Button**: Update burger menu dropdown in index.html

### Migration System
```javascript
// migrations-bundle.js
window.migrations = [
  {
    version: 18,
    name: 'add_new_feature',
    sql: `
      CREATE TABLE IF NOT EXISTS new_feature (
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
