#!/usr/bin/env bash
#
# deploy-cyphercast.sh
#
# Deterministically deploy the CypherCast program to a running local validator (or any configured RPC).
# - Uses a fixed program keypair to keep the Program ID stable across runs
# - Shows program info after deployment
#
# Usage:
#   bash cyphercast/scripts/surfpool/deploy-cyphercast.sh
#
# Optional environment variables:
#   SURFPOOL_PROGRAM_SO        - Path to .so binary (default: <repo>/target/deploy/cyphercast.so)
#   SURFPOOL_PROGRAM_KEYPAIR   - Path to program keypair JSON (default: <repo>/target/deploy/cyphercast-keypair.json)
#   SURFPOOL_URL               - RPC URL (default: http://127.0.0.1:8899)
#
# Prerequisites:
#   - solana CLI installed and on PATH
#   - validator running and reachable via SURFPOOL_URL
#   - program artifacts built (npm run build)
#

set -euo pipefail

# Resolve repo root (this file is at cyphercast/scripts/surfpool)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PROGRAM_SO="${SURFPOOL_PROGRAM_SO:-"$REPO_ROOT/target/deploy/cyphercast.so"}"
PROGRAM_KEYPAIR="${SURFPOOL_PROGRAM_KEYPAIR:-"$REPO_ROOT/target/deploy/cyphercast-keypair.json"}"
RPC_URL="${SURFPOOL_URL:-"http://127.0.0.1:8899"}"

# Helpers
have_cmd() { command -v "$1" >/dev/null 2>&1; }

error() {
  echo "[ERROR] $*" >&2
  exit 1
}

info() {
  echo "[INFO] $*"
}

# Preflight checks
have_cmd solana || error "'solana' CLI not found. Install Solana CLI and ensure it is on PATH."

[[ -f "$PROGRAM_SO" ]] || error "Program binary not found: $PROGRAM_SO. Build first: npm run build"
[[ -f "$PROGRAM_KEYPAIR" ]] || error "Program keypair not found: $PROGRAM_KEYPAIR. Build first: npm run build"

# Ensure CLI points to the expected URL
info "Setting Solana CLI RPC URL to: $RPC_URL"
solana config set --url "$RPC_URL" >/dev/null

# Resolve (deterministic) Program ID from keypair
PROGRAM_ID="$(solana address -k "$PROGRAM_KEYPAIR")" || error "Failed to derive program address from keypair: $PROGRAM_KEYPAIR"

info "Deploying CypherCast program"
info "  Program ID : $PROGRAM_ID"
info "  Binary     : $PROGRAM_SO"
info "  Keypair    : $PROGRAM_KEYPAIR"

# Attempt to deploy (or upgrade if already deployed and we have the authority)
# --program-id ensures deterministic program address across runs
set +e
DEPLOY_OUTPUT="$(solana program deploy --program-id "$PROGRAM_KEYPAIR" "$PROGRAM_SO" 2>&1)"
DEPLOY_STATUS=$?
set -e

echo "$DEPLOY_OUTPUT"

if [[ $DEPLOY_STATUS -ne 0 ]]; then
  # Provide common hints on failure
  if echo "$DEPLOY_OUTPUT" | grep -qi "does not match authority provided"; then
    error "Program deploy failed: upgrade authority mismatch. Reset your ledger or use the correct upgrade authority keypair."
  fi
  if echo "$DEPLOY_OUTPUT" | grep -qi "RPC request error"; then
    error "Program deploy failed: RPC error. Ensure the validator is running and reachable at $RPC_URL."
  fi
  error "Program deploy failed with status $DEPLOY_STATUS."
fi

info "Showing deployed program info:"
solana program show "$PROGRAM_ID" || error "Failed to fetch program info for $PROGRAM_ID"

info "Deployment complete."
