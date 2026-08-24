#!/usr/bin/env bash
# Install daily SEO Apache log audit cron on the grabio.space VPS.
# Run on VPS as root or deploy user with repo checked out at REPO_ROOT.

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/root/grabio-seo}"
LOG_PATH="${LOG_PATH:-/usr/local/apps/apache2/logs/grabio.space.log}"
CRON_HOUR="${CRON_HOUR:-3}"
CRON_MIN="${CRON_MIN:-15}"

CRON_LINE="${CRON_MIN} ${CRON_HOUR} * * * cd ${REPO_ROOT} && /usr/bin/node scripts/seo-audit-upload.mjs --log ${LOG_PATH} --site grabio.space >> /var/log/grabio-seo-audit.log 2>&1"

echo "Grabio SEO audit cron installer"
echo "  Repo:     ${REPO_ROOT}"
echo "  Log:      ${LOG_PATH}"
echo "  Schedule: daily at ${CRON_HOUR}:${CRON_MIN}"
echo ""
echo "Cron entry:"
echo "  ${CRON_LINE}"
echo ""

if [[ "${1:-}" != "--install" ]]; then
  echo "Dry run — pass --install to append to crontab."
  exit 0
fi

( crontab -l 2>/dev/null | grep -v 'seo-audit-upload.mjs' || true
  echo "${CRON_LINE}"
) | crontab -

echo "✅ Cron installed. Tail: tail -f /var/log/grabio-seo-audit.log"
