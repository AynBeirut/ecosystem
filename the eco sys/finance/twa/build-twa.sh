#!/usr/bin/env bash
# Build Grabio Invoice Manager TWA (Android) for Play Store upload.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-1.17.0-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$PATH"

BW="./node_modules/.bin/bubblewrap"

if [[ ! -d android ]]; then
  echo "→ First-time init"
  "$BW" init --manifest=twa-manifest.json --directory=android
fi

echo "→ Syncing manifest into Android project…"
"$BW" update --directory=android --manifest=twa-manifest.json

echo "→ Building signed AAB/APK…"
if [[ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" ]]; then
  export BUBBLEWRAP_KEYSTORE_PASSWORD="${GRABIO_FINANCE_KEYSTORE_PASSWORD:-}"
  export BUBBLEWRAP_KEY_PASSWORD="${GRABIO_FINANCE_KEY_PASSWORD:-}"
fi
if [[ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" ]]; then
  echo "Set BUBBLEWRAP_KEYSTORE_PASSWORD (see .credentials.md) or enter when prompted."
fi
"$BW" build --directory=android

# Fallback: if bubblewrap leaves an unsigned bundle, sign with release keystore.
UNSIGNED="android/app/build/outputs/bundle/release/app-release.aab"
SIGNED="android/app-release-signed.aab"
if [[ -f "$UNSIGNED" ]] && ! jarsigner -verify "$UNSIGNED" >/dev/null 2>&1; then
  echo "→ Signing unsigned bundle with grabio-finance-release.keystore…"
  cp "$UNSIGNED" "$SIGNED"
  jarsigner -sigalg SHA256withRSA -digestalg SHA-256 \
    -keystore grabio-finance-release.keystore \
    -storepass "${BUBBLEWRAP_KEYSTORE_PASSWORD}" \
    -keypass "${BUBBLEWRAP_KEY_PASSWORD}" \
    "$SIGNED" grabio-finance
fi

echo "Done. Upload android/app-release-signed.aab to Play Console."
ls -la android/app-release-signed.* 2>/dev/null || true
