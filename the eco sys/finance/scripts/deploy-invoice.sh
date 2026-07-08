#!/usr/bin/env bash
# Deploy Grabio Invoice Manager to grabio.space/invoice (rebuilds main SPA + invoice bundle).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

cd "$ROOT"
npm run build
firebase deploy --only hosting
echo "Live: https://grabio.space/invoice/"
