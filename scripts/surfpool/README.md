# Surfpool scripts (minimal) — local validator and deterministic deploy

This folder contains a minimal set of helper scripts to:
- Start a clean local Solana validator for reproducible tests
- Deploy the CypherCast program deterministically (stable Program ID)
- Stop the validator cleanly

These scripts are intended to be copy-paste friendly. Save each snippet as an executable file in this directory.

Recommended layout:
- scripts/surfpool/start-validator.sh
- scripts/surfpool/deploy-cyphercast.sh
- scripts/surfpool/stop-validator.sh
- scripts/surfpool/health-check.sh (optional)

Note: These scripts assume you have Solana CLI and Anchor CLI installed, and your program is built at target/deploy/cyphercast.so with a deterministic program keypair at target/deploy/cyphercast-keypair.json.

Prerequisites
- Solana CLI (1.18+ recommended)
- Anchor CLI (0.31.1+)
- Node.js 18+ (for running tests)
- CypherCast built artifact and program keypair:
  - target/deploy/cyphercast.so
  - target/deploy/cyphercast-keypair.json

Environment variables (optional)
- SURFPOOL_LEDGER_DIR: Directory for validator ledger (default: .surfpool/ledger)
- SURFPOOL_RPC_PORT: RPC port (default: 8899)
- SURFPOOL_FAUCET_PORT: Faucet port (default: 9900)
- SURFPOOL_PID_FILE: File to store validator PID (default: .surfpool/validator.pid)
- SURFPOOL_PROGRAM_SO: Program shared object path (default: target/deploy/cyphercast.so)
- SURFPOOL_PROGRAM_KEYPAIR: Program keypair path (default: target/deploy/cyphercast-keypair.json)
- SURFPOOL_URL: RPC URL (default: http://127.0.0.1:8899)

Quick start
1) Build program artifacts
   npm run build

2) Start a clean validator (new ledger)
   bash scripts/surfpool/start-validator.sh

3) Deploy deterministically (stable Program ID)
   bash scripts/surfpool/deploy-cyphercast.sh

4) Run tests against the validator you started
   ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 anchor test --skip-local-validator

5) Stop the validator
   bash scripts/surfpool/stop-validator.sh


start-validator.sh
--------------------------------
#!/usr/bin/env bash
set -euo pipefail

LEDGER_DIR="${SURFPOOL_LEDGER_DIR:-.surfpool/ledger}"
RPC_PORT="${SURFPOOL_RPC_PORT:-8899}"
FAUCET_PORT="${SURFPOOL_FAUCET_PORT:-9900}"
PID_FILE="${SURFPOOL_PID_FILE:-.surfpool/validator.pid}"

mkdir -p "$(dirname "$PID_FILE")"
mkdir -p "$LEDGER_DIR"

# Kill any running validator on this port (best-effort)
if lsof -iTCP:"$RPC_PORT" -sTCP:LISTEN -Pn >/dev/null 2>&1; then
  echo "Port $RPC_PORT is in use; attempting to stop existing validator..."
  pkill -f "solana-test-validator.*--rpc-port $RPC_PORT" || true
  sleep 1
fi

echo "Starting solana-test-validator on port $RPC_PORT with ledger at $LEDGER_DIR ..."
solana-test-validator \
  --reset \
  --ledger "$LEDGER_DIR" \
  --rpc-port "$RPC_PORT" \
  --faucet-port "$FAUCET_PORT" \
  --quiet > .surfpool/validator.log 2>&1 &

echo $! > "$PID_FILE"
echo "Validator PID: $(cat "$PID_FILE")"

# Point CLI to local validator
solana config set --url "http://127.0.0.1:${RPC_PORT}" >/dev/null

# Wait for health
echo "Waiting for RPC to become healthy..."
for i in {1..30}; do
  if solana cluster-version >/dev/null 2>&1; then
    echo "RPC is up."
    exit 0
  fi
  sleep 1
done

echo "Validator failed to start in time. See .surfpool/validator.log"
exit 1


deploy-cyphercast.sh
--------------------------------
#!/usr/bin/env bash
set -euo pipefail

