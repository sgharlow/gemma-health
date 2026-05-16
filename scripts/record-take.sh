#!/usr/bin/env bash
# Master orchestrator for a HealthPulse Edge submission video TAKE.
#
# Prerequisites:
#   - Run scripts/prep-recording.sh ONCE per session (it sets up Ollama with
#     keep-alive, dev server with STUB_LLM_REDACTION, and pre-warms the
#     model paths). This script does NOT manage the dev server.
#   - macOS Screen Recording permission granted to your Terminal app
#     (System Settings → Privacy & Security → Screen Recording → enable Terminal)
#   - Printed and hand-filled patient-survey-print.html within arm's reach
#   - Headphones / mic OFF (voiceover is done in post)
#
# Sequence:
#   1. Pre-roll sanity (Ollama, dev server, model resident, ledger fresh)
#   2. Start screen capture (full-screen mov, captures menu bar Wi-Fi icon)
#   3. Turn Wi-Fi OFF (so OFFLINE banner glows + "no internet" claim holds)
#   4. Run Playwright driver — scenes 1, 2, manual-3, 4, 5
#   5. Stop screen capture, restore Wi-Fi
#
# Flags:
#   --rehearse        skip Wi-Fi toggle + skip Scene 3 wait (safe online dry-run)
#   --no-screencap    skip screen-recording (you handle ScreenFlow/QuickTime yourself)
#   --keep-wifi       don't toggle Wi-Fi (paired with --no-screencap for debugging)
#
# Once live mode starts, you lose internet (and Claude Code) until Wi-Fi
# is restored at the end. Verify everything in --rehearse first.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/assets/recordings"
LEDGER_FILE="$REPO_ROOT/data/ledger/ledger.jsonl"

mkdir -p "$OUT_DIR"

WIFI_IFACE="$(networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}')"
if [[ -z "$WIFI_IFACE" ]]; then
  echo "FATAL: could not detect Wi-Fi interface via networksetup"
  exit 1
fi

REHEARSE=0
NO_SCREENCAP=0
KEEP_WIFI=0
for arg in "$@"; do
  case "$arg" in
    --rehearse)     REHEARSE=1; KEEP_WIFI=1 ;;
    --no-screencap) NO_SCREENCAP=1 ;;
    --keep-wifi)    KEEP_WIFI=1 ;;
    -h|--help)
      sed -n '2,24p' "$0"
      exit 0 ;;
    *)
      echo "unknown flag: $arg (use --help)"
      exit 1 ;;
  esac
done

STAMP="$(date +%Y%m%d-%H%M%S)"
LABEL="$([ $REHEARSE -eq 1 ] && echo rehearse || echo take)"
OUTFILE="$OUT_DIR/${LABEL}-${STAMP}.mov"
SCREENCAP_PID=""

cleanup() {
  local exit_code=$?
  echo
  echo "→ cleanup (exit code $exit_code)"
  if [[ -n "${PLAYWRIGHT_PID:-}" ]] && kill -0 "$PLAYWRIGHT_PID" 2>/dev/null; then
    echo "  stopping Playwright (pid $PLAYWRIGHT_PID)"
    kill "$PLAYWRIGHT_PID" 2>/dev/null || true
  fi
  if [[ -n "$SCREENCAP_PID" ]] && kill -0 "$SCREENCAP_PID" 2>/dev/null; then
    echo "  stopping ffmpeg recorder (pid $SCREENCAP_PID) — sending SIGINT for clean save"
    kill -INT "$SCREENCAP_PID" 2>/dev/null || true
    local waited=0
    while kill -0 "$SCREENCAP_PID" 2>/dev/null && [[ $waited -lt 10 ]]; do
      sleep 1
      waited=$((waited + 1))
    done
    if kill -0 "$SCREENCAP_PID" 2>/dev/null; then
      kill -TERM "$SCREENCAP_PID" 2>/dev/null || true
    fi
  fi
  rm -f /tmp/hpe-playwright-ready /tmp/hpe-playwright-go
  if [[ $KEEP_WIFI -eq 0 ]]; then
    echo "  restoring Wi-Fi ($WIFI_IFACE on)"
    networksetup -setairportpower "$WIFI_IFACE" on || true
  fi
  if [[ -f "$OUTFILE" ]]; then
    local size_mb
    size_mb=$(du -m "$OUTFILE" | awk '{print $1}')
    echo "  output: $OUTFILE (${size_mb} MB)"
  fi
}
trap cleanup EXIT INT TERM

