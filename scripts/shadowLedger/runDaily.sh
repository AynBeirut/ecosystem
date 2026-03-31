#!/bin/bash
# Shadow Ledger — Daily Check Runner
# Scheduled via crontab to run every day at 07:00
# Logs are written to scripts/shadowLedger/logs/

set -e

WORKSPACE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$WORKSPACE_DIR/scripts/shadowLedger/logs"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/$DATE.log"

mkdir -p "$LOG_DIR"

echo "=== Shadow Ledger Daily Check — $DATE ===" | tee "$LOG_FILE"
echo "Started: $(date --iso-8601=seconds)" | tee -a "$LOG_FILE"

cd "$WORKSPACE_DIR"
node scripts/shadowLedger/dailyCheck.cjs --save --quiet 2>&1 | tee -a "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}

echo "Finished: $(date --iso-8601=seconds)  exit=$EXIT_CODE" | tee -a "$LOG_FILE"

if [ $EXIT_CODE -eq 2 ]; then
  echo ""
  echo "❌  ISSUES DETECTED — check Firestore: shadowLedger/nipco-latest-check"
  echo "    Full report: shadowLedger/nipco-daily-checks/checks/$DATE"
fi

exit $EXIT_CODE
