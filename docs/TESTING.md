# CypherCast Testing Guide

## Overview
CypherCast ships with an automated test suite built on Anchor and TypeScript (Mocha + Chai). Running the suite launches a local Solana validator, deploys the program, and exercises the full staking and reward lifecycle introduced in Phase 2.5.


## Requirements
To run the test suite, you must have the following minimum versions installed:
- **Solana CLI**: v1.16.0 or higher
- **Anchor**: v0.28.0 or higher
## Quick Commands
```bash
# Install dependencies (once)
npm install

# Run all tests (spins up local validator automatically)
npm test
# or
anchor test

# Skip launching the validator if you already have one running
npm run test:skip-validator
```

## Test Structure
```
tests/
├─ cyphercast.test.ts                # Core instruction coverage (Phase 1 heritage)
├─ edge-cases/
│   ├─ boundary-conditions.test.ts   # Min/max tips, precision, and overflow guards
│   └─ error-handling.test.ts        # Authorization & invalid flow checks
└─ integration/
    └─ complete-workflows.test.ts    # End-to-end scenarios with multiple viewers
```

## What the Suite Covers
- **Stream lifecycle** – Creation, joining, prediction submission, resolution, and reward claiming.
- **Token economics** – Verification of proportional payouts, streamer tips, and vault accounting totals.
- **Validation errors** – Guards for invalid tip percentages, zero stakes, late submissions, and unauthorized actions.
- **Regression safety** – Multiple streams in parallel, repeated joins, and prevention of double claims.

## Sample Output
Expect to see 8+ descriptive test cases pass, including scenarios like “handles multiple winners proportionally” and “rejects stream with tip percentage > 100%”. The suite logs Anchor transaction signatures, making it easy to inspect state changes via `solana logs` when debugging.

## Manual Verification Tips
- Use `anchor account <pubkey>` to inspect Stream and TokenVault accounts after the suite runs.
- Leverage the CLI Quick Reference (`docs/CLI-QUICK-REF.md`) to replay specific flows manually.
- Toggle `ANCHOR_WALLET` to test with different creator identities.

Keeping these tests green ensures that future roadmap work—especially the Phase 3 web client—rests on a stable foundation.
