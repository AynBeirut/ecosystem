# Travel agency agent console (web)

Deal-centric UI per `docs/plan-better-travel-platform.md`.

```bash
cd travel-agency/web
cp .env.example .env   # fill Firebase web config
npm install
npm run dev            # http://localhost:5175/travel/
```

Build output: `dist/` — deploy under hosting path `/travel/` (see root `firebase.json`).

**Staging demo (no API):** https://market-flow-7b074--staging-jir26mhn.web.app/travel/ → **Enter demo (no API)**. Sample proposal: `/travel/p/demo`. Rebuild: `npm run build:travel:staging` from repo root, then `firebase hosting:channel:deploy staging --expires 30d`.
