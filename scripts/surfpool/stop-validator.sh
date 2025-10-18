#!/usr/bin/env bash
#
# stop-validator.sh
#
# Stop a local solana-test-validator started by scripts/surfpool/start-validator.sh
# - Reads the validator PID from a PID file (default: <repo>/.surfpool/validator.pid)
# - Attempts graceful shutdown and waits briefly
# - Falls back to killing any solana-test-validator on the configured RPC port
#
# Usage:
#   bash cyphercast/scripts/surfpool/stop-validator.sh
#
# Optional environment variables:
#   SURFPOOL_PID_FILE  - PID file path (default: <repo>/.surfpool/validator.pid)
#   SURFPOOL_RPC_PORT  - RPC port to ensure is freed (default: 8899)
#
# Requirements:
#   - Solana CLI installed for pkill fallback (optional)
#

set -euo pipefail

# Resolve repo root (this file is at cyphercast/scripts/surfpool)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Defaults
PID_FILE="${SURFPOOL_PID_FILE:-"$REPO_ROOT/.surfpool/validator.pid"}"
RPC_PORT="${SURFPOOL_RPC_PORT:-8899}"

have_cmd() { command -v "$1" >/dev/null 2>&1; }

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

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*" >&2; }
error() { echo "[ERROR] $*" >&2; exit 1; }

# 1) Attempt to stop using PID file
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${PID:-}" ]]; then
    if ps -p "$PID" >/dev/null 2>&1; then
      info "Stopping validator PID $PID ..."
      kill "$PID" || true
      # Wait for shutdown
      for i in $(seq 1 20); do
        if ps -p "$PID" >/dev/null 2>&1; then
          sleep 0.5
        else
          break
        fi
      done
    else
      warn "Process $PID not running. Cleaning up PID file."
    fi
  else
    warn "PID file is empty. Cleaning up."
  fi
  rm -f "$PID_FILE"
else
  warn "No PID file found at $PID_FILE. Will attempt port-based cleanup."
fi

# 2) Ensure port is free; if not, try to kill by process pattern
if port_in_use "$RPC_PORT"; then
  warn "RPC port $RPC_PORT still in use. Attempting to stop existing solana-test-validator on that port..."
  # Best-effort: match processes launched with explicit rpc port
  pkill -f "solana-test-validator.*--rpc-port $RPC_PORT" || true
  sleep 1
fi

# 3) Final check
if port_in_use "$RPC_PORT"; then
  error "RPC port $RPC_PORT is still in use. Manual intervention may be required."
fi

info "Validator stopped and RPC port $RPC_PORT is free."
