# Ayn Beirut POS v1.0.0 - Production Release 🚀

**Release Date:** December 15, 2024  
**Platform:** Windows x64  
**Installer Size:** 73 MB

---

## 🎉 What's New

### Enterprise-Grade Database Storage
✅ **Unlimited database size** - No more browser storage limits!
- Automatic migration from LocalStorage to file-based SQLite
- Database location: `D:\AynBeirutPOS-Data\pos-database.sqlite`
- Automatic fallback to C:\ drive if D:\ not available
- Zero data loss during migration

### Automatic Backup System
✅ **Never lose data again!**
- Auto-backup after every save operation (sales, shifts, products)
- 30-day retention policy with minimum 3 backups always kept
- Backup location: `D:\AynBeirutPOS-Backups\` (or C:\ fallback)
- Automatic cleanup of old backups
- Filename format: `backup-YYYY-MM-DD-HHmmss.sqlite`

### Auto-Update System
✅ **Stay up-to-date automatically**
- Checks for updates on app startup
- Downloads updates in background
- Auto-installs when you close the app
- No manual download needed for future updates

### Critical Bug Fixes
✅ **All major issues resolved:**
- Fixed input blocking issue (virtual keyboard conflict)
- Fixed cash drawer "not defined" error  
- Fixed confusing shift status messages
- Improved print error messages
- Fixed login dropdown visibility
- Made all action buttons sticky (no scrolling)

---

## 📦 Installation

### First-Time Installation

1. **Download the installer** (see Assets below)
2. **Run `Ayn Beirut POS-Setup-1.0.0.exe`**
3. Windows may show "Windows protected your PC" warning:
   - Click **"More info"**
   - Click **"Run anyway"**
4. Follow the installation wizard
5. App will create desktop shortcut automatically

### Upgrading from Browser Version

Your existing data will **automatically migrate** on first launch:
- LocalStorage data transfers to file system
- No manual export/import needed
- Original data stays as backup
- Migration confirmed in console (press F12)

---

## 💾 Data Locations

**Database:**
- Primary: `D:\AynBeirutPOS-Data\pos-database.sqlite`
- Fallback: `C:\AynBeirutPOS-Data\pos-database.sqlite`

**Backups:**
- Primary: `D:\AynBeirutPOS-Backups\`
- Fallback: `C:\AynBeirutPOS-Backups\`

**Backup Strategy:**
- Auto-backup after sales, shifts, product updates
- Keep 30 days of backups
- Always keep minimum 3 backups

---

## 🔧 System Requirements

- **OS:** Windows 10/11 (x64)
- **RAM:** 4 GB minimum
- **Disk Space:** 200 MB free
- **Drive:** C:\ or D:\ with write permissions

---

## ⚠️ Known Issues

- Using default Electron icon (custom branding in v1.1.0)
- No server synchronization yet (planned for v1.2.0)

---

## 🆘 Troubleshooting

**Installation blocked by Windows:**
- This is normal - installer is not code-signed
- Click "More info" → "Run anyway"

**Data not saving:**
- Check disk space on C:\ or D:\
- Verify folder permissions
- Check console (F12) for errors

**Backups not created:**
- Verify `AynBeirutPOS-Backups` folder exists
- Check write permissions
- Look for "Auto-backup created" in console

---

## 📞 Support

**Issues:** https://github.com/AynBeirut/posfinal/issues  
**Documentation:** See README.md in repository

---

## 🎯 Roadmap

**v1.1.0** - Custom branding, backup management UI  
**v1.2.0** - Server sync, cloud backups  
**v1.3.0** - Multi-store support, advanced reporting

---

## 📝 Technical Details

**Built with:**
- Electron 28.0.0
- SQL.js (SQLite)
- electron-updater 6.6.2
- electron-builder 24.13.3

**Storage Hierarchy:**
1. Electron File System (Production - Unlimited)
2. File System Access API (Browser fallback)
3. IndexedDB (Browser fallback - ~100MB)
4. LocalStorage (Last resort - 5-10MB)

---

**Full Changelog:** https://github.com/AynBeirut/posfinal/compare/v0.9.0...v1.0.0

**Installation Guide:** See [DEPLOYMENT-v1.0.0.md](https://github.com/AynBeirut/posfinal/blob/main/pos-v1/DEPLOYMENT-v1.0.0.md)