PROGRAM_SO="${SURFPOOL_PROGRAM_SO:-target/deploy/cyphercast.so}"
PROGRAM_KEYPAIR="${SURFPOOL_PROGRAM_KEYPAIR:-target/deploy/cyphercast-keypair.json}"
RPC_URL="${SURFPOOL_URL:-http://127.0.0.1:8899}"

if [ ! -f "$PROGRAM_SO" ] || [ ! -f "$PROGRAM_KEYPAIR" ]; then
  echo "Missing program artifact or keypair. Build first:"
  echo "  npm run build"
  echo "Expected:"
  echo "  $PROGRAM_SO"
  echo "  $PROGRAM_KEYPAIR"
  exit 1
fi

# Ensure CLI points to requested URL
solana config set --url "$RPC_URL" >/dev/null

PROGRAM_ID=$(solana address -k "$PROGRAM_KEYPAIR")
echo "Deploying CypherCast program:"
echo "  Program ID: $PROGRAM_ID"
echo "  Binary:     $PROGRAM_SO"

# Use deterministic program-id so the Program ID is stable across runs
# Upgrade authority will be your current default keypair (solana config get)
solana program deploy \
  --program-id "$PROGRAM_KEYPAIR" \
  "$PROGRAM_SO"

echo "Deployed program ID:"
solana program show "$PROGRAM_ID"


stop-validator.sh
--------------------------------
#!/usr/bin/env bash
set -euo pipefail

PID_FILE="${SURFPOOL_PID_FILE:-.surfpool/validator.pid}"

if [ ! -f "$PID_FILE" ]; then
  echo "No PID file found at $PID_FILE. Nothing to stop."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ps -p "$PID" >/dev/null 2>&1; then
  echo "Stopping validator PID $PID ..."
  kill "$PID"
  # Wait for it to exit
  for i in {1..20}; do
    if ps -p "$PID" >/dev/null 2>&1; then
      sleep 0.5
    else
      break
    fi
  done
else
  echo "Validator process $PID not running."
fi

rm -f "$PID_FILE"
echo "Validator stopped."


health-check.sh (optional)
--------------------------------
#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${SURFPOOL_URL:-http://127.0.0.1:8899}"
echo "RPC URL: $RPC_URL"
solana cluster-version
solana balance
solana validators


Deterministic deploy (why and how)
- Why:
  - Using a fixed program keypair (target/deploy/cyphercast-keypair.json) makes the Program ID stable across runs and CI jobs.
  - This avoids “authority mismatch” errors when re-deploying to a reused ledger, as long as the upgrade authority (your default keypair) remains the same.
- How:
  - Keep target/deploy/cyphercast-keypair.json under version control for CI or ensure the same file is used across runs.
  - Use solana program deploy --program-id target/deploy/cyphercast-keypair.json target/deploy/cyphercast.so

Common issues and fixes
- Port 8899 already in use:
  - Another validator is running. Use stop-validator.sh or kill existing process, then start again.
- Program’s authority does not match:
  - The ledger has a program deployed with a different upgrade authority or different program-id.
  - Fix by resetting ledger (start-validator.sh uses --reset) or deploy with the same --program-id keypair that was used originally.
- CLI points to wrong cluster:
  - Ensure solana config set --url http://127.0.0.1:8899 before deploy/tests.
- Anchor and JS package mismatch:
  - Use Anchor CLI 0.31.1+ and JS @coral-xyz/anchor ^0.31.1 for consistency.

Integrating with tests
- For fully controlled test runs:
  - Start validator: bash scripts/surfpool/start-validator.sh
  - Deploy deterministically: bash scripts/surfpool/deploy-cyphercast.sh
  - Run tests against local RPC:
    ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 anchor test --skip-local-validator
  - Stop validator: bash scripts/surfpool/stop-validator.sh

Tips
- Consider a dedicated shell (tmux/screen) for validator logs: tail -f .surfpool/validator.log
- You can publish these scripts in CI before running tests to guarantee a clean, reproducible environment.
