#!/usr/bin/env bash
# Run ON THE MAC after copying grabio-usb-credentials from USB.
set -euo pipefail

KIT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Grabio credential installer"
echo "Kit folder: $KIT_DIR"
echo ""
read -r -p "Path to your Grabio repo on this Mac: " REPO
REPO="${REPO/#\~/$HOME}"
REPO="${REPO%/}"

if [[ ! -d "$REPO" ]]; then
  echo "❌ Folder not found: $REPO"
  exit 1
fi

if [[ -f "$KIT_DIR/dot-env-local" ]]; then
  cp "$KIT_DIR/dot-env-local" "$REPO/.env.local"
  echo "✅ Wrote $REPO/.env.local"
fi

if [[ -f "$KIT_DIR/dot-env-production" ]]; then
  cp "$KIT_DIR/dot-env-production" "$REPO/.env.production"
  echo "✅ Wrote $REPO/.env.production"
fi

if [[ -f "$KIT_DIR/dot-env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^# ]] && continue
    [[ -z "$line" ]] && continue
    key="${line%%=*}"
    if ! grep -q "^${key}=" "$REPO/.env.local" 2>/dev/null; then
      echo "$line" >> "$REPO/.env.local"
    fi
  done < "$KIT_DIR/dot-env"
  echo "✅ Merged extra keys from dot-env into .env.local"
fi

if [[ -f "$KIT_DIR/firebaserc.json" ]]; then
  cp "$KIT_DIR/firebaserc.json" "$REPO/.firebaserc"
  echo "✅ Wrote $REPO/.firebaserc"
fi

SA_SRC=""
for candidate in \
  "$KIT_DIR/serviceAccountKey.json" \
  "$KIT_DIR/firebase-service-account.json" \
  "$KIT_DIR/scripts/firebase-service-account.json"; do
  if [[ -f "$candidate" ]]; then
    SA_SRC="$candidate"
    break
  fi
done

if [[ -n "$SA_SRC" ]]; then
  cp "$SA_SRC" "$REPO/serviceAccountKey.json"
  chmod 600 "$REPO/serviceAccountKey.json"
  echo "✅ Wrote $REPO/serviceAccountKey.json from $(basename "$SA_SRC") (mode 600)"
else
  echo "⚠️  No serviceAccountKey.json / firebase-service-account.json in kit — add from USB or grabio-isolated/scripts/, then re-run."
fi

echo ""
echo "Next on Mac:"
echo "  cd \"$REPO\""
echo "  npm install"
echo "  npx firebase-tools login"
echo "  npx firebase-tools use market-flow-7b074"
echo ""
echo "Done."
