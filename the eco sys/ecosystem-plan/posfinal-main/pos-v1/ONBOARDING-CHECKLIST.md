# 📋 Onboarding Checklist for New AI Contributors

**When starting a NEW conversation about this project, read these files IN ORDER:**

---

## ✅ Required Reading (Must Read)

### 1. **NEW-CONTRIBUTOR-GUIDE.md** ⭐ START HERE
   - **Why:** Complete overview of project, recent changes, and essential context
   - **What you'll learn:** 
     - Project tech stack and architecture
     - Recent major features (Jan 2026)
     - Common issues and solutions
     - Development setup
     - Testing workflow
   - **Read time:** 10 minutes

### 2. **LATEST-CHANGES.md** ⭐ READ SECOND
   - **Why:** Quick reference for most recent changes
   - **What you'll learn:**
     - What was added in last update
     - Bugs that were fixed
     - UI changes
     - Testing checklist
   - **Read time:** 5 minutes

### 3. **IMPLEMENTATION-STATUS.md** ⭐ READ THIRD
   - **Why:** Current status of all features
   - **What you'll learn:**
     - What's complete vs pending
     - Detailed feature documentation
     - Database schema
     - Production build status
   - **Read time:** 8 minutes

### 4. **README.md**
   - **Why:** Full project documentation
   - **What you'll learn:**
     - Complete feature list
     - Project structure
     - System requirements
     - Quick start commands
   - **Read time:** 15 minutes

---

## 🔍 Conditional Reading (Based on Task)

### If Working on Payments/Finance:
- **PARTIAL-PAYMENT-IMPLEMENTATION.md**
  - Complete technical documentation
  - Database schema for payments
  - Step-by-step implementation

### If Working on Staff Features:
- **STAFF_BALANCE_IMPLEMENTATION.md**
  - Staff management system
  - Payroll processing
  - Attendance tracking details

### If Working on Inventory/Products:
- **BARCODE-REFERENCE.md**
  - Product management
  - Barcode system
  - Inventory tracking

### If Working on Desktop/Electron Features:
- **ELECTRON-GUIDE.md**
  - Electron-specific implementation
  - IPC communication
  - Print system
  - Window management

### If Building/Deploying:
- **DEPLOYMENT-v1.0.0.md**
  - Build process
  - Installer creation
  - Distribution steps

### If Testing:
- **TESTING-GUIDE.md**
  - Test procedures
  - Quality assurance
  - Bug reporting

---

## 📝 Quick Summary for AI Assistants

### Essential Context to Know:

**Tech Stack:**
- Electron 28.3.3 (Desktop app for Windows)
- SQL.js (SQLite in WebAssembly)
- Vanilla JavaScript ES6+
- No frameworks (React, Vue, etc.)

**Recent Changes (Jan 2026):**
1. Partial payment system (down payments, installments)
2. Staff attendance correction (edit/delete last record)
3. Sales reports with tax/discount display

**Key Files:**
- `js/payment.js` - Payment processing
- `js/partial-payments.js` - Partial payment management
- `js/staff-management.js` - Staff features
- `js/reports.js` - Reporting
- `js/db-sql.js` - Database operations
- `migrations/019-partial-payments.sql` - Latest migration

**Database Location:**
- Production: `C:\AynBeirutPOS-Data\pos-database.sqlite`
- Backups: `C:\AynBeirutPOS-Backups\`

**Project Root:**
- `c:\Users\Alaa\Documents\githup\pos\posfinal\pos-v1\`

**Common Issues:**
- Use `runExec()` with `await` for database operations
- Query uses `attendanceDate` not `timestamp` in staff_attendance table
- Use data attributes not inline onclick parameters
- Electron doesn't support prompt() - use modals
- Always check `remainingBalance > 0` for partial payments

**Latest Commit:**
- Hash: 3aa2f1cc0
- Date: January 31, 2026
- Message: "Add partial payments, staff attendance correction, and sales report enhancements"

---

## 🎯 Quick Start Commands

```powershell
# Navigate to project
cd c:\Users\Alaa\Documents\githup\pos\posfinal\pos-v1

# Install dependencies (if needed)
npm install

# Run app
npm start

# Build installer
npm run dist

# Git status
git status

# Commit changes
git add -A
git commit -m "Your message"
git push origin main
```

---

## ✅ Verification Checklist

Before starting work, verify you understand:
- [ ] Tech stack (Electron + SQL.js)
- [ ] Recent changes (partial payments, attendance correction)
- [ ] Key file locations (js/, migrations/)
- [ ] Database structure (sales, partial_payments, staff_attendance tables)
- [ ] Common issues and solutions
- [ ] Development workflow (npm start, npm run dist)
- [ ] Git workflow (commit hash 3aa2f1cc0)

---

## 🚨 Important Notes

1. **Always read console logs** - Extensive debugging in place
2. **Test in Electron** - Browser behavior differs from desktop
3. **Check database schema** - Don't assume column names
4. **Use modals not prompts** - Electron compatibility
5. **Validate datetime inputs** - Check-out > check-in
6. **Query with filters** - remainingBalance > 0 for partial payments
7. **Refresh multiple views** - Call all relevant loaders after changes

---

## 📞 Support

- **GitHub Repo:** AynBeirut/posfinal
- **Branch:** main
- **Issues:** https://github.com/AynBeirut/posfinal/issues

---

**After reading these files, you'll have complete context to continue development!** 🚀
