# Linux Builder — Grabio POS (continue from Git)

Everything needed to finish POS deployment is in **`main`** on:
`https://github.com/AynBeirut/grabio.space.git`

Windows work (2026-07-04) is merged there. Clone on Linux — full checkout works (Windows fails on `assets/xandroid /` paths only).

---

## What's already done (do NOT redo unless broken)

| Item | Status |
|------|--------|
| Backend API live | `https://api-5nbn2jdbxa-uc.a.run.app` (health → `v3-2026-07-04`) |
| POS endpoints in git | `functions/src/api/posSync.ts` + routes in `functions/src/index.ts` |
| Admin POS page in git | `src/pages/admin/AdminPos.tsx`, `src/lib/posApi.ts`, routes, sidebar |
| `.env.production` in git | API + installer URL pre-set |
| Windows installer built | `Grabio-POS-1.1.0-Setup.exe` (~74MB) — upload to Storage (step 2) |

---

## Your tasks (in order)

### 1. Clone and verify
```bash
git clone https://github.com/AynBeirut/grabio.space.git
cd grabio.space
git pull origin main
git log -1 --oneline   # should include POS admin + functions commit
```

### 2. Upload POS installer to Firebase Storage
Copy `Grabio-POS-1.1.0-Setup.exe` from Windows (`pos-v1/dist/`) via scp/usb, then:

```bash
firebase login
gsutil cp Grabio-POS-1.1.0-Setup.exe gs://market-flow-7b074.appspot.com/pos-releases/
gsutil acl ch -u AllUsers:R gs://market-flow-7b074.appspot.com/pos-releases/Grabio-POS-1.1.0-Setup.exe
```

Verify URL opens:
`https://firebasestorage.googleapis.com/v0/b/market-flow-7b074.appspot.com/o/pos-releases%2FGrabio-POS-1.1.0-Setup.exe?alt=media`

Optional — POS source zip (if copied from Windows `pos-client-source.zip`):
```bash
gsutil cp pos-client-source.zip gs://market-flow-7b074.appspot.com/pos-releases/
gsutil acl ch -u AllUsers:R gs://market-flow-7b074.appspot.com/pos-releases/pos-client-source.zip
```

### 3. Build frontend
```bash
npm install
npm run build
```

### 4. Deploy hosting
```bash
firebase deploy --only hosting --project market-flow-7b074
```

### 5. Redeploy functions (only if live API missing POS routes)
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions:api --project market-flow-7b074
```

Check: `curl -s https://api-5nbn2jdbxa-uc.a.run.app/health | jq .version` → `v3-2026-07-04`

### 6. Verify in browser (store with `enabledModules.pos = true`)
- https://grabio.space/admin/dashboard → **Grabio POS** in sidebar
- https://grabio.space/admin/pos → download, install token, pairing code, devices

### 7. End-to-end client test
1. Generate install token → download `pairing.json`
2. Download installer → run with `pairing.json` beside it
3. POS auto-pairs on first launch
4. Ctrl+Shift+S → 6969 → Sync All Data (optional migration)

---

## POS desktop source (Windows-only repo path)

Not in grabio.space — built on Windows. Changed files listed in `pos-client/CHANGES.md`.
Rebuild on Windows: `eco sys pos/.../pos-v1/` → `npm run build` → NSIS installer in `dist/`.

---

## Do NOT
- Force push `main`
- Redeploy functions if `/health` already shows `v3-2026-07-04` and `/pos/products` works
