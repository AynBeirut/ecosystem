# Grabio POS desktop client — changes on Windows (2026-07-04)

Source lives on Windows at:
`eco sys pos/the eco sys/ecosystem-plan/posfinal-main/pos-v1/`

## Files changed for Grabio integration

| File | Change |
|------|--------|
| `package.json` | Grabio POS v1.1.0 branding |
| `build/icon.png`, `build/icon.ico` | Grabio icons |
| `js/grabio/grabio-config.js` | API base → Cloud Run URL |
| `js/grabio/grabio-migrate.js` | Full data migration (products, customers, staff, etc.) |
| `js/grabio/grabio-auto-pair.js` | **new** — first-launch auto-pair |
| `js/grabio/grabio-sync.js`, `grabio-pairing.js` | Sync/pairing updates |
| `js/settings.js` | Null-safe settings + migration UI |
| `electron-main.js`, `preload.js`, `index.html` | Auto-pair IPC + script |

## Build installer (Windows)
```bash
cd pos-v1
npm install
npm run build
# Output: dist/Grabio-POS-1.1.0-Setup.exe
```

## API
`https://api-5nbn2jdbxa-uc.a.run.app`
