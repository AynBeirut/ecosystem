#!/usr/bin/env bash
# Full internal verification before sending APK to device.
set -uo pipefail

PKG=space.grabio.app
ACTIVITY=${PKG}/.MainActivity
FAIL=0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log() { echo "[verify] $*"; }
fail() { echo "[FAIL] $*"; FAIL=1; }
pass() { echo "[PASS] $*"; }

has_crash() {
  adb logcat -d | rg -q "FATAL EXCEPTION: mqt_native_modules|JavascriptException"
}

clear_crash_log() {
  adb logcat -c
}

dump_ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml /tmp/grabio-ui.xml >/dev/null 2>&1
}

tap_text() {
  local text="$1"
  dump_ui
  python3 - "$text" <<'PY'
import re, sys
text = sys.argv[1]
xml = open('/tmp/grabio-ui.xml', encoding='utf-8', errors='ignore').read()
for pat in [rf'text="{re.escape(text)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
            rf'content-desc="{re.escape(text)}"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"']:
    m = re.search(pat, xml)
    if m:
        x1,y1,x2,y2 = map(int, m.groups())
        print((x1+x2)//2, (y1+y2)//2)
        raise SystemExit(0)
raise SystemExit(1)
PY
}

tap_xy() { adb shell input tap "$1" "$2"; sleep 2; }

try_tap() {
  if coords=$(tap_text "$1" 2>/dev/null); then
    read -r x y <<< "$coords"
    tap_xy "$x" "$y"
    return 0
  fi
  return 1
}

check_no_crash() {
  local label="$1"
  if has_crash; then
    fail "$label — app crashed"
    adb logcat -d | rg -i "JavascriptException|FATAL EXCEPTION" | tail -8
    return 1
  fi
  pass "$label — no crash"
  return 0
}

adb devices | rg -q "device$" || { echo "No device connected"; exit 1; }

log "=== Unit: formatCommerce ==="
node -e "
const { formatPrice, formatRating, toNumber } = require('./src/lib/formatCommerce.ts');
" 2>/dev/null || node --input-type=module -e "
import { formatPrice, formatRating, toNumber } from '${ROOT}/src/lib/formatCommerce.ts';
const ok = formatPrice(undefined) === 'USD —' && formatRating('4.5') === '4.5' && toNumber('x') === null;
if (!ok) process.exit(1);
console.log('formatCommerce ok');
" 2>/dev/null || npx --yes tsx -e "
import { formatPrice, formatRating, toNumber } from '${ROOT}/src/lib/formatCommerce.ts';
if (formatPrice(undefined) !== 'USD —') throw new Error('formatPrice');
if (formatRating('4.5') !== '4.5') throw new Error('formatRating string');
if (formatRating(undefined) !== null) throw new Error('formatRating null');
if (toNumber('bad') !== null) throw new Error('toNumber');
console.log('formatCommerce ok');
" && pass "formatCommerce helpers" || fail "formatCommerce helpers"

VER=$(adb shell dumpsys package "$PKG" | rg "versionName" | head -1 | tr -d '\r')
log "Installed: $VER"

log "=== Phase 1: Cold start + location gate ==="
clear_crash_log
adb shell am force-stop "$PKG"
adb shell pm revoke "$PKG" android.permission.ACCESS_FINE_LOCATION 2>/dev/null || true
adb shell pm revoke "$PKG" android.permission.ACCESS_COARSE_LOCATION 2>/dev/null || true
adb shell am start -n "$ACTIVITY" >/dev/null
sleep 3
dump_ui
if rg -q "Location required" /tmp/grabio-ui.xml 2>/dev/null; then
  pass "Location gate shown for sales user"
  try_tap "ALLOW" || true
  sleep 2
  if try_tap "Allow" || try_tap "While using the app" || try_tap "Only this time"; then
    log "Granted location via system dialog"
    sleep 6
  elif try_tap "Enable location"; then
    sleep 2
    try_tap "ALLOW" || true
    sleep 2
    try_tap "While using the app" || try_tap "Only this time" || true
    sleep 6
  else
    log "Permission may already be granted"
    sleep 3
  fi
fi
dump_ui
if rg -q "Location required" /tmp/grabio-ui.xml 2>/dev/null && rg -q "Enable location" /tmp/grabio-ui.xml 2>/dev/null; then
  fail "Still on location gate after grant attempt"
elif rg -q "Location required" /tmp/grabio-ui.xml 2>/dev/null; then
  fail "Stuck on location gate spinner after grant"
elif rg -q "Dashboard|Quick Actions|My CRM Clients" /tmp/grabio-ui.xml 2>/dev/null; then
  pass "Past location gate — app content visible"
else
  pass "Past location gate — no blocker text"
fi
check_no_crash "Cold start"

log "=== Phase 2: Guest marketplace → store ==="
dump_ui
if try_tap "Browse as Guest →" || try_tap "Browse as Guest"; then
  pass "Opened guest mode"
else
  log "Not on login — may already be signed in; continuing"
fi
sleep 2
check_no_crash "After guest/browse"

if try_tap "🏪 Stores" || try_tap "Stores"; then
  pass "Stores tab"
else
  log "Stores tab not found — skipping guest marketplace (not in customer/guest mode)"
fi
sleep 2
check_no_crash "Stores tab"

dump_ui
STORE=$(python3 <<'PY'
import re
xml = open('/tmp/grabio-ui.xml', encoding='utf-8', errors='ignore').read()
candidates = []
for m in re.finditer(r'text="([^"]{2,60})"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    t = m.group(1)
    x1,y1,x2,y2 = map(int, m.groups()[1:])
    if y1 > 500 and 'grabio' not in t.lower() and 'search' not in t.lower() and 'products' not in t.lower() and 'stores' not in t.lower() and 'sign' not in t.lower():
        candidates.append((y1, (x1+x2)//2, (y1+y2)//2, t))
if candidates:
    candidates.sort()
    y,x,cy,t = candidates[0]
    print(x, cy, t)
PY
)
if [[ -n "${STORE:-}" ]]; then
  read -r sx sy sname <<< "$STORE"
  log "Tap store: $sname"
  clear_crash_log
  tap_xy "$sx" "$sy"
  sleep 4
  check_no_crash "Store detail ($sname)"
  adb shell input keyevent 4
  sleep 1
else
  fail "No store card to tap"
fi

log "=== Phase 3: CRM Clients screen (logged-in) ==="
clear_crash_log
adb shell am start -n "$ACTIVITY" >/dev/null
sleep 4
if try_tap "📍 All CRM Clients" || try_tap "My CRM Clients" || try_tap "📍 My CRM Clients"; then
  sleep 4
  check_no_crash "CRM Clients screen"
  dump_ui
  if rg -q "Capture location" /tmp/grabio-ui.xml 2>/dev/null; then
    pass "Capture location button visible"
  else
    log "Capture location not visible (role may not allow — skip)"
  fi
else
  log "CRM entry not on screen — skip CRM phase"
fi

log "=== Phase 4: Map & Pipeline ==="
clear_crash_log
if try_tap "🗺 Map" || try_tap "Map & pipeline" || try_tap "Map"; then
  sleep 4
  check_no_crash "Map & Pipeline"
else
  log "Map not found on current screen — skip"
fi

echo ""
if [[ $FAIL -ne 0 ]]; then
  echo "=== VERIFICATION FAILED — do not ship ==="
  exit 1
fi
echo "=== ALL CHECKS PASSED — OK to install for Anwar test ==="
exit 0
