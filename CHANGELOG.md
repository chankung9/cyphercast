# CypherCast Changelog

All notable progress for the CypherCast program is documented here. Dates reflect the month the milestone landed on the main branch.

## 2025-10-15 – Phase 2.5: Enhanced Rewards
- Introduced proportional reward distribution using `total_by_choice` aggregates.
- Added `tip_bps` configuration with automatic streamer tip payouts and accounting.
- Enabled join-without-stake flow so viewers onboard before committing tokens.
- Scaffolded the `CommunityVault` PDA for community treasury features.
- Emitted richer analytics (tip amounts on `StreamResolved`) for dashboards.
- Restructured documentation into topical guides for investors, engineers, and operators.

## 2025-09-10 – Phase 2: Token Vault
- Integrated SPL token custody via the `TokenVault` PDA and associated token accounts.
- Enforced staking during `join_stream` / `submit_prediction` with overflow-safe math.
- Implemented PDA-signed withdrawals in `claim_reward` to pay winners on-chain.
- Added comprehensive TypeScript tests covering staking, rewards, and guard rails.
- Produced Phase 2 documentation set (now archived under `docs/archive/phase2`).

## 2025-08-05 – Phase 1: MVP Launch
- Delivered core Stream, Participant, and Prediction PDAs with deterministic seeds.
- Implemented instructions to create streams, submit predictions, resolve outcomes, and claim fixed rewards.
- Built CLI tooling and anchor scripts to demonstrate the full flow on Localnet.
- Established baseline unit tests and developer setup instructions.

## Upcoming – Phase 3: Frontend & UX
- React-based dApp with wallet adapters and live dashboards.
- Devnet pilot with creator partners and sponsored prediction pools.
- Automated grace-period handling and cancellation refund workflows.
