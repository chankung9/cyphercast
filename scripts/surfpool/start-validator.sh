#!/usr/bin/env bash
#
# start-validator.sh
#
# Start a clean local Solana validator for reproducible tests.
# - Resets and uses a dedicated ledger directory (default: .surfpool/ledger)
# - Binds to configurable RPC and faucet ports (default: 8899 / 9900)
# - Persists the validator PID for easy stop/cleanup
# - Waits until the RPC endpoint is healthy
#
# Usage:
#   bash scripts/surfpool/start-validator.sh
#
# Environment variables (optional):
#   SURFPOOL_LEDGER_DIR     - Ledger directory (default: <repo>/.surfpool/ledger)
#   SURFPOOL_RPC_PORT       - RPC port (default: 8899)
#   SURFPOOL_FAUCET_PORT    - Faucet port (default: 9900)
#   SURFPOOL_PID_FILE       - PID file (default: <repo>/.surfpool/validator.pid)
#   SURFPOOL_LOG_FILE       - Log file (default: <repo>/.surfpool/validator.log)
#   SURFPOOL_HEALTH_RETRIES - RPC health check retries (default: 30)
#   SURFPOOL_HEALTH_SLEEP   - Seconds between health checks (default: 1)
#
# Requirements:
#   - Solana CLI (solana, solana-test-validator) installed
#   - Anchor CLI recommended
#

set -euo pipefail

# Determine repo root relative to this script (scripts/surfpool -> ../..)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Defaults
LEDGER_DIR="${SURFPOOL_LEDGER_DIR:-"$REPO_ROOT/.surfpool/ledger"}"
RPC_PORT="${SURFPOOL_RPC_PORT:-8899}"
FAUCET_PORT="${SURFPOOL_FAUCET_PORT:-9900}"
PID_FILE="${SURFPOOL_PID_FILE:-"$REPO_ROOT/.surfpool/validator.pid"}"
LOG_FILE="${SURFPOOL_LOG_FILE:-"$REPO_ROOT/.surfpool/validator.log"}"
HEALTH_RETRIES="${SURFPOOL_HEALTH_RETRIES:-30}"
HEALTH_SLEEP="${SURFPOOL_HEALTH_SLEEP:-1}"

# Helper: check if a command exists
have_cmd() { command -v "$1" >/dev/null 2>&1; }

# Helper: check if a port is in use
port_in_use() {
  local port="$1"
  if have_cmd lsof; then
    lsof -iTCP:"$port" -sTCP:LISTEN -Pn >/dev/null 2>&1
  elif have_cmd ss; then
    ss -ltn "( sport = :$port )" 2>/dev/null | grep -q ":$port"
  elif have_cmd netstat; then
    netstat -ltn 2>/dev/null | grep -q ":$port"
  else
    # Fallback: try connecting briefly
    (exec 3<>/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1 || return 1
    exec 3<&-
    exec 3>&-
    return 0
  fi
}

# Preflight checks
if ! have_cmd solana; then
  echo "[ERROR] 'solana' CLI not found in PATH."
  echo "        Install Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools"
  exit 1
fi

if ! have_cmd solana-test-validator; then
  echo "[ERROR] 'solana-test-validator' not found in PATH."
  echo "        Install Solana CLI tools (includes test validator)."
  exit 1
fi

mkdir -p "$(dirname "$PID_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$LEDGER_DIR"

# If PID file exists and process is running, stop it (best-effort)
if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${OLD_PID:-}" ]] && ps -p "$OLD_PID" >/dev/null 2>&1; then
    echo "[INFO] Found existing validator PID $OLD_PID. Attempting to stop..."
    kill "$OLD_PID" || true
    # Wait for shutdown
    for i in $(seq 1 20); do
      if ps -p "$OLD_PID" >/dev/null 2>&1; then
        sleep 0.5
      else
        break
      fi
    done
  fi
  rm -f "$PID_FILE"
fi

# If port is in use, try to kill an existing validator instance on that port
if port_in_use "$RPC_PORT"; then
  echo "[WARN] Port $RPC_PORT is in use; attempting to stop existing validator..."
  pkill -f "solana-test-validator.*--rpc-port $RPC_PORT" || true
  sleep 1
fi

if port_in_use "$RPC_PORT"; then
  echo "[ERROR] Port $RPC_PORT is still in use after cleanup attempts. Aborting."
  exit 1
fi

# Start validator
echo "[INFO] Starting solana-test-validator"
echo "       Ledger:      $LEDGER_DIR"
echo "       RPC Port:    $RPC_PORT"
echo "       Faucet Port: $FAUCET_PORT"
echo "       Log:         $LOG_FILE"

# Start clean validator with a reset ledger; quiet logs redirected to file
# You can add/test additional flags if needed (e.g., --limit-ledger-size).
solana-test-validator \
  --reset \
  --ledger "$LEDGER_DIR" \
  --rpc-port "$RPC_PORT" \
  --faucet-port "$FAUCET_PORT" \
  --quiet >"$LOG_FILE" 2>&1 &

VALIDATOR_PID=$!
echo "$VALIDATOR_PID" >"$PID_FILE"
echo "[INFO] Validator PID: $VALIDATOR_PID"

# Ensure CLI points to the local RPC
solana config set --url "http://127.0.0.1:${RPC_PORT}" >/dev/null

# Health check loop
echo "[INFO] Waiting for RPC to become healthy..."
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if solana cluster-version >/dev/null 2>&1; then
    echo "[INFO] RPC is up."
    echo "[INFO] You can tail logs via: tail -f \"$LOG_FILE\""
    exit 0
  fi
  sleep "$HEALTH_SLEEP"
done

echo "[ERROR] Validator failed to become healthy after $((HEALTH_RETRIES * HEALTH_SLEEP)) seconds."
echo "        See logs at: $LOG_FILE"
exit 1