FFMPEG_BIN="${FFMPEG_BIN:-/Users/steveharlow/.local/bin/ffmpeg}"
if [[ ! -x "$FFMPEG_BIN" ]]; then
  echo "FATAL: ffmpeg not found at $FFMPEG_BIN. Install or set FFMPEG_BIN env."
  exit 1
fi

# ─────────────────────── Pre-roll sanity ───────────────────────────────
echo "→ pre-roll sanity checks"

if ! curl -sf --max-time 3 http://localhost:11434 >/dev/null; then
  echo "  FAIL: Ollama daemon not responding. Run ./scripts/prep-recording.sh first."
  exit 1
fi
echo "  ✓ ollama up"

if ! /Users/steveharlow/.local/bin/ollama ps 2>/dev/null | grep -qE "gemma4:e[24]b"; then
  echo "  FAIL: no Gemma 4 model currently resident. Run ./scripts/prep-recording.sh first."
  exit 1
fi
echo "  ✓ model resident in RAM"

if ! curl -sf --max-time 3 http://localhost:3000/api/health >/dev/null; then
  echo "  FAIL: dev server not responding. Run ./scripts/prep-recording.sh first."
  exit 1
fi
echo "  ✓ dev server up"

# Confirm dev server was started with STUB_LLM_REDACTION (otherwise Scene 4
# becomes a 6-minute wait). Detect by reading the running process env.
if ! ps eww -A -o command 2>/dev/null | grep -E "next dev" | grep -v grep | head -1 | grep -q "STUB_LLM_REDACTION=true"; then
  echo "  WARN: dev server is NOT running with STUB_LLM_REDACTION=true"
  echo "        Scene 4 (signed envelope) will take ~6 minutes of 'Working…' on screen."
  read -r -p "        continue anyway? [y/N] " ans
  [[ "${ans:-N}" =~ ^[Yy]$ ]] || exit 1
fi
echo "  ✓ STUB_LLM_REDACTION=true in dev env (fast Scene 4)"

LEDGER_INFO=$(curl -s "http://localhost:3000/api/ledger?limit=1")
LEDGER_VALID=$(echo "$LEDGER_INFO" | python3 -c "import sys,json;print(json.load(sys.stdin)['verification']['valid'])")
LEDGER_COUNT=$(echo "$LEDGER_INFO" | python3 -c "import sys,json;print(json.load(sys.stdin)['count'])")
if [[ "$LEDGER_VALID" != "True" ]]; then
  echo "  FAIL: ledger chain INVALID. Re-run ./scripts/prep-recording.sh"
  exit 1
fi
# Morning Review flow REQUIRES the ledger to have yesterday's batch entries.
# An empty ledger means prep-recording.sh's populate-narrative step never ran
# (or failed) and the recording would show an empty chat panel.
if [[ "$LEDGER_COUNT" == "0" ]]; then
  echo "  FAIL: ledger is empty. Morning Review needs yesterday's batch entries."
  echo "        Run ./scripts/prep-recording.sh first (populates chat history + ledger)."
  exit 1
fi
echo "  ✓ ledger has $LEDGER_COUNT entries (chain valid) — Morning Review state ready"

if [[ ! -d /tmp/hpe-record-profile ]]; then
  echo "  FAIL: persistent Chromium profile missing at /tmp/hpe-record-profile"
  echo "        Run ./scripts/prep-recording.sh first."
  exit 1
fi
echo "  ✓ persistent Chromium profile present"

echo "  ✓ Wi-Fi interface: $WIFI_IFACE"
echo "  ✓ mode: $([ $REHEARSE -eq 1 ] && echo REHEARSE || echo LIVE)"
echo "  ✓ output: $OUTFILE"

# ─────────────────────── Confirm before going dark ─────────────────────
if [[ $REHEARSE -eq 0 ]]; then
  echo
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  LIVE MODE — Wi-Fi will go OFF, screen recording will start."
  echo "  You lose internet (and Claude Code) until the take ends."
  echo "  Have the printed patient survey within arm's reach."
  echo "═══════════════════════════════════════════════════════════════════"
  read -r -p "  ENTER to roll, Ctrl-C to abort > "
