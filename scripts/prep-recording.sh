#!/usr/bin/env bash
# One-time pre-recording bootstrap.
#
# Run this ONCE per recording session. It:
#   - ensures Ollama is up with a long keep-alive (model stays resident)
#   - restarts the Next dev server with the right env (e2b + STUB_LLM_REDACTION)
#   - wipes the ledger so the recording starts on a clean chain
#   - pre-warms chat + vision so the first scene-2 / scene-3 isn't a cold load
#
# After this completes, run scripts/record-take.sh for each take. Retakes are
# cheap (the model stays warm via OLLAMA_KEEP_ALIVE=1h).
#
# Why STUB_LLM_REDACTION=true: on Intel CPU the LLM redaction walks ~16
# strings sequentially for ~6 min per take. The regex floor still produces
# the >100 visible redactions; the LLM sub-agent is architecturally present
# but stubbed for recording speed. See docs/VIDEO-SCRIPT.md for the integrity
# discussion. Override with `--honest-redact` if you must run the live LLM.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEDGER_FILE="$REPO_ROOT/data/ledger/ledger.jsonl"
OLLAMA_BIN="/Users/steveharlow/.local/bin/ollama"

HONEST_REDACT=0
SKIP_WARM=0
for arg in "$@"; do
  case "$arg" in
    --honest-redact) HONEST_REDACT=1 ;;
    --skip-warm)     SKIP_WARM=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0 ;;
    *)
      echo "unknown flag: $arg"
      exit 1 ;;
  esac
done

REDACT_ENV=""
REDACT_LABEL="FAST (stubbed LLM, real regex)"
if [[ $HONEST_REDACT -eq 1 ]]; then
  REDACT_LABEL="HONEST (real LLM redaction, ~6min/Scene4)"
else
  REDACT_ENV="STUB_LLM_REDACTION=true"
fi

echo "→ prep-recording — redaction mode: $REDACT_LABEL"

# ─────────────────────── 1. Ollama daemon ───────────────────────────────
if ! curl -sf --max-time 2 http://localhost:11434 >/dev/null; then
  echo "→ starting Ollama with OLLAMA_KEEP_ALIVE=1h"
  nohup env OLLAMA_KEEP_ALIVE=1h "$OLLAMA_BIN" serve > /tmp/ollama-serve.log 2>&1 &
  disown
  for _ in $(seq 1 15); do
    if curl -sf --max-time 2 http://localhost:11434 >/dev/null; then break; fi
    sleep 1
  done
fi
if curl -sf --max-time 2 http://localhost:11434 >/dev/null; then
  echo "  ✓ ollama up"
else
  echo "  FAIL: ollama did not come up. Tail /tmp/ollama-serve.log"
  exit 1
fi

if ! "$OLLAMA_BIN" list 2>/dev/null | grep -qE "gemma4:e2b"; then
  echo "  FAIL: gemma4:e2b not installed. Run: $OLLAMA_BIN pull gemma4:e2b"
  exit 1
fi
echo "  ✓ gemma4:e2b installed"

# ─────────────────────── 2. Restart dev server cleanly ─────────────────
echo "→ stopping any running dev server and wiping ledger"
pkill -f "next dev" 2>/dev/null || true
# Wait for port 3000 to actually free up
for _ in $(seq 1 10); do
  if ! lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then break; fi
  sleep 1
done
rm -f "$LEDGER_FILE"
echo "  ✓ ledger wiped"

echo "→ launching dev server with: GEMMA_MODEL=gemma4:e2b GEMMA_REDACTION_MODEL=gemma4:e2b $REDACT_ENV"
# Full triple-redirect + disown to detach so future shells don't inherit:
cd "$REPO_ROOT/web"
env GEMMA_MODEL=gemma4:e2b GEMMA_REDACTION_MODEL=gemma4:e2b $REDACT_ENV \
  nohup npm run dev < /dev/null > /tmp/gemma-dev.log 2>&1 &
