#!/usr/bin/env bash
# Point ecosystem scripts at grabio-isolated Firebase admin key (Mac / local).
#
# Usage:
#   ./scripts/linkFirebaseAdminKey.sh /path/to/grabio-isolated/.../scripts/firebase-service-account.json
#   ./scripts/linkFirebaseAdminKey.sh   # uses FIREBASE_SA_PATH env if set
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-${FIREBASE_SA_PATH:-}}"

if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "Usage: $0 /path/to/firebase-service-account.json"
  echo "   or: FIREBASE_SA_PATH=... $0"
  exit 1
fi

DEST="$ROOT/serviceAccountKey.json"
cp "$SRC" "$DEST"
chmod 600 "$DEST"
echo "✅ Linked admin key → $DEST"
echo "   Source: $SRC"
ls -la "$DEST"
