#!/usr/bin/env bash
# Pre-upload verification for Grabio Invoice Manager Play Store release.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../../.." && pwd)"
AAB="${1:-$ROOT/release/grabio-invoice-v1.2.4-build8.aab}"
FAIL=0

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAIL=1; }

echo "=== Play Store release verification ==="

# 1. AAB exists
if [[ -f "$AAB" ]]; then pass "AAB found: $AAB"; else fail "AAB missing: $AAB"; fi

# 2. AAB signed
if [[ -f "$AAB" ]] && jarsigner -verify "$AAB" >/dev/null 2>&1; then
  pass "AAB is signed"
else
  fail "AAB is NOT signed"
fi

# 3. Keystore fingerprint in assetlinks
UPLOAD_FP="6D:B2:E1:18:95:F4:BC:8D:3C:0A:39:E7:CE:3A:9E:AF:15:78:78:04:4C:E4:9D:B1:D5:E6:57:E9:DE:D7:54:73"
INTERNAL_FP="0F:49:2F:0D:43:02:47:20:25:8B:1E:9E:30:6C:C5:9D:29:1C:BA:F1:F4:EE:7F:8B:28:B8:CA:62:4B:BE:0F:82"
ASSETLINKS="$REPO/public/.well-known/assetlinks.json"
if grep -q "$UPLOAD_FP" "$ASSETLINKS" && grep -q "$INTERNAL_FP" "$ASSETLINKS"; then
  pass "assetlinks.json includes upload + Play internal cert fingerprints"
else
  fail "assetlinks.json missing required fingerprints"
fi

# 4. Live assetlinks (if deployed)
LIVE="$(curl -fsS https://grabio.space/.well-known/assetlinks.json 2>/dev/null || true)"
if echo "$LIVE" | grep -q "$INTERNAL_FP"; then
  pass "Live assetlinks.json includes Play internal cert"
else
  fail "Live assetlinks.json missing Play internal cert (deploy hosting after update)"
fi

# 5. Web crash fix — enforceModuleGates must be imported in source
GATE="$REPO/the eco sys/finance/beirut-finance-flow-main/src/components/InvoiceModuleGate.tsx"
if grep -q 'import { enforceModuleGates }' "$GATE" && grep -q 'enforceModuleGates()' "$GATE"; then
  pass "InvoiceModuleGate imports enforceModuleGates"
else
  fail "InvoiceModuleGate broken (missing enforceModuleGates import)"
fi

# 6. TWA manifest
if grep -q 'space.grabio.finance' "$ROOT/twa-manifest.json"; then
  pass "TWA packageId is space.grabio.finance"
else
  fail "TWA packageId wrong"
fi

# 6. Android manifest
MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
if grep -q 'hostName' "$MANIFEST"; then
  pass "AndroidManifest has domain intent filter"
else
  fail "AndroidManifest missing domain verification"
fi

# 7. Android uses WebView shell (not Chrome Custom Tabs)
LAUNCHER="$ROOT/android/app/src/main/java/space/grabio/finance/LauncherActivity.java"
if grep -q 'WebViewFallbackActivity' "$LAUNCHER"; then
  pass "LauncherActivity uses WebView shell (no Chrome Custom Tabs)"
else
  fail "LauncherActivity still uses TWA/Custom Tabs fallback"
fi

if grep -q 'DISPLAY_MODE' "$MANIFEST"; then
  pass "AndroidManifest has display mode metadata"
else
  fail "AndroidManifest missing display metadata"
fi

# 8. Invoice web build present
if [[ -f "$REPO/dist/invoice/index.html" ]]; then
  pass "dist/invoice deployed build exists"
else
  fail "dist/invoice missing — run web build + copy-invoice-dist"
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "=== ALL CHECKS PASSED — safe to upload to Play Console ==="
  exit 0
fi
echo "=== CHECKS FAILED — fix before uploading ==="
exit 1
