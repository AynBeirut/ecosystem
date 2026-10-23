#!/usr/bin/env bash
# Build a folder you can copy to a USB drive for your Mac (never commit the output).
#
# Usage:
#   ./scripts/buildGrabioUsbKit.sh
#   ./scripts/buildGrabioUsbKit.sh /path/to/firebase-adminsdk-xxxxx.json
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/grabio-usb-credentials"
SA_SRC="${1:-}"

rm -rf "$OUT"
mkdir -p "$OUT"

cp "$ROOT/.env.production" "$OUT/dot-env-production"
cp "$ROOT/.env" "$OUT/dot-env" 2>/dev/null || true
cp "$ROOT/.firebaserc" "$OUT/firebaserc.json"

cat > "$OUT/dot-env-local" <<'ENVLOCAL'
# Copy to: <your-repo>/.env.local
VITE_API_BASE=https://api-5nbn2jdbxa-uc.a.run.app
VITE_FIREBASE_AUTH_DOMAIN=market-flow-7b074.firebaseapp.com
VITE_GOOGLE_CLIENT_ID=997465465802-aa8arghkqbm9jjdvokmgfr1adu17ih2e.apps.googleusercontent.com
VITE_GSC_PROPERTY=https://grabio.space/
VITE_FIREBASE_VAPID_KEY=BAqIup01nmdSPFPl2eNJzTQlxY5r35SYHgPNwdjleEIQJVx0OYcxGntXuiqvBboIZ0dIQS47WPronVDTUexGE5w
VITE_ECOSYSTEM_MODULAR=true
VITE_ECOSYSTEM_PACKAGE_DRAFT=true
VITE_ECOSYSTEM_MODULAR_CHECKOUT=true
VITE_ECOSYSTEM_ENFORCE_MODULES=true
VITE_PUBLIC_PRODUCT_STOCK_API=true
ENVLOCAL

cat > "$OUT/firebase-web-config.txt" <<'CFG'
Firebase web app (already in src/lib/firebase.ts — for reference only)
Project ID: market-flow-7b074
Auth domain: market-flow-7b074.firebaseapp.com
CFG

if [[ -n "$SA_SRC" && -f "$SA_SRC" ]]; then
  cp "$SA_SRC" "$OUT/serviceAccountKey.json"
  echo "Included serviceAccountKey.json from: $SA_SRC"
else
  cat > "$OUT/serviceAccountKey.README.txt" <<'SA'
Put your Firebase admin key in this folder and rename it to:

  serviceAccountKey.json

How to get it (phone or Mac browser):
1. https://console.firebase.google.com/ → market-flow-7b074
2. Project settings (gear) → Service accounts
3. "Generate new private key" → save the JSON file here

NEVER email this file or commit it to GitHub.
SA
fi

cp "$ROOT/scripts/installGrabioCredentialsOnMac.sh" "$OUT/install-on-mac.sh"
cp "$ROOT/scripts/linkFirebaseAdminKey.sh" "$OUT/linkFirebaseAdminKey.sh"
chmod +x "$OUT/install-on-mac.sh" "$OUT/linkFirebaseAdminKey.sh"
cp "$ROOT/docs/deployment/FINISH_FIREBASE_ON_MAC.md" "$OUT/FINISH_FIREBASE_ON_MAC.md"
cp "$OUT/dot-env-local" "$OUT/FIREBASE_CREDENTIALS.env"
cat >> "$OUT/FIREBASE_CREDENTIALS.env" <<'ENVFOOTER'

# --- PROJECT (all tools) ---
# project_id=market-flow-7b074
# console=https://console.firebase.google.com/project/market-flow-7b074
# web apiKey=AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U
# appId web=1:997465465802:web:3c6789ea41a9458a98e533

# --- SECRET (copy FILE, not these lines) ---
# USB: grabio-isolated/.../scripts/firebase-service-account.json  (NEWEST, e.g. Jul 2026)
# Mac repo: ecosystem/serviceAccountKey.json
#   chmod 600 serviceAccountKey.json
ENVFOOTER

cat > "$OUT/READ_ME_FIRST.txt" <<'README'
GRABIO USB — START HERE
=======================

1) OPEN: FINISH_FIREBASE_ON_MAC.md  (ALL Firebase values + secret instructions)

2) SETTINGS: copy FIREBASE_CREDENTIALS.env → ecosystem/.env.local

3) SECRET (required): copy NEWEST firebase-service-account.json from disk to:
     ecosystem/serviceAccountKey.json
     chmod 600 serviceAccountKey.json

4) RUN:
     bash install-on-mac.sh
     cd ecosystem && node scripts/provisionLiveKitchenPackage.cjs EMAIL --write

CLI login empty = NORMAL until: npx firebase-tools login (deploy only)

Project: market-flow-7b074
Do NOT commit serviceAccountKey.json to GitHub.
README

echo ""
echo "✅ Kit ready: $OUT"
echo "   Copy the folder 'grabio-usb-credentials' to your hard disk / USB."
ls -la "$OUT"