DEV_PID=$!
disown $DEV_PID

# Wait for ready
for _ in $(seq 1 30); do
  if curl -sf --max-time 2 http://localhost:3000/api/health >/dev/null; then break; fi
  sleep 1
done
if ! curl -sf --max-time 2 http://localhost:3000/api/health >/dev/null; then
  echo "  FAIL: dev server did not respond. Tail /tmp/gemma-dev.log"
  exit 1
fi
echo "  ✓ dev server up (pid $DEV_PID)"

LEDGER_VALID=$(curl -s "http://localhost:3000/api/ledger?limit=1" | python3 -c "import sys,json;print(json.load(sys.stdin)['verification']['valid'])")
LEDGER_COUNT=$(curl -s "http://localhost:3000/api/ledger?limit=1" | python3 -c "import sys,json;print(json.load(sys.stdin)['count'])")
echo "  ✓ ledger chain valid=$LEDGER_VALID, count=$LEDGER_COUNT"

# ─────────────────────── 3. Pre-warm model paths ───────────────────────
warm_path() {
  local label="$1" url="$2" body="$3"
  printf '    %s … ' "$label"
  local t0=$(date +%s)
  local http
  http=$(curl -s -o /tmp/warm-resp.json -w '%{http_code}' --max-time 480 -X POST "$url" -H 'Content-Type: application/json' -d "$body")
  local t1=$(date +%s)
  printf '%ss (HTTP %s)\n' "$((t1 - t0))" "$http"
}

if [[ $SKIP_WARM -eq 0 ]]; then
  echo "→ pre-warming Gemma paths (no ledger writes — uses /api/generate direct)"
  # Use Ollama's /api/generate directly to warm WITHOUT polluting the
  # Compliance Ledger. The narrative-populate step below produces the only
  # entries we want visible in the recording.
  printf '    chat-model … '
  T0=$(date +%s)
  HTTP=$(curl -s -o /tmp/warm-resp.json -w '%{http_code}' --max-time 240 \
    -X POST http://localhost:11434/api/generate \
    -d '{"model":"gemma4:e2b","prompt":"hi","stream":false,"keep_alive":"1h"}')
  T1=$(date +%s)
  printf '%ss (HTTP %s)\n' "$((T1 - T0))" "$HTTP"
fi

# ─────────────────────── 4. Populate morning-batch narrative ────────────
echo "→ staging Morning Review narrative state (chat history + ledger)"
echo "  this runs the Scene-2 prompt once via headless Chromium so the recording"
echo "  starts with yesterday's batch already on screen. Expected wall-clock: 2-4 min."
cd "$REPO_ROOT/web"
rm -rf /tmp/hpe-record-profile  # fresh persistent profile each prep
if ! node scripts/populate-narrative.cjs; then
  echo "  FAIL: narrative population failed. Check /tmp/gemma-dev.log and"
  echo "        run scripts/populate-narrative.cjs standalone for details."
  exit 1
fi
echo "  ✓ chat history + ledger populated; persistent profile ready"

# ─────────────────────── 4. Final state ─────────────────────────────────
echo
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  PREP COMPLETE — Morning Review state staged for record    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo "  ollama:  resident model:"
"$OLLAMA_BIN" ps | tail -n +2 | sed 's/^/    /'
echo "  dev:     pid $DEV_PID · $REDACT_LABEL"
LEDGER_COUNT=$(curl -s http://localhost:3000/api/ledger?limit=1 | python3 -c 'import sys,json;print(json.load(sys.stdin)["count"])')
echo "  ledger:  count=$LEDGER_COUNT (yesterday's batch entries — DO NOT WIPE before recording)"
echo "  profile: /tmp/hpe-record-profile (persistent Chromium with chat history)"
echo
echo "  Next step: print + hand-fill assets/patient-survey-print.html,"
echo "             then run: ./scripts/record-take.sh"
