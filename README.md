# Eco Sys POS (Grabio)

**All new Grabio / ecosystem POS work lives here.** Do not change `../posfinal/` or the parent `githup/` monorepo for this project.

This workspace is a git clone of [AynBeirut/ecosystem](https://github.com/AynBeirut/ecosystem.git). POS work goes under `the eco sys/ecosystem-plan/`.

## Layout

```
eco sys pos/
  the eco sys/
    ecosystem-plan/
      pos-windows-builder-pack/   ← API contract, tasks, setup docs
      posfinal-main/
        pos-v1/                   ← Windows POS app (Electron + SQL.js)
  .cursor/rules/                  ← Project rules for Cursor (local)
```

## Quick start

```powershell
cd "the eco sys\ecosystem-plan\posfinal-main\pos-v1"
npm install
npm start
```

## Docs (read in order)

1. `the eco sys/ecosystem-plan/pos-windows-builder-pack/README.md`
2. `the eco sys/ecosystem-plan/pos-windows-builder-pack/API-CONTRACT.md`
3. `the eco sys/ecosystem-plan/pos-windows-builder-pack/CODE-TASKS.md`

## Git

```powershell
cd "C:\Users\Alaa\Documents\githup\pos\eco sys pos"
git remote -v   # origin → https://github.com/AynBeirut/ecosystem.git
git pull origin main
git push origin main
```

Push to **ecosystem** — not `AynBeirut/posfinal`.

## Source

`pos-v1` was copied from `../posfinal/pos-v1/` (source only — no `node_modules`, no `dist`). Legacy VPS sync remains in `js/sync-manager.js` until Grabio QA passes.

## Next build task

Implement `the eco sys/ecosystem-plan/posfinal-main/pos-v1/js/grabio/` per CODE-TASKS.md (pairing + heartbeat first).
