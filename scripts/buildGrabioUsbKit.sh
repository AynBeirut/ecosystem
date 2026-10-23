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
chmod +x "$OUT/install-on-mac.sh"

cat > "$OUT/READ_ME_FIRST.txt" <<'README'
GRABIO — credentials for your Mac (USB transfer)
==================================================

1. Copy this whole folder to your USB drive.
2. On the Mac, plug in the USB drive.
3. Open Terminal and run:

     bash /Volumes/YOUR_USB/grabio-usb-credentials/install-on-mac.sh

   (Replace YOUR_USB with your drive name.)

4. When asked, paste the full path to your Grabio repo on the Mac, e.g.:

     /Users/you/Documents/ecosystem

5. Firebase CLI login (one time on Mac):

     cd /Users/you/Documents/ecosystem
     npx firebase-tools login
     npx firebase-tools use market-flow-7b074

6. Test admin scripts:

     node scripts/provisionLiveKitchenPackage.cjs you@email.com

Files in this kit:
  dot-env-local       → copied to repo as .env.local
  dot-env-production  → copied to repo as .env.production
  serviceAccountKey.json (if included) → repo root
  firebaserc.json     → copied to repo as .firebaserc

Keep the USB drive safe — treat it like a password.
README

echo ""
echo "✅ Kit ready: $OUT"
echo "   Copy the folder 'grabio-usb-credentials' to your hard disk / USB."
ls -la "$OUT"
