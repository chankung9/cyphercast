# CypherCast MVP Snapshot

## Purpose
This page summarizes what the team has delivered across Phases 1, 2, and 2.5, describing the functional MVP that is ready for demos today and outlining what is planned next.

## Phase 1 – Streaming Core ✅
- Anchor program with deterministic PDAs for Stream, Participant, and Prediction accounts.
- Instructions to create streams, accept predictions, resolve outcomes, and claim fixed rewards.
- CLI tooling and scripts to drive the flow end-to-end on Solana Localnet.
- Baseline test coverage validating happy-path interactions.

## Phase 2 – Token Vault & Rewards ✅
- SPL token integration with secure TokenVault PDA custody.
- Stake enforcement when joining or predicting, with overflow-safe accounting.
- PDA-signed reward withdrawals using `anchor_spl::token` CPI calls.
- Comprehensive test suite (Mocha + Anchor) covering deposits, claims, and failure cases.
- Detailed developer documentation (archived in `docs/archive/phase2`).

## Phase 2.5 – Monetization & Proportionality ✅
- `tip_bps` configuration stored on-chain with automatic tip payout to creators.
- Proportional reward distribution using `total_by_choice` aggregates.
- Join-without-stake update enabling viewers to onboard before committing tokens.
- CommunityVault scaffold for future treasury mechanics.
- Enhanced analytics events, including tip amounts emitted in `StreamResolved`.

## Demo Experience
1. Run `anchor test` or `npm test` to spin up the local validator, deploy the program, and execute the full suite.
2. Use the CLI quick reference to simulate a stream: create, initialize vault, join viewers, submit predictions, resolve, and claim.
3. Inspect the emitted events and account state via `anchor account` or Solana Explorer (local validator) to verify transparency.

## Roadmap Highlights
- **Phase 3** – React-based web dApp, wallet adapter UX, and real-time dashboards.
- **Phase 4** – Creator pilots, sponsorship integrations, and devnet launch.
- **Phase 5** – DAO governance, multi-token support, and mobile-first experiences.

## Key Proof Points
- 100% of critical instructions have automated tests, including boundary conditions around tips and proportional payouts.
- Streamer monetization is implemented as programmable rails, not manual accounting.
- Documentation has been refactored into topical guides for investors, developers, and operators.

CypherCast is demo-ready: the MVP proves technical feasibility, monetization hooks, and community-aligned growth paths.
