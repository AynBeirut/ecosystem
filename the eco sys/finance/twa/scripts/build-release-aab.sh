#!/usr/bin/env bash
# Build signed Grabio Invoice Manager AAB for Play Store upload.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../../.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-1.17.0-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$PATH"

# Keystore passwords from .credentials.md (gitignored)
if [[ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" ]]; then
  export BUBBLEWRAP_KEYSTORE_PASSWORD='VNia8EHkrjmANPoBQl7c'
  export BUBBLEWRAP_KEY_PASSWORD='VNia8EHkrjmANPoBQl7c'
fi

VERSION_NAME="$(grep -o '"appVersionName": "[^"]*"' twa-manifest.json | head -1 | cut -d'"' -f4)"
VERSION_CODE="$(grep -o '"appVersionCode": [0-9]*' twa-manifest.json | head -1 | grep -o '[0-9]*')"
OUT="$ROOT/release/grabio-invoice-v${VERSION_NAME}-build${VERSION_CODE}.aab"

echo "→ Building v${VERSION_NAME} (code ${VERSION_CODE})…"
cd android
./gradlew bundleRelease

UNSIGNED="app/build/outputs/bundle/release/app-release.aab"
if ! jarsigner -verify "$UNSIGNED" >/dev/null 2>&1; then
  echo "→ Gradle bundle unsigned — signing with release keystore…"
  jarsigner -sigalg SHA256withRSA -digestalg SHA-256 \
    -keystore "$ROOT/grabio-finance-release.keystore" \
    -storepass "$BUBBLEWRAP_KEYSTORE_PASSWORD" \
    -keypass "$BUBBLEWRAP_KEY_PASSWORD" \
    "$UNSIGNED" grabio-finance
fi

mkdir -p "$ROOT/release"
cp "$UNSIGNED" "$OUT"
jarsigner -verify "$OUT" >/dev/null
echo "✅ Signed AAB: $OUT"
ls -lh "$OUT"

echo "→ Running verification…"
bash "$ROOT/scripts/verify-play-release.sh" "$OUT"