fi

# ─────────────────────── Clean signal files ────────────────────────────
HPE_READY_FILE="/tmp/hpe-playwright-ready"
HPE_GO_FILE="/tmp/hpe-playwright-go"
rm -f "$HPE_READY_FILE" "$HPE_GO_FILE"

# ─────────────────────── Cut the network FIRST ─────────────────────────
# Wi-Fi must be OFF before Playwright opens the page, so the active probe
# in page.tsx fails immediately and the OFFLINE banner is already showing
# by the time the browser is on screen.
if [[ $KEEP_WIFI -eq 0 ]]; then
  echo "→ Wi-Fi OFF (page will load with offline probe failing → emerald banner)"
  networksetup -setairportpower "$WIFI_IFACE" off
  echo "  ✓ Wi-Fi off — Claude Code unreachable until restore"
fi

# ─────────────────────── Launch Playwright (browser only, not scenes) ──
# Playwright opens the browser, navigates to /, waits for OFFLINE banner,
# then writes $HPE_READY_FILE and blocks waiting for $HPE_GO_FILE before
# starting Scene 1. We start the screen recorder only AFTER seeing ready —
# that way no frame of the recording shows a Terminal window or empty desktop.
echo "→ launching Playwright (will open browser + wait for OFFLINE banner)"
cd "$REPO_ROOT/web"
if [[ $REHEARSE -eq 1 ]]; then
  REHEARSE=1 node scripts/record-take.cjs &
else
  node scripts/record-take.cjs &
fi
PLAYWRIGHT_PID=$!

# Wait for Playwright's ready signal (browser open, OFFLINE banner flipped)
echo "→ waiting for Playwright ready signal at $HPE_READY_FILE (max 30s)"
waited=0
while [[ ! -f "$HPE_READY_FILE" && $waited -lt 30 ]]; do
  sleep 1
  waited=$((waited + 1))
  if ! kill -0 "$PLAYWRIGHT_PID" 2>/dev/null; then
    echo "  FAIL: Playwright exited before signaling ready (waited ${waited}s)"
    exit 1
  fi
done
if [[ ! -f "$HPE_READY_FILE" ]]; then
  echo "  FAIL: Playwright did not signal ready within 30s"
  kill "$PLAYWRIGHT_PID" 2>/dev/null
  exit 1
fi
echo "  ✓ Playwright ready (browser on screen, OFFLINE banner showing)"

# ─────────────────────── Start screen capture ──────────────────────────
if [[ $NO_SCREENCAP -eq 0 ]]; then
  echo "→ starting ffmpeg recorder (avfoundation screen device) → $OUTFILE"
  "$FFMPEG_BIN" -y -hide_banner -loglevel error \
    -f avfoundation -framerate 30 -capture_cursor 1 -i "1:none" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
    "$OUTFILE" </dev/null >/tmp/ffmpeg-record.log 2>&1 &
  SCREENCAP_PID=$!
  sleep 1
  if ! kill -0 "$SCREENCAP_PID" 2>/dev/null; then
    echo "  FAIL: ffmpeg exited immediately. Check /tmp/ffmpeg-record.log"
    tail -5 /tmp/ffmpeg-record.log
    kill "$PLAYWRIGHT_PID" 2>/dev/null
    exit 1
  fi
  echo "  ✓ recording (pid $SCREENCAP_PID)"
else
  echo "→ --no-screencap set — start your own recorder NOW, then ENTER"
  read -r -p "  > "
fi

# ─────────────────────── Tell Playwright to begin scenes ───────────────
echo "→ sending go signal to Playwright"
touch "$HPE_GO_FILE"

# ─────────────────────── Wait for Playwright to finish ─────────────────
echo "→ Playwright is driving the scenes; waiting for exit"
wait "$PLAYWRIGHT_PID"
DRIVER_EXIT=$?

if [[ $DRIVER_EXIT -ne 0 ]]; then
  echo "  ! driver exited non-zero ($DRIVER_EXIT) — see trace above"
fi

# ffmpeg responds to SIGINT by finalizing the .mov cleanly, so the trap's
# kill -INT will save the recording right when Playwright exits. No need
# for a separate wait/-V-timer dance like with screencapture.

# Trap fires here: stops ffmpeg, restores Wi-Fi, prints output path.
exit $DRIVER_EXIT
