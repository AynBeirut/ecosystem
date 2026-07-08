# Deploy — Grabio Invoice Manager at `/invoice`

## Build

```bash
cd "the eco sys/finance/beirut-finance-flow-main"
cp .env.local.example .env.local   # fill Firebase keys (same as grabio.space)
npm run build
```

Output: `dist/` with assets prefixed for `/invoice/`.

## Copy into main hosting bundle

```bash
# from repo root — or use scripts/deploy-invoice.sh (builds finance only, preserves main dist)
rm -rf dist/invoice
mkdir -p dist/invoice
cp -r "the eco sys/finance/beirut-finance-flow-main/dist/"* dist/invoice/
cp -r public/.well-known dist/.well-known   # TWA Digital Asset Links
```

**Warning:** `npm run build` at repo root wipes `dist/` — always re-copy `dist/invoice/` after a main SPA build.

## Firebase hosting

Root `firebase.json` includes:

```json
{ "source": "/invoice/**", "destination": "/invoice/index.html" }
```

Deploy **only** after owner lists approved files:

```bash
npm run build          # main grabio.space SPA
# + finance build/copy above
firebase deploy --only hosting
```

## Local dev

```bash
npm run dev   # http://localhost:8080/  (base /)
```

Production build preview:

```bash
npm run build && npm run preview
# http://localhost:4173/invoice/
```

## Play Store (Phase A6)

TWA target: `https://grabio.space/invoice/`  
Package: `space.grabio.finance`  
Requires `/.well-known/assetlinks.json` on grabio.space.

Full guide: [PLAY_STORE.md](./PLAY_STORE.md)

```bash
cd "the eco sys/finance/twa"
chmod +x build-twa.sh
./build-twa.sh   # first run: interactive bubblewrap init
```
